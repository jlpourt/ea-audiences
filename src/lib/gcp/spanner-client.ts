/**
 * Live Spanner Graph client.
 *
 * DESIGN: Spanner is the only source of truth. There is deliberately no
 * silent local fallback. The previous implementation attempted Spanner,
 * swallowed the failure, and served numbers computed from a local JSON file —
 * which meant the demo showed confident figures that had never touched the
 * database. Every failure here is surfaced to the caller.
 *
 * OWNERSHIP OF THE QUERY: the language model decides the FILTER (the WHERE
 * clause); this module owns the projection, ordering, limit and aggregates.
 * That split means a model that returns the wrong columns, forgets a LIMIT, or
 * invents a RETURN shape cannot break the UI, and it lets us run a genuine
 * COUNT(*) companion query so "matched" is a real population rather than the
 * size of the page we happened to fetch.
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

export interface GraphQueryResult {
  rows: PlayerRow[];
  totalMatched: number;
  aggregates: CohortAggregates;
  isLive: boolean;
  source: string;
  executionTimeMs: number;
  whereClause: string;
  gqlExecuted: string;
}

export class SpannerUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SpannerUnavailableError";
    this.cause = cause;
  }
}

const GRAPH = "ABKPlayerGraph";

/** The projection the application relies on. The model does not get a vote. */
const PLAYER_PROJECTION = [
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
].join(", ");

let cachedDatabase: Database | null = null;

function getDatabase(): Database {
  if (!cachedDatabase) {
    const spanner = new Spanner({ projectId: GCP_CONFIG.projectId });
    cachedDatabase = spanner
      .instance(GCP_CONFIG.spannerInstanceId)
      .database(GCP_CONFIG.spannerDatabaseId);
  }
  return cachedDatabase;
}

/**
 * Pull the WHERE clause out of a generated GQL query.
 *
 * Returns an empty string when the query has no filter, which legitimately
 * means "the whole population".
 */
export function extractWhereClause(gql: string): string {
  if (!gql) return "";
  const match = gql.match(
    /\bWHERE\b([\s\S]*?)(?:\bRETURN\b|\bORDER\s+BY\b|\bLIMIT\b|\bNEXT\b|$)/i
  );
  return match ? match[1].trim().replace(/;$/, "").trim() : "";
}

/**
 * Repair the two constructs the model reliably gets wrong.
 *
 * 1. Array membership. Models emit `'COD' IN p.franchises_played`, which is
 *    Cypher-flavoured and invalid in GoogleSQL; it needs UNNEST.
 * 2. Double-quoted string literals, which GoogleSQL accepts in most contexts
 *    but which we normalise for consistency.
 */
export function normalizeWhereClause(where: string): string {
  if (!where) return "";
  let out = where;

  // 'X' IN p.array_field  ->  'X' IN UNNEST(p.array_field)
  out = out.replace(
    /('(?:[^']*)'|"(?:[^"]*)")\s+IN\s+(p\.[a-zA-Z_0-9]+)(?!\s*\()/gi,
    (_m, literal, field) => `${literal} IN UNNEST(${field})`
  );

  return out.trim();
}

function buildWhereFragment(where: string): string {
  return where ? `WHERE ${where}\n` : "";
}

function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && typeof v.value !== "undefined") return Number(v.value);
  return Number(v);
}

function toNullableNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  return toNumber(v);
}

function parseJsonColumn(v: any, fallback: any) {
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

function mapPlayerRow(raw: any): PlayerRow {
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

async function runGql(database: Database, sql: string): Promise<any[]> {
  const [rows] = await database.run({ sql });
  return rows.map((r: any) => r.toJSON());
}

/**
 * Execute a cohort query against the live graph.
 *
 * @param generatedGql  Full GQL from the translator. Only its WHERE clause is used.
 * @param renderLimit   How many player rows to return for rendering.
 */
export async function runSpannerGraphQuery(
  generatedGql: string,
  renderLimit = 56
): Promise<GraphQueryResult> {
  const started = Date.now();
  const database = getDatabase();

  const where = normalizeWhereClause(extractWhereClause(generatedGql));
  const whereFragment = buildWhereFragment(where);

  const rowsSql =
    `GRAPH ${GRAPH}\n` +
    `MATCH (p:Player)\n` +
    whereFragment +
    `RETURN ${PLAYER_PROJECTION}\n` +
    `ORDER BY p.lifetime_spend_usd DESC\n` +
    `LIMIT ${Math.max(1, Math.floor(renderLimit))}`;

  // A genuine population count, not the size of the page above.
  const statsSql =
    `GRAPH ${GRAPH}\n` +
    `MATCH (p:Player)\n` +
    whereFragment +
    `RETURN COUNT(*) AS total,\n` +
    `       AVG(p.lifetime_spend_usd) AS avg_spend,\n` +
    `       AVG(p.churn_risk_score) AS avg_churn,\n` +
    `       AVG(p.tilt_sensitivity) AS avg_tilt,\n` +
    `       COUNTIF(p.churn_risk_score >= 0.7) AS high_churn`;

  const archetypeSql =
    `GRAPH ${GRAPH}\nMATCH (p:Player)\n` +
    whereFragment +
    `RETURN p.primary_archetype AS k, COUNT(*) AS n\nGROUP BY k\nORDER BY n DESC`;

  const countrySql =
    `GRAPH ${GRAPH}\nMATCH (p:Player)\n` +
    whereFragment +
    `RETURN p.country AS k, COUNT(*) AS n\nGROUP BY k\nORDER BY n DESC`;

  const franchiseSql =
    `GRAPH ${GRAPH}\nMATCH (p:Player)\n` +
    whereFragment +
    `RETURN p.primary_franchise AS k, COUNT(*) AS n\nGROUP BY k\nORDER BY n DESC`;

  let results: any[][];
  try {
    results = await Promise.all([
      runGql(database, rowsSql),
      runGql(database, statsSql),
      runGql(database, archetypeSql),
      runGql(database, countrySql),
      runGql(database, franchiseSql),
    ]);
  } catch (e: any) {
    // Loud, specific, and carrying the SQL so the failure is diagnosable.
    throw new SpannerUnavailableError(
      `Spanner graph query failed: ${e?.message || e}. WHERE clause was: ${
        where || "(none)"
      }`,
      e
    );
  }

  const [rawRows, statsRows, archRows, countryRows, franchiseRows] = results;

  const stats = statsRows[0] || {};
  const histogram = (rows: any[]) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      if (r.k !== null && r.k !== undefined) acc[r.k] = toNumber(r.n);
      return acc;
    }, {});

  const archetypeHistogram = histogram(archRows);
  const dominantArchetype =
    Object.entries(archetypeHistogram).sort((a, b) => b[1] - a[1])[0]?.[0] || "UNKNOWN";

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

  return {
    rows: rawRows.map(mapPlayerRow),
    totalMatched: aggregates.totalMatched,
    aggregates,
    isLive: true,
    source: `spanner://${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}`,
    executionTimeMs: Date.now() - started,
    whereClause: where,
    gqlExecuted: rowsSql,
  };
}

/** Arbitrary read-only GQL, for panels that need their own shape. */
export async function runRawGql(sql: string): Promise<any[]> {
  try {
    return await runGql(getDatabase(), sql);
  } catch (e: any) {
    throw new SpannerUnavailableError(`Spanner query failed: ${e?.message || e}`, e);
  }
}

/** Connectivity probe used by the health endpoint and the UI status pill. */
export async function checkSpannerHealth(): Promise<{
  ok: boolean;
  database: string;
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
      playerCount: toNumber(rows[0]?.total),
      latencyMs: Date.now() - started,
    };
  } catch (e: any) {
    return {
      ok: false,
      database,
      latencyMs: Date.now() - started,
      error: e?.message || String(e),
    };
  }
}
