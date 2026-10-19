/**
 * Server side of the cross-franchise plays: live Spanner Graph audiences.
 * Every audience is one GQL traversal on TakeTwoPlayerGraph (t2_graph_db),
 * parameterized with @params, cached in-process for an hour (static demo
 * snapshot; ?fresh=1 on the route recomputes). Failures throw with the GQL.
 */
import { getDatabase } from "@/lib/gcp/spanner-client";
import { GCP_CONFIG } from "@/lib/config";
import {
  FRANCHISE_GAME,
  FRANCHISE_TITLE,
  PLAYS,
  STUDIO_FRANCHISES,
  TWOK_FRANCHISES,
  WARM_PAIRS,
  type AudienceMember,
  type AudienceResponse,
  type PlayId,
} from "./plays";

export class PlayQueryError extends Error {
  constructor(public play: string, public gql: string, cause: Error) {
    super(`${cause.message}`);
  }
}

interface AudienceQuery {
  gql: string;
  params: Record<string, unknown>;
  signalLabel: string | null;
}

const NBA = ["NBA2K", "NBA2K26", "NBA2KMOBILE"];

async function asOf(): Promise<Date> {
  const [rows] = await getDatabase().run({ sql: "SELECT MAX(last_active_at) AS as_of FROM Players" });
  const v = rows[0]?.toJSON().as_of;
  if (!v) throw new Error("Players.last_active_at is empty");
  return new Date(v as string);
}

export async function audienceQuery(play: PlayId, segment: string): Promise<AudienceQuery> {
  const base = `RETURN p.player_id AS player_id, p.gamer_tag AS gamer_tag, p.primary_franchise AS primary_franchise,
       p.primary_archetype AS primary_archetype, p.lifetime_spend_usd AS lifetime_spend_usd,
       p.churn_risk_score AS churn_risk_score`;
  if (play === "warm_intro") {
    const pair = WARM_PAIRS.find((p) => p.id === segment);
    if (!pair) throw new Error(`Unknown warm_intro segment '${segment}'`);
    return {
      gql: `GRAPH TakeTwoPlayerGraph
MATCH (g:Game {game_id: @target_game})<-[:PLAYS_GAME]-(f:Player)-[:FRIENDS_WITH]-(p:Player)
WHERE p.primary_franchise IN UNNEST(@home_franchises)
  AND p.churned_at IS NULL
  AND NOT @target IN UNNEST(p.franchises_played)
${base},
       COUNT(DISTINCT f.player_id) AS signal
ORDER BY signal DESC, player_id`,
      params: { target_game: FRANCHISE_GAME[pair.franchise], target: pair.franchise, home_franchises: [...STUDIO_FRANCHISES[pair.source]] },
      signalLabel: `friends already in ${FRANCHISE_TITLE[pair.franchise]}`,
    };
  }
  if (play === "gta6_window") {
    if (segment === "shield") {
      return {
        gql: `GRAPH TakeTwoPlayerGraph
MATCH (g:Game {game_id: 'game-gta6'})<-[w:WISHLISTED]-(p:Player)
WHERE p.churned_at IS NULL
  AND p.primary_franchise IN UNNEST(@nba)
${base},
       p.session_min_7d AS signal
ORDER BY signal DESC, player_id`,
        params: { nba: NBA },
        signalLabel: "2K minutes played, last 7 days",
      };
    }
    if (segment === "halo") {
      return {
        gql: `GRAPH TakeTwoPlayerGraph
MATCH (g:Game {game_id: 'game-gta6'})<-[w:WISHLISTED]-(p:Player)
WHERE p.churned_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM UNNEST(p.franchises_played) AS fr WHERE fr IN UNNEST(@twok))
${base},
       ARRAY_LENGTH(p.franchises_played) AS signal
ORDER BY lifetime_spend_usd DESC, player_id`,
        params: { twok: [...TWOK_FRANCHISES] },
        signalLabel: "Take-Two titles played",
      };
    }
    if (segment === "day_one") {
      // Friends-of-wishlisters minus wishlisters. The GQL form of this anti-join
      // re-traverses ~11k wishlisters x 200k friendships (~23s on 100 PU); the
      // same graph tables queried with hash joins answer in a few seconds.
      const H = "@{JOIN_METHOD=HASH_JOIN}";
      return {
        gql: `-- Spanner SQL over the graph's node/edge tables (WISHLISTED, FRIENDS_WITH, Player)
WITH w AS (SELECT player_id FROM Wishlisted WHERE game_id = 'game-gta6'),
f AS (SELECT player_id AS a, other_player_id AS b FROM FriendsWith
      UNION ALL SELECT other_player_id AS a, player_id AS b FROM FriendsWith),
cand AS (SELECT f.a AS player_id, COUNT(DISTINCT f.b) AS signal
         FROM f JOIN${H} w ON w.player_id = f.b GROUP BY f.a)
SELECT p.player_id, p.gamer_tag, p.primary_franchise, p.primary_archetype,
       p.lifetime_spend_usd, p.churn_risk_score, c.signal
FROM cand c
JOIN${H} Players p ON p.player_id = c.player_id
LEFT JOIN${H} w w2 ON w2.player_id = c.player_id
WHERE w2.player_id IS NULL AND p.churned_at IS NULL
ORDER BY c.signal DESC, p.player_id`,
        params: {},
        signalLabel: "friends with GTA VI wishlisted",
      };
    }
    throw new Error(`Unknown gta6_window segment '${segment}'`);
  }
  if (play === "save_elsewhere") {
    const at = await asOf();
    return {
      gql: `GRAPH TakeTwoPlayerGraph
MATCH (p:Player)-[pg:PLAYS_GAME]->(g:Game)
WHERE p.primary_franchise IN UNNEST(@twok)
  AND p.churned_at IS NULL
  AND p.session_min_prev_7d > 0
  AND p.session_min_7d < 0.7 * p.session_min_prev_7d
  AND g.label IN ('ROCKSTAR', 'ZYNGA')
  AND TIMESTAMP(pg.last_played_timestamp) >= TIMESTAMP_SUB(@as_of, INTERVAL 7 DAY)
${base},
       ROUND(1 - p.session_min_7d / p.session_min_prev_7d, 2) AS signal,
       COUNT(DISTINCT g.game_id) AS active_titles
ORDER BY signal DESC, player_id`,
      params: { twok: [...TWOK_FRANCHISES], as_of: at },
      signalLabel: "2K session drop, week over week",
    };
  }
  throw new Error(`Unknown play '${play}'`);
}

const TTL = 60 * 60 * 1000;
const g = globalThis as unknown as { __playAudience?: Map<string, { at: number; members: AudienceMember[]; response: Omit<AudienceResponse, "cache"> }> };
const cache = (g.__playAudience ??= new Map());

const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function getAudience(play: PlayId, segment: string, fresh = false): Promise<{ members: AudienceMember[]; response: AudienceResponse }> {
  if (!PLAYS[play]) throw new Error(`Unknown play '${play}'`);
  const key = `${GCP_CONFIG.spannerDatabaseId}|${play}|${segment}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL) return { members: hit.members, response: { ...hit.response, cache: "hit" } };

  const t0 = Date.now();
  const q = await audienceQuery(play, segment);
  let rows: Record<string, unknown>[];
  try {
    const [r] = await getDatabase().run({ sql: q.gql, params: q.params });
    rows = r.map((x) => x.toJSON() as Record<string, unknown>);
  } catch (e) {
    throw new PlayQueryError(play, q.gql, e as Error);
  }
  const members: AudienceMember[] = rows.map((r) => ({
    player_id: String(r.player_id),
    gamer_tag: String(r.gamer_tag),
    primary_franchise: String(r.primary_franchise),
    primary_archetype: String(r.primary_archetype),
    lifetime_spend_usd: num(r.lifetime_spend_usd),
    churn_risk_score: num(r.churn_risk_score),
    signal: r.signal == null ? null : Number(r.signal),
  }));
  const n = members.length;
  const tally = (key: (m: AudienceMember) => string) => {
    const c = new Map<string, number>();
    for (const m of members) c.set(key(m), (c.get(key(m)) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  };
  const withSignal = members.filter((m) => m.signal != null);
  const response: Omit<AudienceResponse, "cache"> = {
    play,
    segment,
    count: n,
    sample: members.slice(0, 8),
    stats: {
      avg_spend_usd: n ? members.reduce((s, m) => s + m.lifetime_spend_usd, 0) / n : 0,
      avg_churn_risk: n ? members.reduce((s, m) => s + m.churn_risk_score, 0) / n : 0,
      avg_signal: withSignal.length ? withSignal.reduce((s, m) => s + (m.signal ?? 0), 0) / withSignal.length : null,
      signal_label: q.signalLabel,
      top_archetypes: tally((m) => m.primary_archetype).map(([name, c]) => ({ name, share: c / Math.max(1, n) })),
      top_home_titles: tally((m) => m.primary_franchise).map(([f, c]) => ({ franchise: f, title: FRANCHISE_TITLE[f] ?? f, share: c / Math.max(1, n) })),
    },
    gql: q.gql,
    database: GCP_CONFIG.spannerDatabaseId,
    latency_ms: Date.now() - t0,
    computed_at: new Date().toISOString(),
  };
  cache.set(key, { at: Date.now(), members, response });
  return { members, response: { ...response, cache: "miss" } };
}

/** Telemetry-rich rows for persona hydration (pressure test). */
export async function hydratePersonas(ids: string[]) {
  const sql = `SELECT p.player_id, p.gamer_tag, p.primary_franchise, p.primary_archetype, p.franchises_played,
                      p.lifetime_spend_usd, p.churn_risk_score, p.age, p.country, p.account_tenure_days,
                      p.session_min_7d, p.session_min_prev_7d, TO_JSON_STRING(p.game_telemetry) AS telemetry,
                      (SELECT COUNT(*) FROM FriendsWith f WHERE f.player_id = p.player_id OR f.other_player_id = p.player_id) AS friends,
                      (SELECT c.name FROM MemberOfClan m JOIN Clans c ON c.clan_id = m.clan_id
                        WHERE m.player_id = p.player_id AND m.is_active LIMIT 1) AS crew
               FROM Players p WHERE p.player_id IN UNNEST(@ids)`;
  try {
    const [rows] = await getDatabase().run({ sql, params: { ids } });
    return rows.map((r) => r.toJSON() as Record<string, unknown>);
  } catch (e) {
    throw new PlayQueryError("persona hydration", sql, e as Error);
  }
}
