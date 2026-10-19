/**
 * GET /api/v2/portfolio
 *
 * Take-Two command center: how players move between 2K, Rockstar Games and
 * Zynga. Every number is computed live from the Spanner player graph
 * (`TakeTwoPlayerGraph` on the Take-Two portfolio database, t2_graph_db):
 *
 *   - studios:      distinct players, per-title spend, churn per studio (PlaysGame).
 *   - venn:         players by studio combination (2K / Rockstar / Zynga).
 *   - spend_by_reach: spend + churn per head for 1, 2 and 3 studios.
 *   - franchises:   per title: players, primary players, spend, churn, players
 *                   who came from another studio, and how many arrived by invite.
 *   - friend_pull:  for key (home studio -> title) pairs, adoption among that
 *                   studio's players with vs. without at least one FRIENDS_WITH
 *                   friend in the title (stratified by home studio).
 *   - invites:      INVITED edges by studio pair (sent, accepted).
 *   - gta6:         WISHLISTED intent for Grand Theft Auto VI by the wisher's studio.
 *   - bridges:      players with the most friends in other studios.
 *   - path:         one live multi-hop GQL traversal (shown with its query text).
 *   - overlap:      title x title co-play from Players.franchises_played.
 *
 * The 2K Core Finding is served separately (/api/insights/core-finding) and
 * stays 2K-only. As-of is anchored to the data (MAX(last_active_at)).
 * Failures return 503 with the service, resource and message. Nothing is
 * estimated or canned. Cached in-process for 15 minutes (?fresh=1 recomputes).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/gcp/spanner-client";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type Studio = "2K" | "ROCKSTAR" | "ZYNGA";

export interface PortfolioFranchise {
  franchise: string;
  game_id: string;
  title: string;
  label: string;
  studio: Studio;
  lifecycle_status: string | null;
  players: number;
  primary_players: number;
  spend_usd: number;
  churned: number;
  churn_rate: number;
  /** Players of this title whose primary title is in another studio. */
  from_other_studios: number;
  /** PlaysGame edges acquired via FRIEND_INVITE. */
  via_invite: number;
}

export interface StudioSummary {
  studio: Studio;
  players: number;
  titles: number;
  spend_usd: number;
  churn_rate: number;
  /** Share of this studio's players who also play another Take-Two studio. */
  shared_share: number;
}

export interface FriendPull {
  /** Home studio of the players measured (e.g. 2K players -> GTA Online). */
  source: Studio;
  franchise: string;
  title: string;
  studio: Studio;
  with_friend: { n: number; adopted: number; rate: number };
  without_friend: { n: number; adopted: number; rate: number };
  lift: number | null;
}

export interface InviteFlow {
  from: Studio;
  to: Studio;
  sent: number;
  accepted: number;
}

export interface PortfolioResponse {
  as_of: string | null;
  totals: {
    players: number;
    multi_studio_players: number;
    multi_studio_share: number;
    cross_studio_friendships: number;
    spend_usd: number;
    churned_14d: number;
    invites_accepted: number;
  };
  studios: StudioSummary[];
  /** key = sorted studio combination joined with "+", e.g. "2K+ROCKSTAR". */
  venn: Record<string, number>;
  spend_by_reach: { studios: number; players: number; avg_spend_usd: number; churn_rate: number }[];
  franchises: PortfolioFranchise[];
  friend_pull: FriendPull[];
  invites: InviteFlow[];
  invite_retention: { via: string; players: number; churn_rate: number }[];
  gta6: { total: number; by_studio: { studio: Studio; wishlisted: number; players: number; rate: number }[] };
  bridges: { player_id: string; gamer_tag: string; primary_title: string; studio: Studio; studios: Studio[]; other_studio_friends: number; invites_accepted: number }[];
  path: { label: string; query: string; inviters: number; invitees: number; latency_ms: number };
  overlap: { franchises: string[]; share: number[][]; counts: Record<string, number> };
  source: { engine: "spanner"; database: string; instance: string; graph: string };
  latency_ms: number;
  cache: "hit" | "miss" | "stale";
  computed_at: string;
}

type Built = Omit<PortfolioResponse, "cache" | "computed_at">;

// The graph is a static demo snapshot; one hour keeps the landing instant.
const CACHE_TTL_MS = 60 * 60 * 1000;
const g = globalThis as unknown as {
  __portfolioCache?: { db: string; at: number; value: Built };
  __portfolioBuild?: Promise<{ at: number; value: Built }>;
};

/** One build at a time; concurrent requests share it. */
function rebuild(): Promise<{ at: number; value: Built }> {
  if (!g.__portfolioBuild) {
    g.__portfolioBuild = build()
      .then((value) => {
        const at = Date.now();
        g.__portfolioCache = { db: GCP_CONFIG.spannerDatabaseId, at, value };
        return { at, value };
      })
      .finally(() => {
        g.__portfolioBuild = undefined;
      });
  }
  return g.__portfolioBuild;
}

class StageError extends Error {
  constructor(public service: "spanner", public resource: string, message: string) {
    super(message);
  }
}

const RESOURCE = () =>
  `projects/${GCP_CONFIG.projectId}/instances/${GCP_CONFIG.spannerInstanceId}/databases/${GCP_CONFIG.spannerDatabaseId}`;

async function q<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
  try {
    const [rows] = await getDatabase().run(params ? { sql, params } : { sql });
    return rows.map((r) => r.toJSON() as T);
  } catch (e) {
    throw new StageError("spanner", RESOURCE(), `${(e as Error).message}\nSQL: ${sql.replace(/\s+/g, " ").slice(0, 500)}`);
  }
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Studio of a Games row, as SQL over alias `x`. */
const STUDIO = (x: string) => `(CASE WHEN ${x}.label = 'ROCKSTAR' THEN 'ROCKSTAR' WHEN ${x}.label = 'ZYNGA' THEN 'ZYNGA' ELSE '2K' END)`;

/** Home studio of a franchise column. @rs / @zy are the Rockstar / Zynga
 *  franchise lists read from Games (labels), so Players never joins Games. */
const PSTUDIO = (col: string) => `(CASE WHEN ${col} IN UNNEST(@rs) THEN 'ROCKSTAR' WHEN ${col} IN UNNEST(@zy) THEN 'ZYNGA' ELSE '2K' END)`;

/** Hash joins: the default apply-join plans scan Players per row at this size. */
const HJ = "@{JOIN_METHOD=HASH_JOIN}";

const FRIEND_PULL_PAIRS: { source: Studio; franchise: string }[] = [
  { source: "2K", franchise: "GTAO" },
  { source: "ROCKSTAR", franchise: "NBA2K" },
  { source: "ROCKSTAR", franchise: "MAFIA" },
  { source: "ZYNGA", franchise: "NBA2KMOBILE" },
  { source: "ZYNGA", franchise: "GTAO" },
];
const FRIEND_PULL_TARGETS = Array.from(new Set(FRIEND_PULL_PAIRS.map((p) => p.franchise)));

export const PATH_GQL = `GRAPH TakeTwoPlayerGraph
MATCH (a:Player {primary_franchise: 'NBA2K'})
      -[i:INVITED {to_game_id: 'game-gta-online', accepted: true}]->(b:Player)
      -[w:WISHLISTED {game_id: 'game-gta6'}]->(g6:Game)
RETURN COUNT(DISTINCT a.player_id) AS inviters,
       COUNT(DISTINCT b.player_id) AS invitees`;

async function build(): Promise<Built> {
  const t0 = Date.now();

  const [asOfRow] = await q<{ as_of: Date | string | null }>("SELECT MAX(last_active_at) AS as_of FROM Players");
  const asOf = asOfRow?.as_of ? new Date(asOfRow.as_of as string) : new Date(0);

  const hubs = await q<{ game_id: string; title: string; franchise: string; label: string; lifecycle_status: string | null; studio: Studio }>(
    `SELECT game_id, title, franchise, label, lifecycle_status, ${STUDIO("g")} AS studio FROM Games g WHERE g.is_parent_hub = true`,
  );
  if (hubs.length === 0) throw new StageError("spanner", "Games", "No parent-hub rows in Games; the portfolio cannot be built.");
  if (!hubs.some((h) => h.studio === "ROCKSTAR") || !hubs.some((h) => h.studio === "ZYNGA")) {
    throw new StageError(
      "spanner",
      RESOURCE(),
      `No Rockstar Games or Zynga titles in Games. The Take-Two command center needs the portfolio database (t2_graph_db); SPANNER_DATABASE_ID is '${GCP_CONFIG.spannerDatabaseId}'.`,
    );
  }
  const P = {
    rs: hubs.filter((h) => h.studio === "ROCKSTAR").map((h) => h.franchise),
    zy: hubs.filter((h) => h.studio === "ZYNGA").map((h) => h.franchise),
  };

  const pathStarted = Date.now();
  const [
    perTitle,
    combos,
    totalsRow,
    crossFriends,
    pullRows,
    outsideRows,
    inviteRows,
    retentionRows,
    wishRows,
    bridgeRows,
    overlapRows,
    pathRows,
  ] = await Promise.all([
    q<{ franchise: string; players: number; primary_players: number; spend: number; churned: number; from_other: number; via_invite: number }>(
      `SELECT g.franchise,
              COUNT(*) AS players,
              COUNTIF(p.primary_franchise = g.franchise) AS primary_players,
              SUM(IFNULL(pg.spend_usd, 0)) AS spend,
              COUNTIF(p.churned_at IS NOT NULL) AS churned,
              COUNTIF(${PSTUDIO("p.primary_franchise")} != ${STUDIO("g")}) AS from_other,
              COUNTIF(pg.acquired_via = 'FRIEND_INVITE') AS via_invite
       FROM PlaysGame pg
       JOIN${HJ} Games g ON g.game_id = pg.game_id
       JOIN${HJ} Players p ON p.player_id = pg.player_id
       GROUP BY g.franchise`,
      P,
    ),
    q<{ k2: boolean; rs: boolean; zy: boolean; n: number; spend: number; churned: number }>(
      `WITH reach AS (
         SELECT pg.player_id,
                LOGICAL_OR(g.label NOT IN ('ROCKSTAR', 'ZYNGA')) AS k2,
                LOGICAL_OR(g.label = 'ROCKSTAR') AS rs,
                LOGICAL_OR(g.label = 'ZYNGA') AS zy,
                SUM(IFNULL(pg.spend_usd, 0)) AS spend
         FROM PlaysGame pg JOIN${HJ} Games g ON g.game_id = pg.game_id
         GROUP BY pg.player_id)
       SELECT r.k2, r.rs, r.zy, COUNT(*) AS n, SUM(r.spend) AS spend, COUNTIF(p.churned_at IS NOT NULL) AS churned
       FROM reach r JOIN${HJ} Players p ON p.player_id = r.player_id
       GROUP BY r.k2, r.rs, r.zy`,
    ),
    q<{ players: number; churned_14d: number }>(
      `SELECT COUNT(*) AS players,
              COUNTIF(churned_at IS NOT NULL AND churned_at > TIMESTAMP_SUB(@as_of, INTERVAL 14 DAY)) AS churned_14d
       FROM Players`,
      { as_of: asOf },
    ),
    q<{ n: number }>(
      `WITH ps AS (SELECT player_id, ${PSTUDIO("primary_franchise")} AS studio FROM Players)
       SELECT COUNT(*) AS n FROM FriendsWith f
       JOIN${HJ} ps a ON a.player_id = f.player_id
       JOIN${HJ} ps b ON b.player_id = f.other_player_id
       WHERE a.studio != b.studio`,
      P,
    ),
    // Rows exist only for (player, title) pairs with a friend in the title or
    // an adoption; "without a friend" n is derived from the outside totals below.
    q<{ studio: Studio; franchise: string; has_friend: number; n: number; adopted: number }>(
      `WITH f AS (SELECT player_id AS a, other_player_id AS b FROM FriendsWith
                  UNION ALL SELECT other_player_id AS a, player_id AS b FROM FriendsWith),
       tp AS (SELECT DISTINCT pg.player_id, g.franchise FROM PlaysGame pg JOIN${HJ} Games g ON g.game_id = pg.game_id
              WHERE g.franchise IN UNNEST(@targets)),
       flags AS (
         SELECT player_id, franchise, MAX(friend) AS has_friend, MAX(adopted) AS adopted FROM (
           SELECT f.a AS player_id, tp.franchise, 1 AS friend, 0 AS adopted FROM f JOIN${HJ} tp ON tp.player_id = f.b
           UNION ALL SELECT player_id, franchise, 0 AS friend, 1 AS adopted FROM tp)
         GROUP BY player_id, franchise),
       ps AS (SELECT player_id, ${PSTUDIO("primary_franchise")} AS studio FROM Players)
       SELECT ps.studio, fl.franchise, fl.has_friend, COUNT(*) AS n, SUM(fl.adopted) AS adopted
       FROM flags fl JOIN${HJ} ps ON ps.player_id = fl.player_id
       WHERE CONCAT(ps.studio, '|', fl.franchise) IN UNNEST(@pairs)
       GROUP BY ps.studio, fl.franchise, fl.has_friend`,
      { ...P, targets: FRIEND_PULL_TARGETS, pairs: FRIEND_PULL_PAIRS.map((p) => `${p.source}|${p.franchise}`) },
    ),
    q<{ studio: Studio; n: number }>(`SELECT ${PSTUDIO("primary_franchise")} AS studio, COUNT(*) AS n FROM Players GROUP BY studio`, P),
    q<{ from_studio: Studio; to_studio: Studio; sent: number; accepted: number }>(
      // from = the invitee's home studio (where they came from), to = the title's studio.
      `SELECT ${PSTUDIO("p.primary_franchise")} AS from_studio, ${STUDIO("tg")} AS to_studio,
              COUNT(*) AS sent, COUNTIF(i.accepted) AS accepted
       FROM Invited i
       JOIN${HJ} Players p ON p.player_id = i.invitee_id
       JOIN Games tg ON tg.game_id = i.to_game_id
       GROUP BY from_studio, to_studio`,
      P,
    ),
    q<{ via: string; players: number; churned: number }>(
      `SELECT IFNULL(pg.acquired_via, 'ORGANIC') AS via, COUNT(DISTINCT pg.player_id) AS players,
              COUNT(DISTINCT IF(p.churned_at IS NOT NULL, pg.player_id, NULL)) AS churned
       FROM PlaysGame pg
       JOIN${HJ} Games g ON g.game_id = pg.game_id
       JOIN${HJ} Players p ON p.player_id = pg.player_id
       WHERE ${PSTUDIO("p.primary_franchise")} != ${STUDIO("g")}
       GROUP BY via`,
      P,
    ),
    q<{ studio: Studio; players: number; wishlisted: number }>(
      `SELECT ${PSTUDIO("p.primary_franchise")} AS studio, COUNT(*) AS players, COUNTIF(w.player_id IS NOT NULL) AS wishlisted
       FROM Players p
       LEFT JOIN${HJ} Wishlisted w ON w.player_id = p.player_id AND w.game_id = 'game-gta6'
       GROUP BY studio`,
      P,
    ),
    q<{ player_id: string; gamer_tag: string; primary_franchise: string; studio: Studio; other_friends: number; invites_accepted: number; studios: string[] }>(
      `WITH ps AS (SELECT player_id, ${PSTUDIO("primary_franchise")} AS studio FROM Players),
       f AS (SELECT player_id AS a, other_player_id AS b FROM FriendsWith
             UNION ALL SELECT other_player_id AS a, player_id AS b FROM FriendsWith),
       cross_f AS (SELECT f.a AS player_id, COUNT(*) AS n FROM f
                   JOIN${HJ} ps sa ON sa.player_id = f.a
                   JOIN${HJ} ps sb ON sb.player_id = f.b
                   WHERE sa.studio != sb.studio GROUP BY f.a),
       top AS (SELECT player_id, n FROM cross_f ORDER BY n DESC, player_id LIMIT 5)
       SELECT p.player_id, p.gamer_tag, p.primary_franchise, ${PSTUDIO("p.primary_franchise")} AS studio, top.n AS other_friends,
              (SELECT COUNT(*) FROM Invited i WHERE i.player_id = p.player_id AND i.accepted) AS invites_accepted,
              ARRAY(SELECT DISTINCT ${STUDIO("g")} FROM PlaysGame pg JOIN Games g ON g.game_id = pg.game_id
                    WHERE pg.player_id = p.player_id) AS studios
       FROM top JOIN Players p ON p.player_id = top.player_id
       ORDER BY top.n DESC, p.player_id`,
      P,
    ),
    q<{ a: string; b: string; n: number }>(
      `SELECT a, b, COUNT(*) AS n
       FROM Players p, UNNEST(p.franchises_played) AS a, UNNEST(p.franchises_played) AS b
       GROUP BY a, b`,
    ),
    q<{ inviters: number; invitees: number }>(PATH_GQL),
  ]);
  const pathMs = Date.now() - pathStarted;

  const hubBy = new Map(hubs.map((h) => [h.franchise, h]));
  const titleOf = (f: string) => hubBy.get(f)?.title ?? f;

  const franchises: PortfolioFranchise[] = perTitle
    .filter((r) => hubBy.has(r.franchise))
    .map((r) => {
      const h = hubBy.get(r.franchise)!;
      const players = num(r.players);
      const churned = num(r.churned);
      return {
        franchise: r.franchise,
        game_id: h.game_id,
        title: h.title,
        label: h.label,
        studio: h.studio,
        lifecycle_status: h.lifecycle_status,
        players,
        primary_players: num(r.primary_players),
        spend_usd: Math.round(num(r.spend)),
        churned,
        churn_rate: players ? churned / players : 0,
        from_other_studios: num(r.from_other),
        via_invite: num(r.via_invite),
      };
    })
    .sort((a, b) => b.players - a.players);
  // Pre-launch titles have no PlaysGame rows; keep them visible with zeros.
  for (const h of hubs) {
    if (!franchises.some((f) => f.franchise === h.franchise)) {
      franchises.push({
        franchise: h.franchise, game_id: h.game_id, title: h.title, label: h.label, studio: h.studio,
        lifecycle_status: h.lifecycle_status, players: 0, primary_players: 0, spend_usd: 0, churned: 0,
        churn_rate: 0, from_other_studios: 0, via_invite: 0,
      });
    }
  }

  // Studio combinations + reach.
  const venn: Record<string, number> = {};
  const reach = new Map<number, { players: number; spend: number; churned: number }>();
  const studioAgg = new Map<Studio, { players: number; shared: number; spend: number; churned: number }>();
  for (const r of combos) {
    const set: Studio[] = [];
    if (r.k2) set.push("2K");
    if (r.rs) set.push("ROCKSTAR");
    if (r.zy) set.push("ZYNGA");
    const n = num(r.n);
    venn[set.join("+")] = (venn[set.join("+")] ?? 0) + n;
    const k = set.length;
    const cur = reach.get(k) ?? { players: 0, spend: 0, churned: 0 };
    reach.set(k, { players: cur.players + n, spend: cur.spend + num(r.spend), churned: cur.churned + num(r.churned) });
    for (const s of set) {
      const a = studioAgg.get(s) ?? { players: 0, shared: 0, spend: 0, churned: 0 };
      studioAgg.set(s, { players: a.players + n, shared: a.shared + (k >= 2 ? n : 0), spend: a.spend, churned: a.churned + num(r.churned) });
    }
  }
  for (const f of franchises) {
    const a = studioAgg.get(f.studio);
    if (a) a.spend += f.spend_usd;
  }
  const studios: StudioSummary[] = (["2K", "ROCKSTAR", "ZYNGA"] as Studio[]).map((s) => {
    const a = studioAgg.get(s) ?? { players: 0, shared: 0, spend: 0, churned: 0 };
    return {
      studio: s,
      players: a.players,
      titles: hubs.filter((h) => h.studio === s).length,
      spend_usd: Math.round(a.spend),
      churn_rate: a.players ? a.churned / a.players : 0,
      shared_share: a.players ? a.shared / a.players : 0,
    };
  });
  const spend_by_reach = [1, 2, 3]
    .filter((k) => reach.has(k))
    .map((k) => {
      const r = reach.get(k)!;
      return { studios: k, players: r.players, avg_spend_usd: r.players ? r.spend / r.players : 0, churn_rate: r.players ? r.churned / r.players : 0 };
    });

  const multi = spend_by_reach.filter((r) => r.studios >= 2).reduce((s, r) => s + r.players, 0);
  const totalReach = spend_by_reach.reduce((s, r) => s + r.players, 0);

  // Friend pull.
  const friend_pull: FriendPull[] = FRIEND_PULL_PAIRS.filter((p) => hubBy.has(p.franchise)).map(({ source, franchise: t }) => {
    const st = hubBy.get(t)!.studio;
    const outside = outsideRows.filter((r) => r.studio === source).reduce((s, r) => s + num(r.n), 0);
    const w = pullRows.find((r) => r.studio === source && r.franchise === t && num(r.has_friend) === 1);
    const wo = pullRows.find((r) => r.studio === source && r.franchise === t && num(r.has_friend) === 0);
    const wN = num(w?.n);
    const woN = Math.max(0, outside - wN);
    const rw = wN ? num(w?.adopted) / wN : 0;
    const rwo = woN ? num(wo?.adopted) / woN : 0;
    return {
      source,
      franchise: t,
      title: titleOf(t),
      studio: st,
      with_friend: { n: wN, adopted: num(w?.adopted), rate: rw },
      without_friend: { n: woN, adopted: num(wo?.adopted), rate: rwo },
      lift: rwo > 0 ? rw / rwo : null,
    };
  });

  const invites: InviteFlow[] = inviteRows
    .map((r) => ({ from: r.from_studio, to: r.to_studio, sent: num(r.sent), accepted: num(r.accepted) }))
    .sort((a, b) => b.accepted - a.accepted);

  const invite_retention = retentionRows
    .map((r) => ({ via: r.via, players: num(r.players), churn_rate: num(r.players) ? num(r.churned) / num(r.players) : 0 }))
    .sort((a, b) => b.players - a.players);

  const gta6 = {
    total: wishRows.reduce((s, r) => s + num(r.wishlisted), 0),
    by_studio: wishRows
      .map((r) => ({ studio: r.studio, wishlisted: num(r.wishlisted), players: num(r.players), rate: num(r.players) ? num(r.wishlisted) / num(r.players) : 0 }))
      .sort((a, b) => b.wishlisted - a.wishlisted),
  };

  const bridges = bridgeRows.map((r) => ({
    player_id: r.player_id,
    gamer_tag: r.gamer_tag,
    primary_title: titleOf(r.primary_franchise),
    studio: r.studio,
    studios: ((r.studios ?? []) as Studio[]).sort(),
    other_studio_friends: num(r.other_friends),
    invites_accepted: num(r.invites_accepted),
  }));

  // Title overlap over hub franchises (exclude pre-launch with zero players), ordered by size.
  const order = franchises.filter((f) => f.players > 0).map((f) => f.franchise);
  const counts: Record<string, number> = {};
  const pair = new Map<string, number>();
  for (const r of overlapRows) {
    if (r.a === r.b) counts[r.a] = num(r.n);
    else pair.set(`${r.a}|${r.b}`, num(r.n));
  }
  const share = order.map((a) => order.map((b) => (a === b ? 1 : counts[a] ? (pair.get(`${a}|${b}`) ?? 0) / counts[a] : 0)));

  return {
    as_of: asOfRow?.as_of ? asOf.toISOString() : null,
    totals: {
      players: num(totalsRow[0]?.players),
      multi_studio_players: multi,
      multi_studio_share: totalReach ? multi / totalReach : 0,
      cross_studio_friendships: num(crossFriends[0]?.n),
      spend_usd: Math.round(franchises.reduce((s, f) => s + f.spend_usd, 0)),
      churned_14d: num(totalsRow[0]?.churned_14d),
      invites_accepted: invites.reduce((s, r) => s + r.accepted, 0),
    },
    studios,
    venn,
    spend_by_reach,
    franchises,
    friend_pull,
    invites,
    invite_retention,
    gta6,
    bridges,
    path: {
      label: "NBA 2K players who brought a friend into GTA Online, where that friend has GTA VI wishlisted",
      query: PATH_GQL,
      inviters: num(pathRows[0]?.inviters),
      invitees: num(pathRows[0]?.invitees),
      latency_ms: pathMs,
    },
    overlap: { franchises: order, share, counts },
    source: { engine: "spanner", database: GCP_CONFIG.spannerDatabaseId, instance: GCP_CONFIG.spannerInstanceId, graph: "TakeTwoPlayerGraph" },
    latency_ms: Date.now() - t0,
  };
}

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const hit = g.__portfolioCache;
  if (!fresh && hit && hit.db === GCP_CONFIG.spannerDatabaseId) {
    const age = Date.now() - hit.at;
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({ ...hit.value, cache: "hit", computed_at: new Date(hit.at).toISOString() } satisfies PortfolioResponse);
    }
    // Stale-while-revalidate: answer instantly with the last live result (labelled
    // "stale" with its computed_at) and recompute from Spanner in the background.
    // A failed refresh is logged and the next request retries; it never replaces live data.
    rebuild().catch((e) => console.error("[api/v2/portfolio] background refresh failed", e));
    return NextResponse.json({ ...hit.value, cache: "stale", computed_at: new Date(hit.at).toISOString() } satisfies PortfolioResponse);
  }
  try {
    const { at, value } = await rebuild();
    return NextResponse.json({ ...value, cache: "miss", computed_at: new Date(at).toISOString() } satisfies PortfolioResponse);
  } catch (e) {
    const err = e as StageError;
    console.error("[api/v2/portfolio]", err);
    return NextResponse.json(
      {
        error: `Portfolio build failed in ${err.service ?? "unknown"}`,
        service: err.service ?? "unknown",
        resource: err.resource ?? null,
        message: err.message,
      },
      { status: 503 },
    );
  }
}
