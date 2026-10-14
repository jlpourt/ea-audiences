/**
 * Live Spanner Graph client for 2K Courtside (TakeTwoPlayerGraph).
 *
 * DESIGN: Spanner (`blackrock-spanner/twok_graph_db`) is the single source of
 * truth. There is no silent local JSON fallback.
 */
import { Database, Spanner } from "@google-cloud/spanner";
import { GCP_CONFIG } from "../config";

export interface PlayerRow {
  player_id: string;
  display_name: string;
  gamer_tag: string;
  primary_franchise: string;
  franchises_played: string[];
  primary_archetype: string;
  lifetime_spend_usd: number;
  churn_risk_score: number;
  tilt_sensitivity: number;
  recent_loss_streak: number;
  age: number | null;
  gender: string | null;
  account_tenure_days: number | null;
  currency_balance: number | null;
  country: string | null;
  country_code: string | null;
  country_flag: string | null;
  dma_market: string | null;
  lat: number | null;
  lng: number | null;
  followed_creators: string[];
  primary_creator_influence: string | null;
  game_telemetry: Record<string, any>;
  purchased_items: any[];
}

export interface CohortAggregates {
  totalMatched: number;
  avgSpend: number;
  avgChurn: number;
  avgTilt: number;
  highChurnCount: number;
  archetypeHistogram: Record<string, number>;
  countryHistogram: Record<string, number>;
  franchiseHistogram: Record<string, number>;
  dominantArchetype: string;
}

export interface MultiHopBridgeRow {
  player_id: string;
  clan_id?: string;
  clan_name?: string;
  clan_tier?: string;
  mate_id?: string;
  mate_tag?: string;
  mate_franchise?: string;
  creator_id?: string;
  creator_handle?: string;
  creator_name?: string;
  creator_platform?: string;
  identity_id?: string;
  identity_platform?: string;
  identity_handle?: string;
  target_game_id?: string;
  target_game_title?: string;
  target_game_franchise?: string;
  target_game_label?: string;
}

export interface GraphQueryResult {
  rows: PlayerRow[];
  totalMatched: number;
  aggregates: CohortAggregates;
  isLive: boolean;
  source: string;
  executionTimeMs: number;
  whereClause: string;
  gqlExecuted: string;
  isMultiHop?: boolean;
  matchPattern?: string;
  bridgeRows?: MultiHopBridgeRow[];
}

export class SpannerUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SpannerUnavailableError";
    this.cause = cause;
  }
}

export const GRAPH_NAME = "TakeTwoPlayerGraph";
export const GRAPH = GRAPH_NAME;

export const PLAYER_COLS = [
  "p.player_id",
  "p.display_name",
  "p.gamer_tag",
  "p.primary_franchise",
  "p.franchises_played",
  "p.primary_archetype",
  "p.lifetime_spend_usd",
  "p.churn_risk_score",
  "p.tilt_sensitivity",
  "p.recent_loss_streak",
  "p.age",
  "p.gender",
  "p.account_tenure_days",
  "p.currency_balance",
  "p.country",
  "p.country_code",
  "p.country_flag",
  "p.dma_market",
  "p.lat",
  "p.lng",
  "p.followed_creators",
  "p.primary_creator_influence",
  "p.game_telemetry",
  "p.purchased_items",
];

export const PLAYER_PROJECTION = PLAYER_COLS.join(", ");

export const PLAYER_GROUPED_PROJECTION = [
  "p.player_id AS player_id",
  ...PLAYER_COLS.slice(1).map((c) => `ANY_VALUE(${c}) AS ${c.slice(2)}`),
].join(", ");

let cachedDatabase: Database | null = null;

export function getDatabase(): Database {
  if (!cachedDatabase) {
    const spanner = new Spanner({ projectId: GCP_CONFIG.projectId });
    cachedDatabase = spanner
      .instance(GCP_CONFIG.spannerInstanceId)
      .database(GCP_CONFIG.spannerDatabaseId);
  }
  return cachedDatabase;
}

/**
 * Extract the OUTERMOST MATCH pattern from a GQL query.
 */
export function extractMatchClause(gql: string): string {
  if (!gql) return "(p:Player)";
  // Strip any inner NOT EXISTS { ... } before extracting top-level MATCH/WHERE
  const stripped = gql.replace(/NOT\s+EXISTS\s*\{(?:[^{}]|\{[^{}]*\})*\}/gi, "");
  const match = stripped.match(
    /\bMATCH\b([\s\S]*?)(?:\bWHERE\b|\bRETURN\b|\bORDER\s+BY\b|\bLIMIT\b|\bNEXT\b|$)/i
  );
  if (!match) return "(p:Player)";
  const clause = match[1].trim();
  return clause || "(p:Player)";
}

/**
 * Pull the WHERE clause out of a generated GQL query (preserving nested NOT EXISTS).
 */
export function extractWhereClause(gql: string): string {
  if (!gql) return "";
  const match = gql.match(
    /\bWHERE\b([\s\S]*?)(?:\bRETURN\b|\bORDER\s+BY\b|\bLIMIT\b|\bNEXT\b|$)/i
  );
  return match ? match[1].trim().replace(/;$/, "").trim() : "";
}

/**
 * Repair common LLM GQL constructs so Spanner GoogleSQL accepts them cleanly:
 * 1. `'NBA2K' IN p.franchises_played` -> `'NBA2K' IN UNNEST(p.franchises_played)`
 * 2. Any `NOT EXISTS { ... }` block that binds `(p:Player)` or `(p)` — with or
 *    without an inner `WHERE` clause — rewrites the bound player variable inside
 *    the `NOT EXISTS` block to `(p2:Player)` and injects `p2.player_id = p.player_id`.
 */
export function normalizeWhereClause(where: string): string {
  if (!where) return "";
  let out = where;

  out = out.replace(
    /('(?:[^']*)'|"(?:[^"]*)")\s+IN\s+([a-zA-Z_0-9]+\.[a-zA-Z_0-9]+)(?!\s*\()/gi,
    (_m, literal, field) => `${literal} IN UNNEST(${field})`
  );

  // Repair uncorrelated NOT EXISTS { (p)... } or NOT EXISTS { MATCH (p:Player)... [WHERE ...] }
  out = out.replace(
    /NOT\s+EXISTS\s*\{((?:[^{}]|\{[^{}]*\})*)\}/gi,
    (fullMatch, innerRaw: string) => {
      const inner = innerRaw.trim();
      if (!/\(\s*p(?:\s*:\s*Player)?(?:\s*\{[^{}]*\})?\s*\)/i.test(inner)) {
        return fullMatch;
      }
      let rewritten = inner.replace(
        /\(\s*p(?:\s*:\s*Player)?(\s*\{[^{}]*\})?\s*\)/gi,
        (_m, props) => `(p2:Player${props || ""})`
      );
      if (!/^MATCH\b/i.test(rewritten)) {
        rewritten = `MATCH ${rewritten}`;
      }
      if (/\bWHERE\b/i.test(rewritten)) {
        if (!/p2\.player_id\s*=\s*p\.player_id|p\.player_id\s*=\s*p2\.player_id/i.test(rewritten)) {
          rewritten = `${rewritten} AND p2.player_id = p.player_id`;
        }
      } else {
        rewritten = `${rewritten} WHERE p2.player_id = p.player_id`;
      }
      return `NOT EXISTS { ${rewritten} }`;
    }
  );

  return out.trim();
}

function buildWhereFragment(where: string): string {
  return where ? `WHERE ${where}\n` : "";
}

export function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && typeof v.value !== "undefined") return Number(v.value);
  return Number(v);
}

function toNullableNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  return toNumber(v);
}

export function parseJsonColumn(v: any, fallback: any) {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }
  return v;
}

export function mapPlayerRow(raw: any): PlayerRow {
  return {
    player_id: raw.player_id,
    display_name: raw.display_name,
    gamer_tag: raw.gamer_tag,
    primary_franchise: raw.primary_franchise,
    franchises_played: raw.franchises_played || [],
    primary_archetype: raw.primary_archetype,
    lifetime_spend_usd: toNumber(raw.lifetime_spend_usd),
    churn_risk_score: toNumber(raw.churn_risk_score),
    tilt_sensitivity: toNumber(raw.tilt_sensitivity),
    recent_loss_streak: toNumber(raw.recent_loss_streak),
    age: toNullableNumber(raw.age),
    gender: raw.gender ?? null,
    account_tenure_days: toNullableNumber(raw.account_tenure_days),
    currency_balance: toNullableNumber(raw.currency_balance),
    country: raw.country ?? null,
    country_code: raw.country_code ?? null,
    country_flag: raw.country_flag ?? null,
    dma_market: raw.dma_market ?? null,
    lat: toNullableNumber(raw.lat),
    lng: toNullableNumber(raw.lng),
    followed_creators: raw.followed_creators || [],
    primary_creator_influence: raw.primary_creator_influence ?? null,
    game_telemetry: parseJsonColumn(raw.game_telemetry, {}),
    purchased_items: parseJsonColumn(raw.purchased_items, []),
  };
}

async function runGql(
  database: Database,
  sql: string,
  params?: Record<string, any>
): Promise<any[]> {
  const [rows] = await database.run(params ? { sql, params } : { sql });
  return rows.map((r: any) => r.toJSON());
}

/**
 * Execute a cohort query against `TakeTwoPlayerGraph`.
 */
export async function runSpannerGraphQuery(
  generatedGql: string,
  renderLimit = 520
): Promise<GraphQueryResult> {
  const started = Date.now();
  const database = getDatabase();

  const matchClause = extractMatchClause(generatedGql);
  const isMultiHop =
    matchClause !== "(p:Player)" &&
    (matchClause.includes("-") ||
      matchClause.includes(",") ||
      matchClause.includes("Clan") ||
      matchClause.includes("Creator") ||
      matchClause.includes("Identity") ||
      matchClause.includes("Game"));

  const where = normalizeWhereClause(extractWhereClause(generatedGql));
  const whereFragment = buildWhereFragment(where);

  const rowsSql = isMultiHop
    ? `GRAPH ${GRAPH}\n` +
      `MATCH ${matchClause}\n` +
      whereFragment +
      `RETURN ${PLAYER_GROUPED_PROJECTION}\n` +
      `GROUP BY p.player_id\n` +
      `ORDER BY lifetime_spend_usd DESC\n` +
      `LIMIT ${Math.max(1, renderLimit)}`
    : `GRAPH ${GRAPH}\n` +
      `MATCH ${matchClause}\n` +
      whereFragment +
      `RETURN ${PLAYER_PROJECTION}\n` +
      `ORDER BY p.lifetime_spend_usd DESC\n` +
      `LIMIT ${Math.max(1, renderLimit)}`;

  const statsSql =
    `GRAPH ${GRAPH}\n` +
    `MATCH ${matchClause}\n` +
    whereFragment +
    `RETURN COUNT(DISTINCT p.player_id) AS total,\n` +
    `       AVG(p.lifetime_spend_usd) AS avg_spend,\n` +
    `       AVG(p.churn_risk_score) AS avg_churn,\n` +
    `       AVG(p.tilt_sensitivity) AS avg_tilt,\n` +
    `       COUNT(DISTINCT IF(p.churn_risk_score >= 0.7, p.player_id, NULL)) AS high_churn`;

  const archetypeSql =
    `GRAPH ${GRAPH}\nMATCH ${matchClause}\n` +
    whereFragment +
    `RETURN p.primary_archetype AS k, COUNT(DISTINCT p.player_id) AS n\nGROUP BY k\nORDER BY n DESC`;

  const countrySql =
    `GRAPH ${GRAPH}\nMATCH ${matchClause}\n` +
    whereFragment +
    `RETURN p.country AS k, COUNT(DISTINCT p.player_id) AS n\nGROUP BY k\nORDER BY n DESC`;

  const franchiseSql =
    `GRAPH ${GRAPH}\nMATCH ${matchClause}\n` +
    whereFragment +
    `RETURN p.primary_franchise AS k, COUNT(DISTINCT p.player_id) AS n\nGROUP BY k\nORDER BY n DESC`;

  let bridgePromise: Promise<any[]> = Promise.resolve([]);
  if (isMultiHop) {
    const clanAliasMatch = matchClause.match(/\(\s*([a-zA-Z_0-9]+)\s*:\s*Clan\b/);
    const creatorAliasMatch = matchClause.match(/\(\s*([a-zA-Z_0-9]+)\s*:\s*Creator\b/);
    const identityAliasMatch = matchClause.match(/\(\s*([a-zA-Z_0-9]+)\s*:\s*Identity\b/);
    const gameAliasMatch = matchClause.match(/\(\s*([a-zA-Z_0-9]+)\s*:\s*Game\b/);

    if (clanAliasMatch) {
      const ca = clanAliasMatch[1];
      const hasMate = /\(\s*mate\s*:\s*Player\b/.test(matchClause);
      const ga = gameAliasMatch?.[1];
      const bridgeSql =
        `GRAPH ${GRAPH}\n` +
        `MATCH ${matchClause}\n` +
        whereFragment +
        `RETURN p.player_id AS player_id,\n` +
        `       ${ca}.clan_id AS clan_id, ANY_VALUE(${ca}.name) AS clan_name, ANY_VALUE(${ca}.tier) AS clan_tier,\n` +
        (hasMate
          ? `       ANY_VALUE(mate.player_id) AS mate_id, ANY_VALUE(mate.gamer_tag) AS mate_tag, ANY_VALUE(mate.primary_franchise) AS mate_franchise,\n`
          : "") +
        (ga
          ? `       ANY_VALUE(${ga}.game_id) AS target_game_id, ANY_VALUE(${ga}.title) AS target_game_title, ANY_VALUE(${ga}.franchise) AS target_game_franchise, ANY_VALUE(${ga}.label) AS target_game_label\n`
          : `       ANY_VALUE(${ca}.franchise) AS target_game_franchise\n`) +
        `GROUP BY p.player_id, ${ca}.clan_id\n` +
        `LIMIT 260`;
      bridgePromise = runGql(database, bridgeSql);
    } else if (identityAliasMatch) {
      const ia = identityAliasMatch[1];
      const ga = gameAliasMatch?.[1];
      const bridgeSql =
        `GRAPH ${GRAPH}\n` +
        `MATCH ${matchClause}\n` +
        whereFragment +
        `RETURN DISTINCT p.player_id,\n` +
        `       ${ia}.identity_id, ${ia}.platform AS identity_platform, ${ia}.platform_handle AS identity_handle` +
        (ga
          ? `,\n       ${ga}.game_id AS target_game_id, ${ga}.title AS target_game_title, ${ga}.franchise AS target_game_franchise, ${ga}.label AS target_game_label\n`
          : `\n`) +
        `LIMIT 260`;
      bridgePromise = runGql(database, bridgeSql);
    } else if (creatorAliasMatch) {
      const cra = creatorAliasMatch[1];
      const bridgeSql =
        `GRAPH ${GRAPH}\n` +
        `MATCH ${matchClause}\n` +
        whereFragment +
        `RETURN DISTINCT p.player_id,\n` +
        `       ${cra}.creator_id, ${cra}.handle AS creator_handle, ${cra}.platform AS creator_platform, ${cra}.name AS creator_name,\n` +
        `       ${cra}.franchise AS target_game_franchise\n` +
        `LIMIT 260`;
      bridgePromise = runGql(database, bridgeSql);
    }
  }

  let results: any[][];
  try {
    results = await Promise.all([
      runGql(database, rowsSql),
      runGql(database, statsSql),
      runGql(database, archetypeSql),
      runGql(database, countrySql),
      runGql(database, franchiseSql),
      bridgePromise,
    ]);
  } catch (e: any) {
    throw new SpannerUnavailableError(
      `Property graph query failed: ${e?.message || e}. MATCH was: ${matchClause}. WHERE clause was: ${
        where || "(none)"
      }`,
      e
    );
  }

  const [rawRows, statsRows, archRows, countryRows, franchiseRows, bridgeRows] = results;

  const stats = statsRows[0] || {};
  const histogram = (rows: any[]) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      if (r.k !== null && r.k !== undefined) acc[r.k] = toNumber(r.n);
      return acc;
    }, {});

  const archetypeHistogram = histogram(archRows);
  const dominantArchetype =
    Object.entries(archetypeHistogram).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "MYCAREER_STORY_CASUAL";

  const aggregates: CohortAggregates = {
    totalMatched: toNumber(stats.total),
    avgSpend: toNumber(stats.avg_spend),
    avgChurn: toNumber(stats.avg_churn),
    avgTilt: toNumber(stats.avg_tilt),
    highChurnCount: toNumber(stats.high_churn),
    archetypeHistogram,
    countryHistogram: histogram(countryRows),
    franchiseHistogram: histogram(franchiseRows),
    dominantArchetype,
  };

  const seenPlayerIds = new Set<string>();
  const distinctRows: PlayerRow[] = [];
  for (const raw of rawRows) {
    if (raw.player_id && !seenPlayerIds.has(raw.player_id)) {
      seenPlayerIds.add(raw.player_id);
      distinctRows.push(mapPlayerRow(raw));
      if (distinctRows.length >= renderLimit) break;
    }
  }

  return {
    rows: distinctRows,
    totalMatched: aggregates.totalMatched,
    aggregates,
    isLive: true,
    source: `spanner://${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}`,
    executionTimeMs: Date.now() - started,
    whereClause: where,
    gqlExecuted: rowsSql,
    isMultiHop,
    matchPattern: matchClause,
    bridgeRows: bridgeRows || [],
  };
}

/**
 * Arbitrary read-only SQL / GQL against `twok_graph_db`, with optional `@params`.
 */
export async function runRawGql(
  sql: string,
  params?: Record<string, any>
): Promise<any[]> {
  try {
    return await runGql(getDatabase(), sql, params);
  } catch (e: any) {
    throw new SpannerUnavailableError(`Spanner query failed: ${e?.message || e}`, e);
  }
}

/**
 * Fast population count for a WHERE clause on `TakeTwoPlayerGraph`.
 */
export async function countGql(
  whereClause: string,
  matchClause = "(p:Player)"
): Promise<number> {
  const normWhere = normalizeWhereClause(whereClause);
  const whereFrag = buildWhereFragment(normWhere);
  const rows = await runRawGql(
    `GRAPH ${GRAPH}\nMATCH ${matchClause}\n${whereFrag}RETURN COUNT(DISTINCT p.player_id) AS n`
  );
  return toNumber(rows[0]?.n);
}

/**
 * Parameterized lookup of players by `player_id` array.
 */
export async function getPlayersByIds(ids: string[]): Promise<PlayerRow[]> {
  const clean = Array.from(
    new Set(ids.filter((id) => typeof id === "string" && id.length > 0))
  ).slice(0, 400);
  if (clean.length === 0) return [];

  const rows = await runRawGql(
    `GRAPH ${GRAPH}\nMATCH (p:Player)\nWHERE p.player_id IN UNNEST(@ids)\nRETURN ${PLAYER_PROJECTION}`,
    { ids: clean }
  );
  return rows.map(mapPlayerRow);
}

export interface CrewMateRow {
  player_id: string;
  clan_id: string;
  clan_name: string;
  clan_tier: string;
  mate_id: string;
  mate_tag: string;
  mate_ovr: number | null;
  mate_last_login_days_ago: number;
}

/**
 * 2-hop Crew traversal: find active teammates (`last_login_days_ago <= 7`) in
 * the same Crew as the given `playerIds`.
 */
export async function getCrewMates(playerIds: string[]): Promise<CrewMateRow[]> {
  const clean = Array.from(
    new Set(playerIds.filter((id) => typeof id === "string" && id.length > 0))
  ).slice(0, 120);
  if (clean.length === 0) return [];

  const rows = await runRawGql(
    `GRAPH ${GRAPH}
     MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player)
     WHERE p.player_id IN UNNEST(@ids)
       AND p.player_id <> mate.player_id
       AND INT64(mate.game_telemetry.last_login_days_ago) <= 7
     RETURN p.player_id AS player_id,
            c.clan_id AS clan_id,
            c.name AS clan_name,
            c.tier AS clan_tier,
            mate.player_id AS mate_id,
            mate.gamer_tag AS mate_tag,
            INT64(mate.game_telemetry.myplayer_ovr) AS mate_ovr,
            INT64(mate.game_telemetry.last_login_days_ago) AS mate_last_login_days_ago
     LIMIT 200`,
    { ids: clean }
  );

  return rows.map((r) => ({
    player_id: String(r.player_id),
    clan_id: String(r.clan_id),
    clan_name: String(r.clan_name),
    clan_tier: String(r.clan_tier || "Rec"),
    mate_id: String(r.mate_id),
    mate_tag: String(r.mate_tag),
    mate_ovr: r.mate_ovr !== null && r.mate_ovr !== undefined ? toNumber(r.mate_ovr) : null,
    mate_last_login_days_ago: toNumber(r.mate_last_login_days_ago),
  }));
}

export interface CrossLabelBridge {
  player_id: string;
  label: string;
  game_id: string;
  title: string;
  franchise: string;
  hours_played: number;
}

/**
 * Return `PLAYS_GAME` edges joined with `Games.label` for a set of players.
 */
export async function getCrossLabelBridges(
  playerIds: string[]
): Promise<CrossLabelBridge[]> {
  const clean = Array.from(
    new Set(playerIds.filter((id) => typeof id === "string" && id.length > 0))
  ).slice(0, 200);
  if (clean.length === 0) return [];

  const rows = await runRawGql(
    `GRAPH ${GRAPH}
     MATCH (p:Player)-[e:PLAYS_GAME]->(g:Game)
     WHERE p.player_id IN UNNEST(@ids)
     RETURN p.player_id AS player_id,
            g.label AS label,
            g.game_id AS game_id,
            g.title AS title,
            g.franchise AS franchise,
            e.hours_played AS hours_played
     LIMIT 600`,
    { ids: clean }
  );

  return rows.map((r) => ({
    player_id: String(r.player_id),
    label: String(r.label || "2K"),
    game_id: String(r.game_id),
    title: String(r.title),
    franchise: String(r.franchise),
    hours_played: toNumber(r.hours_played),
  }));
}

/**
 * Compute a 10-bucket Cross-Label Gravity Score histogram (`0.0–1.0`) for the
 * given player IDs (or the entire graph if omitted).
 */
export async function getGravityHistogram(
  playerIds?: string[]
): Promise<Array<{ bucket: string; min: number; max: number; count: number }>> {
  const clean = (playerIds || []).filter((id) => typeof id === "string" && id.length > 0);
  const rows =
    clean.length > 0
      ? await runRawGql(
          `GRAPH ${GRAPH}
           MATCH (p:Player)
           WHERE p.player_id IN UNNEST(@ids)
           RETURN CAST(FLOOR(LEAST(0.999, GREATEST(0.0, FLOAT64(p.game_telemetry.gravity_score))) * 10) AS INT64) AS b,
                  COUNT(p.player_id) AS n
           GROUP BY b
           ORDER BY b ASC`,
          { ids: clean.slice(0, 500) }
        )
      : await runRawGql(
          `GRAPH ${GRAPH}
           MATCH (p:Player)
           RETURN CAST(FLOOR(LEAST(0.999, GREATEST(0.0, FLOAT64(p.game_telemetry.gravity_score))) * 10) AS b,
                  COUNT(p.player_id) AS n
           GROUP BY b
           ORDER BY b ASC`
        );

  const byBucket = new Map<number, number>();
  for (const r of rows) {
    byBucket.set(toNumber(r.b), toNumber(r.n));
  }

  return Array.from({ length: 10 }, (_, idx) => ({
    bucket: `${(idx * 10)}%–${(idx + 1) * 10}%`,
    min: idx / 10,
    max: (idx + 1) / 10,
    count: byBucket.get(idx) || 0,
  }));
}

/** Connectivity probe used by `/api/health/spanner` and `SpannerStatusPill`. */
export async function checkSpannerHealth(): Promise<{
  ok: boolean;
  database: string;
  graph: string;
  playerCount?: number;
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  const database = `${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}`;
  try {
    const rows = await runGql(
      getDatabase(),
      `GRAPH ${GRAPH} MATCH (p:Player) RETURN COUNT(*) AS total`
    );
    return {
      ok: true,
      database,
      graph: GRAPH,
      playerCount: toNumber(rows[0]?.total),
      latencyMs: Date.now() - started,
    };
  } catch (e: any) {
    return {
      ok: false,
      database,
      graph: GRAPH,
      latencyMs: Date.now() - started,
      error: e?.message || String(e),
    };
  }
}
