/**
 * Player 360 + Social Graph (agenda Section B) — live Spanner Graph queries
 * against `twok_graph_db_v2` / `TakeTwoPlayerGraph`.
 *
 * Every pillar hangs off the same Player node:
 *   Crew pillar     Player -MEMBER_OF-> Crew -COMPETED_IN-> Match -IN_SEASON-> Season
 *   Creator pillar  Player -LINKED_TO-> ViewerAccount -WATCHED-> Stream <-HOSTED- Creator
 *   Brand pillar    Player -BOUGHT|EQUIPPED-> Item <-FEATURES- Activation <-SPONSORS- Brand
 *   Social          Player -PLAYED_WITH|FRIENDS_WITH|MESSAGED- Player (undirected)
 *
 * Zero fallbacks: any Spanner failure throws `Player360QueryError` carrying the
 * failing query label so the route can answer 503 with exact diagnostics.
 */
import { FRANCHISE_TITLE, studioOfFranchise, type Studio } from "./plays";
import { GCP_CONFIG } from "@/lib/config";
import { runRawGql, toNumber, GRAPH_NAME } from "@/lib/gcp/spanner-client";

// ---------------------------------------------------------------------------
// Types (client components import these with `import type`)
// ---------------------------------------------------------------------------

export type P360NodeKind =
  | "player"
  | "crew"
  | "match"
  | "season"
  | "account"
  | "stream"
  | "creator"
  | "item"
  | "activation"
  | "brand"
  | "neighbor";

export type P360Pillar = "center" | "crew" | "creator" | "brand" | "social";

export type P360EdgeKind =
  | "MEMBER_OF"
  | "COMPETED_IN"
  | "IN_SEASON"
  | "LINKED_TO"
  | "WATCHED"
  | "HOSTED"
  | "BOUGHT"
  | "EQUIPPED"
  | "FEATURES"
  | "SPONSORS"
  | "MADE_BY"
  | "PLAYED_WITH"
  | "FRIENDS_WITH"
  | "MESSAGED";

export interface P360Player {
  player_id: string;
  gamer_tag: string;
  display_name: string;
  archetype: string;
  ovr: number | null;
  vc: number | null;
  churn_risk: number;
  lifetime_spend_usd: number;
  session_min_7d: number | null;
  session_min_prev_7d: number | null;
  /** session_min_7d / session_min_prev_7d (null when prev week is 0). */
  session_ratio: number | null;
  churned_at: string | null;
  last_active_at: string | null;
  community_id: string | null;
  keystone: boolean;
}

export interface P360Crew {
  clan_id: string;
  name: string;
  tier: string | null;
  role: string | null;
  joined_at: string | null;
  is_active: boolean;
  crew_centrality: number | null;
  member_count: number | null;
}

export interface P360Match {
  match_id: string;
  clan_id: string;
  mode: string | null;
  played_at: string | null;
  result: string | null;
  score_diff: number | null;
  season_id: string | null;
}

export interface P360Season {
  season_id: string;
  name: string;
}

export interface P360Account {
  identity_id: string;
  platform: string;
  handle: string | null;
}

export interface P360Stream {
  stream_id: string;
  identity_id: string;
  creator_id: string;
  title: string;
  platform: string | null;
  peak_viewers: number | null;
  watch_minutes: number;
  watched_at: string | null;
}

export interface P360Creator {
  creator_id: string;
  handle: string;
  name: string | null;
  followers: number | null;
  hub_score: number | null;
}

export interface P360Item {
  item_id: string;
  name: string;
  item_type: string | null;
  brand_id: string | null;
  is_branded: boolean;
  vc_price: number | null;
  bought: boolean;
  equipped: boolean;
  bought_at: string | null;
  vc_amount: number | null;
  via_activation_id: string | null;
}

export interface P360Activation {
  activation_id: string;
  brand_id: string;
  title: string;
  kind: string | null;
  item_ids: string[];
}

export interface P360Brand {
  brand_id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
}

export interface P360Node {
  id: string;
  kind: P360NodeKind;
  pillar: P360Pillar;
  /** 0 = center, 1 = player's own pillars + direct neighbors, 2 = neighbors' entities. */
  hop: 0 | 1 | 2;
  label: string;
  sub?: string;
  /** Neighbor players only. */
  churned?: boolean;
  churned_recent?: boolean;
  keystone?: boolean;
  /** Neighbor players only: the other label whose titles they also play
   *  (ROCKSTAR > ZYNGA), else their home label. Drives the cross-label colour. */
  studio?: Studio;
  churn_risk?: number;
  same_crew?: boolean;
  /** 0..1 tie strength to the center (neighbors) or relative weight. */
  weight: number;
  /** For hop-2 nodes: how many rendered neighbors connect to it. */
  degree?: number;
}

export interface P360Link {
  id: string;
  source: string;
  target: string;
  kind: P360EdgeKind;
  /** 0..1, drives stroke width. */
  weight: number;
  hop: 1 | 2;
  /** Raw edge facts for the tooltip. */
  detail?: string;
}

export interface P360LikeYouItem {
  item_id: string;
  name: string;
  item_type: string | null;
  brand_id: string | null;
  brand_name: string | null;
  vc_price: number | null;
  buyers_1hop: number;
  buyers_2hop: number;
  score: number;
}

export interface P360QueryStep {
  label: string;
  gql: string;
  ms: number;
  rows: number;
}

export interface Player360Response {
  player: P360Player;
  hops: 1 | 2;
  pillars: {
    crew: { crews: P360Crew[]; matches: P360Match[]; seasons: P360Season[] };
    creator: { accounts: P360Account[]; streams: P360Stream[]; creators: P360Creator[] };
    brand: { items: P360Item[]; activations: P360Activation[]; brands: P360Brand[] };
  };
  social: {
    nodes: P360Node[];
    links: P360Link[];
    totals: { played_with: number; friends_with: number; messaged: number };
    /** Render caps. Totals above are the true counts; nodes/links are capped. */
    caps: Record<string, number>;
    capped: boolean;
  };
  metrics: {
    churn_exposure: { value: number; churned_14d: number; coplay_neighbors: number };
    crew_centrality: { value: number | null; percentile: number | null; crew: string | null };
    keystone: {
      value: boolean;
      top_decile: boolean;
      declining: boolean;
      session_ratio: number | null;
      keystone_threshold: number | null;
    };
    players_like_you_bought: P360LikeYouItem[];
    players_like_you_method: string;
  };
  /** Present only on the Take-Two portfolio database (2K + Rockstar + Zynga). */
  cross_label?: P360CrossLabel;
  gql: string;
  gql_steps: P360QueryStep[];
  source: { service: "Cloud Spanner"; project: string; instance: string; database: string; graph: string };
  latency_ms: number;
}

export interface P360CrossLabel {
  home_studio: Studio;
  titles: { franchise: string; title: string; studio: Studio; spend_usd: number; last_played: string | null }[];
  /** Friends (FRIENDS_WITH) who also play another label's titles. */
  friends: { total: number; rockstar: number; zynga: number; twok: number };
  /** Co-play partners (PLAYED_WITH) whose home label differs from the player's. */
  coplay_other_label: number;
  gta6_wishlisted: boolean;
  invites: { sent_accepted: number; joined_by_invite: number };
}

const weekAgoFor = (asOf: Date) => asOf.getTime() - 7 * 86400000;

let portfolioSchema: Promise<boolean> | null = null;
/** True when the database carries the Take-Two portfolio extension (Invited table). Cached per process. */
export function hasPortfolio(): Promise<boolean> {
  portfolioSchema ??= runRawGql(`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name = 'Invited'`)
    .then((r) => Number(r[0]?.n ?? 0) > 0)
    .catch((e) => {
      portfolioSchema = null;
      throw e;
    });
  return portfolioSchema;
}

const QX = {
  titles: `
    SELECT g.franchise AS franchise, ANY_VALUE(h.title) AS title, ANY_VALUE(h.label) AS label,
           SUM(IFNULL(pg.spend_usd, 0)) AS spend, MAX(pg.last_played_timestamp) AS last_played
    FROM PlaysGame pg
    JOIN Games g ON g.game_id = pg.game_id
    JOIN Games h ON h.franchise = g.franchise AND h.is_parent_hub = true
    WHERE pg.player_id = @pid
    GROUP BY g.franchise
    ORDER BY spend DESC`,
  extras: `
    SELECT (SELECT COUNT(*) FROM Wishlisted WHERE player_id = @pid AND game_id = 'game-gta6') AS wish,
           (SELECT COUNT(*) FROM Invited WHERE player_id = @pid AND accepted) AS sent_accepted,
           (SELECT COUNT(*) FROM Invited WHERE invitee_id = @pid AND accepted) AS joined_by_invite`,
};

export interface FeaturedPlayerResponse {
  player_id: string;
  gamer_tag: string;
  reason: string;
  crew: string;
  crew_centrality: number;
  keystone_threshold: number;
  session_ratio: number;
  coplay_neighbors: number;
  churned_neighbors_14d: number;
  candidates_considered: number;
  gql: string;
  gql_steps: P360QueryStep[];
  latency_ms: number;
}

// ---------------------------------------------------------------------------
// Errors + query runner
// ---------------------------------------------------------------------------

export class Player360QueryError extends Error {
  readonly label: string;
  readonly gql: string;
  readonly cause?: unknown;
  constructor(label: string, gql: string, cause: unknown) {
    const msg = (cause as any)?.message ?? String(cause);
    super(`Spanner query "${label}" failed: ${msg}`);
    this.name = "Player360QueryError";
    this.label = label;
    this.gql = gql;
    this.cause = cause;
  }
}

export class PlayerNotFoundError extends Error {
  constructor(id: string) {
    super(`Player ${id} not found in ${GCP_CONFIG.spannerDatabaseId}`);
    this.name = "PlayerNotFoundError";
  }
}

export function spannerSource() {
  return {
    service: "Cloud Spanner" as const,
    project: GCP_CONFIG.projectId,
    instance: GCP_CONFIG.spannerInstanceId,
    database: GCP_CONFIG.spannerDatabaseId,
    graph: GRAPH_NAME,
  };
}

class QueryLog {
  steps: P360QueryStep[] = [];
  async run(label: string, gql: string, params?: Record<string, any>): Promise<any[]> {
    const t0 = Date.now();
    try {
      const rows = await runRawGql(gql, params);
      this.steps.push({ label, gql: dedent(gql), ms: Date.now() - t0, rows: rows.length });
      return rows;
    } catch (e) {
      throw new Player360QueryError(label, dedent(gql), e);
    }
  }
  text(): string {
    return this.steps.map((s) => `-- ${s.label} (${s.ms} ms, ${s.rows} rows)\n${s.gql}`).join("\n\n");
  }
}

function dedent(s: string): string {
  const lines = s.replace(/^\n+/, "").replace(/\s+$/, "").split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = toNumber(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: any): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function ts(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v?.toISOString === "function") return v.toISOString();
  return String(v);
}

function tsMs(v: string | null): number | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function round(n: number, d = 3): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

const DAY_MS = 86_400_000;
const CHURN_WINDOW_DAYS = 14;
/** Canonical (Data agent / validator): keystone = active membership with crew_centrality >= 0.9. */
export const KEYSTONE_CENTRALITY = 0.9;
/** Canonical: keystone at risk = keystone AND session_min_7d / session_min_prev_7d < 0.7. */
export const DECLINING_RATIO = 0.7;

// Render caps (a drawing budget, never an audience size).
export const P360_CAPS = {
  played_with: 28,
  friends_with: 12,
  messaged: 12,
  neighbors_total: 40,
  matches: 5,
  accounts: 4,
  streams: 6,
  items: 6,
  activations: 4,
  hop2_crews: 10,
  hop2_creators: 8,
  hop2_brands: 6,
  like_you: 6,
} as const;

const G = `GRAPH ${GRAPH_NAME}`;

// ---------------------------------------------------------------------------
// Query text (kept as constants so the "show query" panel is exact)
// ---------------------------------------------------------------------------

const Q = {
  asOf: `
    SELECT MAX(last_active_at) AS as_of FROM Players`,

  player: `
    ${G}
    MATCH (p:Player {player_id: @pid})
    RETURN p.player_id AS player_id, p.gamer_tag AS gamer_tag, p.display_name AS display_name,
           p.primary_archetype AS archetype, p.churn_risk_score AS churn_risk,
           p.currency_balance AS vc, p.lifetime_spend_usd AS spend,
           LAX_INT64(p.game_telemetry.myplayer_ovr) AS ovr,
           p.session_min_7d AS s7, p.session_min_prev_7d AS sp7,
           p.churned_at AS churned_at, p.last_active_at AS last_active_at,
           p.primary_franchise AS primary_franchise,
           p.community_id AS community_id`,

  crew: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[m:MEMBER_OF]->(c:Crew)
    RETURN c.clan_id AS clan_id, c.name AS name, c.tier AS tier, c.member_count AS member_count,
           m.role AS role, m.joined_at AS joined_at, m.is_active AS is_active,
           m.crew_centrality AS centrality
    ORDER BY is_active DESC, joined_at DESC
    LIMIT 4`,

  matches: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[m:MEMBER_OF]->(c:Crew)-[r:COMPETED_IN]->(mt:Match)-[:IN_SEASON]->(s:Season)
    WHERE m.is_active
    RETURN c.clan_id AS clan_id, mt.match_id AS match_id, mt.mode AS mode, mt.played_at AS played_at,
           r.result AS result, r.score_diff AS score_diff, s.season_id AS season_id, s.name AS season_name
    ORDER BY played_at DESC
    LIMIT @cap`,

  accounts: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[:LINKED_TO]->(i:ViewerAccount)
    RETURN i.identity_id AS identity_id, i.platform AS platform, i.platform_handle AS handle`,

  watched: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[:LINKED_TO]->(i:ViewerAccount)-[w:WATCHED]->(st:Stream)<-[:HOSTED]-(cr:Creator)
    RETURN i.identity_id AS identity_id, st.stream_id AS stream_id, st.title AS title,
           st.platform AS platform, st.peak_viewers AS peak_viewers,
           w.watch_minutes AS watch_minutes, w.watched_at AS watched_at,
           cr.creator_id AS creator_id, cr.handle AS handle, cr.name AS creator_name,
           cr.followers AS followers, cr.hub_score AS hub_score
    ORDER BY watch_minutes DESC
    LIMIT 24`,

  bought: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[b:BOUGHT]->(it:Item)
    RETURN it.item_id AS item_id, it.name AS name, it.item_type AS item_type, it.brand_id AS brand_id,
           it.is_branded AS is_branded, it.vc_price AS vc_price,
           b.vc_amount AS vc_amount, b.bought_at AS bought_at, b.via_activation_id AS via_activation_id
    ORDER BY bought_at DESC`,

  equipped: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[e:EQUIPPED]->(it:Item)
    RETURN it.item_id AS item_id, it.name AS name, it.item_type AS item_type, it.brand_id AS brand_id,
           it.is_branded AS is_branded, it.vc_price AS vc_price, e.equipped_at AS equipped_at`,

  playedWith: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[e:PLAYED_WITH]-(n:Player)
    RETURN n.player_id AS id, n.gamer_tag AS gamer_tag, n.churned_at AS churned_at,
           n.churn_risk_score AS churn_risk, n.session_min_7d AS s7, n.session_min_prev_7d AS sp7,
           n.primary_franchise AS home, n.franchises_played AS frs,
           e.games_together_30d AS g30, e.games_together_total AS gtot,
           e.same_crew AS same_crew, e.last_played_at AS last_at
    ORDER BY g30 DESC, gtot DESC
    LIMIT 1000`,

  friendsWith: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[e:FRIENDS_WITH]-(n:Player)
    RETURN n.player_id AS id, n.gamer_tag AS gamer_tag, n.churned_at AS churned_at,
           n.churn_risk_score AS churn_risk, n.session_min_7d AS s7, n.session_min_prev_7d AS sp7,
           n.primary_franchise AS home, n.franchises_played AS frs,
           e.since AS since
    ORDER BY since ASC
    LIMIT 1000`,

  messaged: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[e:MESSAGED]-(n:Player)
    RETURN n.player_id AS id, n.gamer_tag AS gamer_tag, n.churned_at AS churned_at,
           n.churn_risk_score AS churn_risk, n.session_min_7d AS s7, n.session_min_prev_7d AS sp7,
           n.primary_franchise AS home, n.franchises_played AS frs,
           e.msg_count_30d AS msgs, e.last_msg_at AS last_at
    ORDER BY msgs DESC
    LIMIT 1000`,

  centralityDist: `
    SELECT COUNTIF(crew_centrality < @c) / COUNT(*) AS pct_below
    FROM MemberOfClan
    WHERE is_active AND crew_centrality IS NOT NULL`,

  likeYou1: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[e:PLAYED_WITH]-(n:Player)-[:BOUGHT]->(it:Item)
    RETURN DISTINCT n.player_id AS nid, it.item_id AS item_id, e.games_together_30d AS g30`,

  likeYou2: `
    ${G}
    MATCH (p:Player {player_id: @pid})-[:PLAYED_WITH]-(n1:Player)-[:PLAYED_WITH]-(n2:Player)-[:BOUGHT]->(it:Item)
    WHERE n2.player_id <> @pid
    RETURN DISTINCT n2.player_id AS nid, it.item_id AS item_id`,

  items: `
    ${G}
    MATCH (it:Item)
    WHERE it.item_id IN UNNEST(@ids)
    RETURN it.item_id AS item_id, it.name AS name, it.item_type AS item_type,
           it.brand_id AS brand_id, it.vc_price AS vc_price`,

  activations: `
    ${G}
    MATCH (br:Brand)-[:SPONSORS]->(a:Activation)-[:FEATURES]->(it:Item)
    WHERE it.item_id IN UNNEST(@ids)
    RETURN br.brand_id AS brand_id, a.activation_id AS activation_id, a.title AS title,
           a.kind AS kind, it.item_id AS item_id`,

  brands: `
    ${G}
    MATCH (br:Brand)
    RETURN br.brand_id AS brand_id, br.name AS name, br.category AS category, br.logo_url AS logo_url`,

  neighborCrews: `
    ${G}
    MATCH (n:Player)-[m:MEMBER_OF]->(c:Crew)
    WHERE n.player_id IN UNNEST(@ids) AND m.is_active
    RETURN n.player_id AS nid, c.clan_id AS clan_id, c.name AS name, c.tier AS tier,
           m.crew_centrality AS centrality`,

  neighborCreators: `
    ${G}
    MATCH (n:Player)-[:LINKED_TO]->(:ViewerAccount)-[w:WATCHED]->(:Stream)<-[:HOSTED]-(cr:Creator)
    WHERE n.player_id IN UNNEST(@ids)
    RETURN n.player_id AS nid, cr.creator_id AS creator_id, cr.handle AS handle,
           SUM(w.watch_minutes) AS minutes
    GROUP BY nid, creator_id, handle`,

  neighborBrands: `
    ${G}
    MATCH (n:Player)-[:BOUGHT]->(it:Item)
    WHERE n.player_id IN UNNEST(@ids) AND it.brand_id IS NOT NULL
    RETURN n.player_id AS nid, it.brand_id AS brand_id, COUNT(*) AS purchases
    GROUP BY nid, brand_id`,
} as const;

// ---------------------------------------------------------------------------
// Player 360
// ---------------------------------------------------------------------------

interface NeighborAgg {
  id: string;
  gamer_tag: string;
  /** Neighbor's home franchise and every franchise they play. */
  home: string | null;
  frs: string[];
  churned_at: string | null;
  churn_risk: number;
  session_ratio: number | null;
  g30: number;
  gtot: number;
  same_crew: boolean;
  friends_since: string | null;
  msgs: number;
  kinds: Set<"PLAYED_WITH" | "FRIENDS_WITH" | "MESSAGED">;
  tie: number;
}

function sessionRatio(s7: number | null, sp7: number | null): number | null {
  if (s7 === null || sp7 === null || sp7 <= 0) return null;
  return s7 / sp7;
}

export async function getPlayer360(playerId: string, hops: 1 | 2): Promise<Player360Response> {
  const started = Date.now();
  const log = new QueryLog();
  const pid = playerId;

  // ---- Round 1: everything that only needs the player id (parallel) -------
  const [
    asOfRows,
    playerRows,
    crewRows,
    matchRows,
    accountRows,
    watchedRows,
    boughtRows,
    equippedRows,
    pwRows,
    fwRows,
    msgRows,
    like1Rows,
    like2Rows,
    brandRows,
  ] = await Promise.all([
    log.run("data as-of", Q.asOf),
    log.run("player", Q.player, { pid }),
    log.run("crew pillar: membership", Q.crew, { pid }),
    log.run("crew pillar: matches + season", Q.matches, { pid, cap: P360_CAPS.matches }),
    log.run("creator pillar: viewer accounts", Q.accounts, { pid }),
    log.run("creator pillar: streams + creators", Q.watched, { pid }),
    log.run("brand pillar: bought", Q.bought, { pid }),
    log.run("brand pillar: equipped", Q.equipped, { pid }),
    log.run("social: PLAYED_WITH (churn exposure)", Q.playedWith, { pid }),
    log.run("social: FRIENDS_WITH", Q.friendsWith, { pid }),
    log.run("social: MESSAGED", Q.messaged, { pid }),
    log.run("players like you bought: 1 hop", Q.likeYou1, { pid }),
    log.run("players like you bought: 2 hop", Q.likeYou2, { pid }),
    log.run("brands", Q.brands),
  ]);

  if (!playerRows.length) throw new PlayerNotFoundError(pid);
  // Anchor every window to the data's as-of, not wall-clock time.
  const asOfIso = ts(asOfRows[0]?.as_of);
  if (!asOfIso) throw new Player360QueryError("data as-of", Q.asOf, new Error("Players.last_active_at is empty"));
  const churnCutoff = Date.parse(asOfIso) - CHURN_WINDOW_DAYS * DAY_MS;
  const pr = playerRows[0];
  const s7 = num(pr.s7);
  const sp7 = num(pr.sp7);
  const ratio = sessionRatio(s7, sp7);

  // ---- Crew pillar --------------------------------------------------------
  const crews: P360Crew[] = crewRows.map((r) => ({
    clan_id: String(r.clan_id),
    name: String(r.name),
    tier: str(r.tier),
    role: str(r.role),
    joined_at: ts(r.joined_at),
    is_active: r.is_active === true,
    crew_centrality: num(r.centrality),
    member_count: num(r.member_count),
  }));
  const activeCrew = crews.find((c) => c.is_active) ?? null;
  const matches: P360Match[] = matchRows.map((r) => ({
    match_id: String(r.match_id),
    clan_id: String(r.clan_id),
    mode: str(r.mode),
    played_at: ts(r.played_at),
    result: str(r.result),
    score_diff: num(r.score_diff),
    season_id: str(r.season_id),
  }));
  const seasonMap = new Map<string, P360Season>();
  for (const r of matchRows) {
    if (r.season_id) seasonMap.set(String(r.season_id), { season_id: String(r.season_id), name: String(r.season_name ?? r.season_id) });
  }

  // ---- Creator pillar -----------------------------------------------------
  const accounts: P360Account[] = accountRows.slice(0, P360_CAPS.accounts).map((r) => ({
    identity_id: String(r.identity_id),
    platform: String(r.platform),
    handle: str(r.handle),
  }));
  const accountIds = new Set(accounts.map((a) => a.identity_id));
  const streamMap = new Map<string, P360Stream>();
  const creatorMap = new Map<string, P360Creator>();
  for (const r of watchedRows) {
    if (streamMap.size >= P360_CAPS.streams) break;
    const sid = String(r.stream_id);
    if (streamMap.has(sid) || !accountIds.has(String(r.identity_id))) continue;
    streamMap.set(sid, {
      stream_id: sid,
      identity_id: String(r.identity_id),
      creator_id: String(r.creator_id),
      title: String(r.title ?? sid),
      platform: str(r.platform),
      peak_viewers: num(r.peak_viewers),
      watch_minutes: num(r.watch_minutes) ?? 0,
      watched_at: ts(r.watched_at),
    });
    const cid = String(r.creator_id);
    if (!creatorMap.has(cid)) {
      creatorMap.set(cid, {
        creator_id: cid,
        handle: String(r.handle ?? cid),
        name: str(r.creator_name),
        followers: num(r.followers),
        hub_score: num(r.hub_score),
      });
    }
  }

  // ---- Brand pillar (items) -----------------------------------------------
  const ownedItemIds = new Set<string>(boughtRows.map((r) => String(r.item_id)));
  const itemMap = new Map<string, P360Item>();
  for (const r of boughtRows) {
    const id = String(r.item_id);
    if (itemMap.has(id)) continue;
    itemMap.set(id, {
      item_id: id,
      name: String(r.name ?? id),
      item_type: str(r.item_type),
      brand_id: str(r.brand_id),
      is_branded: r.is_branded === true,
      vc_price: num(r.vc_price),
      bought: true,
      equipped: false,
      bought_at: ts(r.bought_at),
      vc_amount: num(r.vc_amount),
      via_activation_id: str(r.via_activation_id),
    });
  }
  for (const r of equippedRows) {
    const id = String(r.item_id);
    const existing = itemMap.get(id);
    if (existing) existing.equipped = true;
    else
      itemMap.set(id, {
        item_id: id,
        name: String(r.name ?? id),
        item_type: str(r.item_type),
        brand_id: str(r.brand_id),
        is_branded: r.is_branded === true,
        vc_price: num(r.vc_price),
        bought: false,
        equipped: true,
        bought_at: null,
        vc_amount: null,
        via_activation_id: null,
      });
  }
  // Prefer branded + equipped items for the render budget.
  const items = Array.from(itemMap.values())
    .sort(
      (a, b) =>
        Number(b.is_branded) - Number(a.is_branded) ||
        Number(b.equipped) - Number(a.equipped) ||
        (tsMs(b.bought_at) ?? 0) - (tsMs(a.bought_at) ?? 0),
    )
    .slice(0, P360_CAPS.items);

  // ---- Social: merge three edge types into one neighbor set ---------------
  // Full neighbor lists come back (degree is small); totals + exposure use all of
  // them, render caps apply after.
  const totals = {
    played_with: new Set(pwRows.map((r) => String(r.id))).size,
    friends_with: new Set(fwRows.map((r) => String(r.id))).size,
    messaged: new Set(msgRows.map((r) => String(r.id))).size,
  };
  const churned14 = new Set(
    pwRows
      .filter((r) => {
        const t = tsMs(ts(r.churned_at));
        return t !== null && t >= churnCutoff;
      })
      .map((r) => String(r.id)),
  ).size;
  const maxG30 = Math.max(1, ...pwRows.map((r) => num(r.g30) ?? 0));
  const maxMsgs = Math.max(1, ...msgRows.map((r) => num(r.msgs) ?? 0));

  const nb = new Map<string, NeighborAgg>();
  const upsert = (r: any): NeighborAgg => {
    const id = String(r.id);
    let a = nb.get(id);
    if (!a) {
      a = {
        id,
        gamer_tag: String(r.gamer_tag ?? id),
        home: r.home ? String(r.home) : null,
        frs: Array.isArray(r.frs) ? r.frs.map(String) : [],
        churned_at: ts(r.churned_at),
        churn_risk: num(r.churn_risk) ?? 0,
        session_ratio: sessionRatio(num(r.s7), num(r.sp7)),
        g30: 0,
        gtot: 0,
        same_crew: false,
        friends_since: null,
        msgs: 0,
        kinds: new Set(),
        tie: 0,
      };
      nb.set(id, a);
    }
    return a;
  };
  for (const r of pwRows.slice(0, P360_CAPS.played_with)) {
    const a = upsert(r);
    a.kinds.add("PLAYED_WITH");
    a.g30 = num(r.g30) ?? 0;
    a.gtot = num(r.gtot) ?? 0;
    a.same_crew = r.same_crew === true;
  }
  for (const r of fwRows.slice(0, P360_CAPS.friends_with)) {
    const a = upsert(r);
    a.kinds.add("FRIENDS_WITH");
    a.friends_since = ts(r.since);
  }
  for (const r of msgRows.slice(0, P360_CAPS.messaged)) {
    const a = upsert(r);
    a.kinds.add("MESSAGED");
    a.msgs = num(r.msgs) ?? 0;
  }
  // Tie strength: co-play dominates, messages next, friendship is a floor.
  for (const a of nb.values()) {
    a.tie = Math.min(
      1,
      0.62 * (a.g30 / maxG30) + 0.26 * (a.msgs / maxMsgs) + (a.kinds.has("FRIENDS_WITH") ? 0.12 : 0),
    );
  }
  const neighbors = Array.from(nb.values())
    .sort((x, y) => y.tie - x.tie)
    .slice(0, P360_CAPS.neighbors_total);
  const neighborIds = neighbors.map((n) => n.id);

  // ---- Players like you bought (1-2 hop, count x tie strength) ------------
  const likeScore = new Map<string, { b1: Set<string>; b2: number; score: number }>();
  for (const r of like1Rows) {
    const item = String(r.item_id);
    if (ownedItemIds.has(item)) continue;
    const e = likeScore.get(item) ?? { b1: new Set<string>(), b2: 0, score: 0 };
    const nid = String(r.nid);
    if (!e.b1.has(nid)) {
      e.b1.add(nid);
      e.score += Math.max(0.05, (num(r.g30) ?? 0) / maxG30);
    }
    likeScore.set(item, e);
  }
  const HOP2_WEIGHT = 0.15;
  const directIds = new Set(pwRows.map((r) => String(r.id)));
  const hop2Buyers = new Map<string, Set<string>>();
  for (const r of like2Rows) {
    const item = String(r.item_id);
    const nid = String(r.nid);
    if (ownedItemIds.has(item) || directIds.has(nid)) continue;
    const set = hop2Buyers.get(item) ?? new Set<string>();
    set.add(nid);
    hop2Buyers.set(item, set);
  }
  for (const [item, set] of hop2Buyers) {
    const e = likeScore.get(item) ?? { b1: new Set<string>(), b2: 0, score: 0 };
    e.b2 = set.size;
    e.score += HOP2_WEIGHT * e.b2;
    likeScore.set(item, e);
  }
  const likeTop = Array.from(likeScore.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, P360_CAPS.like_you);

  // ---- Round 2: dependent lookups (parallel) ------------------------------
  const pillarItemIds = items.map((i) => i.item_id);
  const likeItemIds = likeTop.map(([id]) => id);
  const [actRows, likeItemRows, nCrewRows, nCreatorRows, nBrandRows, distRows] = await Promise.all([
    pillarItemIds.length
      ? log.run("brand pillar: activations + brands", Q.activations, { ids: pillarItemIds })
      : Promise.resolve([] as any[]),
    likeItemIds.length
      ? log.run("players like you bought: items", Q.items, { ids: likeItemIds })
      : Promise.resolve([] as any[]),
    neighborIds.length
      ? log.run("neighbors: crews (keystone + hop 2)", Q.neighborCrews, { ids: neighborIds })
      : Promise.resolve([] as any[]),
    hops === 2 && neighborIds.length
      ? log.run("hop 2: neighbors' creators", Q.neighborCreators, { ids: neighborIds })
      : Promise.resolve([] as any[]),
    hops === 2 && neighborIds.length
      ? log.run("hop 2: neighbors' brands", Q.neighborBrands, { ids: neighborIds })
      : Promise.resolve([] as any[]),
    log.run("crew centrality distribution", Q.centralityDist, { c: activeCrew?.crew_centrality ?? 0 }),
  ]);

  const p90 = KEYSTONE_CENTRALITY;
  const pctBelow = distRows.length ? num(distRows[0].pct_below) : null;

  const actMap = new Map<string, P360Activation>();
  for (const r of actRows) {
    const id = String(r.activation_id);
    const a = actMap.get(id) ?? {
      activation_id: id,
      brand_id: String(r.brand_id),
      title: String(r.title ?? id),
      kind: str(r.kind),
      item_ids: [],
    };
    const iid = String(r.item_id);
    if (!a.item_ids.includes(iid)) a.item_ids.push(iid);
    actMap.set(id, a);
  }
  // Prefer the activation the player actually bought through.
  const viaIds = new Set(items.map((i) => i.via_activation_id).filter(Boolean) as string[]);
  const activations = Array.from(actMap.values())
    .sort((a, b) => Number(viaIds.has(b.activation_id)) - Number(viaIds.has(a.activation_id)))
    .slice(0, P360_CAPS.activations);

  // Hop-2 aggregation (neighbor -> entity), capped by connection count.
  const neighborSet = new Set(neighborIds);
  const nCrewByNeighbor = new Map<string, { clan_id: string; name: string; centrality: number | null }>();
  const hop2Crews = new Map<string, { name: string; tier: string | null; nids: Set<string> }>();
  for (const r of nCrewRows) {
    const nid = String(r.nid);
    if (!neighborSet.has(nid)) continue;
    const cid = String(r.clan_id);
    nCrewByNeighbor.set(nid, { clan_id: cid, name: String(r.name), centrality: num(r.centrality) });
    if (hops === 2) {
      const e = hop2Crews.get(cid) ?? { name: String(r.name), tier: str(r.tier), nids: new Set<string>() };
      e.nids.add(nid);
      hop2Crews.set(cid, e);
    }
  }
  const hop2Creators = new Map<string, { handle: string; nids: Set<string>; minutes: number }>();
  for (const r of nCreatorRows) {
    const nid = String(r.nid);
    if (!neighborSet.has(nid)) continue;
    const cid = String(r.creator_id);
    const e = hop2Creators.get(cid) ?? { handle: String(r.handle ?? cid), nids: new Set<string>(), minutes: 0 };
    e.nids.add(nid);
    e.minutes += num(r.minutes) ?? 0;
    hop2Creators.set(cid, e);
  }
  const hop2Brands = new Map<string, { nids: Set<string>; purchases: number }>();
  for (const r of nBrandRows) {
    const nid = String(r.nid);
    if (!neighborSet.has(nid)) continue;
    const bid = String(r.brand_id);
    const e = hop2Brands.get(bid) ?? { nids: new Set<string>(), purchases: 0 };
    e.nids.add(nid);
    e.purchases += num(r.purchases) ?? 0;
    hop2Brands.set(bid, e);
  }

  // Brand lookups: pillar items, activations, like-you items, hop-2 brands.
  const likeItemMap = new Map<string, any>(likeItemRows.map((r) => [String(r.item_id), r]));
  const brandMap = new Map<string, P360Brand>(
    brandRows.map((r) => [
      String(r.brand_id),
      { brand_id: String(r.brand_id), name: String(r.name), category: str(r.category), logo_url: str(r.logo_url) },
    ]),
  );
  const pillarBrandIds = new Set<string>();
  items.forEach((i) => i.brand_id && pillarBrandIds.add(i.brand_id));
  activations.forEach((a) => pillarBrandIds.add(a.brand_id));
  const pillarBrands = Array.from(pillarBrandIds)
    .map((id) => brandMap.get(id))
    .filter(Boolean) as P360Brand[];

  // ---- Metrics ------------------------------------------------------------
  const centrality = activeCrew?.crew_centrality ?? null;
  const topDecile = centrality !== null && centrality >= p90;
  const declining = ratio !== null && ratio < DECLINING_RATIO;
  const keystone = topDecile && declining;

  const likeYou: P360LikeYouItem[] = likeTop.map(([id, s]) => {
    const r = likeItemMap.get(id);
    const bid = r?.brand_id ? String(r.brand_id) : null;
    return {
      item_id: id,
      name: String(r?.name ?? id),
      item_type: str(r?.item_type),
      brand_id: bid,
      brand_name: bid ? brandMap.get(bid)?.name ?? null : null,
      vc_price: num(r?.vc_price),
      buyers_1hop: s.b1.size,
      buyers_2hop: s.b2,
      score: round(s.score, 3),
    };
  });

  // ---- Social graph payload (neighbors + hop 2) ---------------------------
  const nodes: P360Node[] = [];
  const links: P360Link[] = [];
  const centerId = `player:${pid}`;
  for (const n of neighbors) {
    const churnedMs = tsMs(n.churned_at);
    const nc = nCrewByNeighbor.get(n.id);
    const nKeystone =
      nc?.centrality !== null && nc?.centrality !== undefined && nc.centrality >= p90;
    nodes.push({
      id: `player:${n.id}`,
      kind: "neighbor",
      pillar: "social",
      hop: 1,
      label: n.gamer_tag,
      sub: nc?.name,
      churned: churnedMs !== null,
      churned_recent: churnedMs !== null && churnedMs >= churnCutoff,
      keystone: nKeystone,
      studio: n.frs.some((f) => studioOfFranchise(f) === "ROCKSTAR")
        ? "ROCKSTAR"
        : n.frs.some((f) => studioOfFranchise(f) === "ZYNGA")
          ? "ZYNGA"
          : n.home
            ? studioOfFranchise(n.home)
            : undefined,
      churn_risk: n.churn_risk,
      same_crew: n.same_crew || (!!activeCrew && nc?.clan_id === activeCrew.clan_id),
      weight: round(n.tie),
    });
    // One rendered link per relationship type so the legend reads true.
    if (n.kinds.has("PLAYED_WITH"))
      links.push({
        id: `pw:${pid}:${n.id}`,
        source: centerId,
        target: `player:${n.id}`,
        kind: "PLAYED_WITH",
        weight: round(n.g30 / maxG30),
        hop: 1,
        detail: `${n.g30} games / 30d${n.same_crew ? ", same crew" : ""}`,
      });
    if (n.kinds.has("FRIENDS_WITH"))
      links.push({
        id: `fw:${pid}:${n.id}`,
        source: centerId,
        target: `player:${n.id}`,
        kind: "FRIENDS_WITH",
        weight: 0.35,
        hop: 1,
        detail: n.friends_since ? `friends since ${n.friends_since.slice(0, 10)}` : "friends",
      });
    if (n.kinds.has("MESSAGED"))
      links.push({
        id: `msg:${pid}:${n.id}`,
        source: centerId,
        target: `player:${n.id}`,
        kind: "MESSAGED",
        weight: round(n.msgs / maxMsgs),
        hop: 1,
        detail: `${n.msgs} messages / 30d`,
      });
  }

  const caps: Record<string, number> = { ...P360_CAPS };
  let capped = totals.played_with > P360_CAPS.played_with || nb.size > P360_CAPS.neighbors_total;

  if (hops === 2) {
    const ownCrewIds = new Set(crews.map((c) => c.clan_id));
    const ownCreatorIds = new Set(creatorMap.keys());
    const crewList = Array.from(hop2Crews.entries())
      .filter(([id]) => !ownCrewIds.has(id))
      .sort((a, b) => b[1].nids.size - a[1].nids.size);
    const creatorList = Array.from(hop2Creators.entries())
      .filter(([id]) => !ownCreatorIds.has(id))
      .sort((a, b) => b[1].nids.size - a[1].nids.size || b[1].minutes - a[1].minutes);
    const brandList = Array.from(hop2Brands.entries())
      .filter(([id]) => !pillarBrandIds.has(id))
      .sort((a, b) => b[1].nids.size - a[1].nids.size);
    if (
      crewList.length > P360_CAPS.hop2_crews ||
      creatorList.length > P360_CAPS.hop2_creators ||
      brandList.length > P360_CAPS.hop2_brands
    )
      capped = true;

    const maxDeg = Math.max(
      1,
      ...[...crewList, ...creatorList, ...brandList].map(([, v]) => v.nids.size),
    );
    for (const [id, v] of crewList.slice(0, P360_CAPS.hop2_crews)) {
      nodes.push({ id: `crew:${id}`, kind: "crew", pillar: "crew", hop: 2, label: v.name, sub: v.tier ?? undefined, weight: round(v.nids.size / maxDeg), degree: v.nids.size });
      for (const nid of v.nids)
        links.push({ id: `h2c:${nid}:${id}`, source: `player:${nid}`, target: `crew:${id}`, kind: "MEMBER_OF", weight: 0.3, hop: 2 });
    }
    for (const [id, v] of creatorList.slice(0, P360_CAPS.hop2_creators)) {
      nodes.push({ id: `creator:${id}`, kind: "creator", pillar: "creator", hop: 2, label: v.handle, sub: `${Math.round(v.minutes)} min watched`, weight: round(v.nids.size / maxDeg), degree: v.nids.size });
      for (const nid of v.nids)
        links.push({ id: `h2w:${nid}:${id}`, source: `player:${nid}`, target: `creator:${id}`, kind: "WATCHED", weight: 0.3, hop: 2 });
    }
    for (const [id, v] of brandList.slice(0, P360_CAPS.hop2_brands)) {
      const b = brandMap.get(id);
      nodes.push({ id: `brand:${id}`, kind: "brand", pillar: "brand", hop: 2, label: b?.name ?? id, sub: `${v.purchases} purchases`, weight: round(v.nids.size / maxDeg), degree: v.nids.size });
      for (const nid of v.nids)
        links.push({ id: `h2b:${nid}:${id}`, source: `player:${nid}`, target: `brand:${id}`, kind: "BOUGHT", weight: 0.3, hop: 2 });
    }
  }

  const player: P360Player = {
    player_id: String(pr.player_id),
    gamer_tag: String(pr.gamer_tag),
    display_name: String(pr.display_name ?? pr.gamer_tag),
    archetype: String(pr.archetype ?? ""),
    ovr: num(pr.ovr),
    vc: num(pr.vc),
    churn_risk: num(pr.churn_risk) ?? 0,
    lifetime_spend_usd: num(pr.spend) ?? 0,
    session_min_7d: s7,
    session_min_prev_7d: sp7,
    session_ratio: ratio === null ? null : round(ratio, 3),
    churned_at: ts(pr.churned_at),
    last_active_at: ts(pr.last_active_at),
    community_id: str(pr.community_id),
    keystone: topDecile,
  };

  // ---- Across labels (portfolio DB only) ----------------------------------
  let cross_label: P360CrossLabel | undefined;
  if (await hasPortfolio()) {
    const [titleRows, extraRows] = await Promise.all([
      log.run("across labels: titles + spend", QX.titles, { pid }),
      log.run("across labels: GTA VI wishlist + invites", QX.extras, { pid }),
    ]);
    const home = studioOfFranchise(String(pr.primary_franchise ?? ""));
    const playsLabel = (frs: unknown, st: Studio) =>
      Array.isArray(frs) && frs.some((f) => studioOfFranchise(String(f)) === st);
    const fw = fwRows as any[];
    cross_label = {
      home_studio: home,
      titles: titleRows.map((r: any) => {
        const label = String(r.label);
        return {
          franchise: String(r.franchise),
          title: String(r.title),
          studio: (label === "ROCKSTAR" ? "ROCKSTAR" : label === "ZYNGA" ? "ZYNGA" : "2K") as Studio,
          spend_usd: round(num(r.spend) ?? 0, 2),
          last_played: r.last_played ? String(r.last_played) : null,
        };
      }),
      friends: {
        total: fw.length,
        rockstar: fw.filter((r) => playsLabel(r.frs, "ROCKSTAR")).length,
        zynga: fw.filter((r) => playsLabel(r.frs, "ZYNGA")).length,
        twok: fw.filter((r) => playsLabel(r.frs, "2K")).length,
      },
      coplay_other_label: (pwRows as any[]).filter((r) => r.home && studioOfFranchise(String(r.home)) !== home).length,
      gta6_wishlisted: (num(extraRows[0]?.wish) ?? 0) > 0,
      invites: { sent_accepted: num(extraRows[0]?.sent_accepted) ?? 0, joined_by_invite: num(extraRows[0]?.joined_by_invite) ?? 0 },
    };
  }

  return {
    player,
    hops,
    cross_label,
    pillars: {
      crew: { crews, matches, seasons: Array.from(seasonMap.values()) },
      creator: { accounts, streams: Array.from(streamMap.values()), creators: Array.from(creatorMap.values()) },
      brand: { items, activations, brands: pillarBrands },
    },
    social: { nodes, links, totals, caps, capped },
    metrics: {
      churn_exposure: {
        value: totals.played_with ? round(churned14 / totals.played_with, 4) : 0,
        churned_14d: churned14,
        coplay_neighbors: totals.played_with,
      },
      crew_centrality: {
        value: centrality === null ? null : round(centrality, 3),
        percentile: pctBelow === null || centrality === null ? null : round(pctBelow * 100, 1),
        crew: activeCrew?.name ?? null,
      },
      keystone: {
        value: keystone,
        top_decile: topDecile,
        declining,
        session_ratio: ratio === null ? null : round(ratio, 3),
        keystone_threshold: p90,
      },
      players_like_you_bought: likeYou,
      players_like_you_method:
        "Items the player does not own, scored as the sum of tie strength over distinct buyers: 1-hop PLAYED_WITH buyers weigh games_together_30d / max, 2-hop buyers weigh 0.15 each.",
    },
    gql: log.text(),
    gql_steps: log.steps,
    source: spannerSource(),
    latency_ms: Date.now() - started,
  };
}

// ---------------------------------------------------------------------------
// Featured player for the guided storyline
// ---------------------------------------------------------------------------

const QF = {
  asOf: `
    SELECT MAX(last_active_at) AS as_of FROM Players`,
  candidates: `
    ${G}
    MATCH (p:Player)-[m:MEMBER_OF]->(c:Crew)
    WHERE m.is_active AND m.crew_centrality >= @p90
      AND c.franchise NOT IN ('GTAO', 'RDO', 'WWF', 'MATCHFACTORY', 'TOONBLAST', 'CSR2', 'EMPIRES', 'ZPOKER')
      AND p.churned_at IS NULL
      AND p.session_min_prev_7d > 0
      AND p.session_min_7d / p.session_min_prev_7d < 0.7
    RETURN p.player_id AS player_id, p.gamer_tag AS gamer_tag, c.name AS crew,
           m.crew_centrality AS centrality,
           p.session_min_7d / p.session_min_prev_7d AS ratio
    ORDER BY centrality DESC
    LIMIT 200`,
  richness: `
    ${G}
    MATCH (p:Player)-[e:PLAYED_WITH]-(n:Player)
    WHERE p.player_id IN UNNEST(@ids)
    RETURN p.player_id AS player_id,
           COUNT(DISTINCT n.player_id) AS neighbors,
           COUNT(DISTINCT CASE WHEN n.churned_at >= TIMESTAMP_SUB(@as_of, INTERVAL 14 DAY)
                               THEN n.player_id END) AS churned_14d
    GROUP BY player_id`,
  pillars: `
    ${G}
    MATCH (p:Player)-[:LINKED_TO]->(:ViewerAccount)-[w:WATCHED]->(:Stream)
    WHERE p.player_id IN UNNEST(@ids)
    RETURN p.player_id AS player_id, COUNT(*) AS watched
    GROUP BY player_id`,
  branded: `
    ${G}
    MATCH (p:Player)-[:BOUGHT]->(it:Item)
    WHERE p.player_id IN UNNEST(@ids) AND it.is_branded
    RETURN p.player_id AS player_id, COUNT(*) AS branded
    GROUP BY player_id`,
} as const;

export async function getFeaturedPlayer(): Promise<FeaturedPlayerResponse> {
  const started = Date.now();
  const log = new QueryLog();
  const p90 = KEYSTONE_CENTRALITY;
  const [asOfRows, cand] = await Promise.all([
    log.run("data as-of", QF.asOf),
    log.run("keystones with declining sessions", QF.candidates, { p90 }),
  ]);
  const asOfIso = ts(asOfRows[0]?.as_of);
  if (!asOfIso) throw new Player360QueryError("data as-of", QF.asOf, new Error("Players.last_active_at is empty"));
  const asOf = new Date(asOfIso);
  if (!cand.length)
    throw new Player360QueryError(
      "keystones with declining sessions",
      QF.candidates,
      new Error(`no active keystone (centrality >= ${p90}) with session ratio < ${DECLINING_RATIO}`),
    );
  const ids = Array.from(new Set(cand.map((r) => String(r.player_id))));
  const [rich, watched, branded] = await Promise.all([
    log.run("candidate social degree + churned neighbors", QF.richness, { ids, as_of: asOf }),
    log.run("candidate creator pillar size", QF.pillars, { ids }),
    log.run("candidate branded purchases", QF.branded, { ids }),
  ]);
  // Portfolio DB: prefer a keystone who is still active this week in a Rockstar or Zynga
  // title (the cross-label story). No effect on the 2K-only database.
  const crossMap = new Map<string, { last: number; franchise: string; rockstar: boolean }>();
  if (await hasPortfolio()) {
    const rows = await log.run(
      "candidate activity in Rockstar / Zynga titles",
      `SELECT pg.player_id AS player_id, g.label AS label, MAX(pg.last_played_timestamp) AS last_other,
              ANY_VALUE(g.franchise HAVING MAX pg.last_played_timestamp) AS franchise
       FROM PlaysGame pg JOIN Games g ON g.game_id = pg.game_id
       WHERE pg.player_id IN UNNEST(@ids) AND g.label IN ('ROCKSTAR', 'ZYNGA')
       GROUP BY pg.player_id, g.label`,
      { ids },
    );
    // Per player keep the most recent title this week, preferring Rockstar (the GTA story).
    for (const r of rows) {
      const id = String(r.player_id);
      const last = Date.parse(String(r.last_other));
      const rockstar = String(r.label) === "ROCKSTAR";
      const cur = crossMap.get(id);
      const better = !cur || (rockstar && last >= weekAgoFor(asOf) && !cur.rockstar) || (rockstar === cur.rockstar && last > cur.last);
      if (better) crossMap.set(id, { last, franchise: String(r.franchise), rockstar });
    }
  }
  const weekAgo = asOf.getTime() - 7 * 86400000;
  const richMap = new Map(rich.map((r) => [String(r.player_id), r]));
  const watchMap = new Map(watched.map((r) => [String(r.player_id), num(r.watched) ?? 0]));
  const brandMap = new Map(branded.map((r) => [String(r.player_id), num(r.branded) ?? 0]));

  // Deterministic pick: the keystone whose story is fullest on screen.
  const scored = cand.map((r) => {
    const id = String(r.player_id);
    const rr = richMap.get(id);
    const neighbors = num(rr?.neighbors) ?? 0;
    const churned = num(rr?.churned_14d) ?? 0;
    const w = watchMap.get(id) ?? 0;
    const b = brandMap.get(id) ?? 0;
    const score =
      (num(r.centrality) ?? 0) +
      0.012 * Math.min(neighbors, 30) +
      0.06 * Math.min(churned, 5) +
      (w > 0 ? 0.08 : 0) +
      (b > 0 ? 0.08 : 0) +
      ((crossMap.get(id)?.last ?? 0) >= weekAgo ? (crossMap.get(id)!.rockstar ? 0.3 : 0.2) : 0);
    return { r, id, neighbors, churned, score };
  });
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const best = scored[0];
  const ratio = num(best.r.ratio) ?? 0;
  const centrality = num(best.r.centrality) ?? 0;
  const drop = Math.round((1 - ratio) * 100);
  const reason =
    `Keystone of ${best.r.crew} (centrality ${centrality.toFixed(2)}). ` +
    `Sessions down ${drop}% week over week. ` +
    `${best.churned} of ${best.neighbors} co-play neighbors churned in the last 14 days.` +
    ((crossMap.get(best.id)?.last ?? 0) >= weekAgo
      ? ` Still playing ${FRANCHISE_TITLE[crossMap.get(best.id)!.franchise] ?? crossMap.get(best.id)!.franchise} this week.`
      : "");

  return {
    player_id: best.id,
    gamer_tag: String(best.r.gamer_tag),
    reason,
    crew: String(best.r.crew),
    crew_centrality: round(centrality, 3),
    keystone_threshold: round(p90, 3),
    session_ratio: round(ratio, 3),
    coplay_neighbors: best.neighbors,
    churned_neighbors_14d: best.churned,
    candidates_considered: cand.length,
    gql: log.text(),
    gql_steps: log.steps,
    latency_ms: Date.now() - started,
  };
}
