/**
 * Crew · Churn + Section C data layer (2K Courtside v2).
 *
 * Every function here executes live:
 *   - Spanner Graph (`TakeTwoPlayerGraph` in `twok_graph_db_v2`) for churn
 *     exposure, keystones, crew lineage and target resolution.
 *   - BigQuery (`twok_marketing_intelligence.v2_*`) for the anchor-dependency
 *     diff-in-diff and the Section C history join.
 *   - BigQuery EXTERNAL_QUERY -> Spanner for "crews that lost a core member",
 *     so the relational read and the analytical join are ONE statement.
 *
 * Zero data fallbacks: failures throw `CrewServiceError` carrying the GCP
 * service, resource and original message; routes turn it into a 502/503.
 */
import { GCP_CONFIG } from "@/lib/config";
import { getBigQueryClient } from "@/lib/gcp/bigquery-client";
import {
  GRAPH,
  runRawGql,
  SpannerUnavailableError,
  toNumber,
} from "@/lib/gcp/spanner-client";

/* ------------------------------------------------------------------ */
/* Config + errors                                                     */
/* ------------------------------------------------------------------ */

export const SPANNER_CONNECTION =
  process.env.BQ_SPANNER_CONNECTION ||
  "projects/jamie-bq-test/locations/us/connections/twok-spanner-v2";

/** BigQuery job location follows the connection's location (US multi-region by default). */
export const BQ_LOCATION = (() => {
  const m = SPANNER_CONNECTION.match(/\/locations\/([^/]+)\//);
  const loc = m ? m[1] : "US";
  return loc.toLowerCase() === "us" ? "US" : loc.toLowerCase() === "eu" ? "EU" : loc;
})();

/** NBA 2K VC store price used to convert VC bookings to USD: 75,000 VC = $19.99. */
export const VC_PER_USD = 75000 / 19.99;

const SPANNER_RESOURCE = () =>
  `spanner://projects/${GCP_CONFIG.projectId}/instances/${GCP_CONFIG.spannerInstanceId}/databases/${GCP_CONFIG.spannerDatabaseId}`;
const BQ_DATASET_RESOURCE = () => `bigquery://${GCP_CONFIG.projectId}.${GCP_CONFIG.bqDatasetId}`;

export type CrewService = "cloud-spanner" | "bigquery" | "bigquery+spanner" | "pubsub";

export class CrewServiceError extends Error {
  readonly service: CrewService;
  readonly resource: string;
  readonly status: number;
  readonly query?: string;
  readonly missingResource?: string;
  constructor(opts: {
    service: CrewService;
    resource: string;
    message: string;
    status?: number;
    query?: string;
    missingResource?: string;
  }) {
    super(opts.message);
    this.name = "CrewServiceError";
    this.service = opts.service;
    this.resource = opts.resource;
    this.status = opts.status ?? 503;
    this.query = opts.query;
    this.missingResource = opts.missingResource;
  }
  toJSON() {
    return {
      error: this.message,
      service: this.service,
      resource: this.resource,
      missing_resource: this.missingResource ?? null,
      query: this.query ?? null,
    };
  }
}

/* ------------------------------------------------------------------ */
/* 15-min per-process cache of LIVE results (same contract as Home's   */
/* weekly-briefing): stamped computed_at, never from static data, never */
/* served past TTL, never populated by a failure; `fresh` recomputes.   */
/* ------------------------------------------------------------------ */
const CACHE_TTL_MS = 15 * 60 * 1000;
const gCache = globalThis as unknown as {
  __crewLiveCache?: Map<string, { at: number; value: unknown }>;
  __crewLiveInflight?: Map<string, Promise<{ at: number; value: unknown }>>;
};
const liveCache = (gCache.__crewLiveCache ??= new Map());
const liveInflight = (gCache.__crewLiveInflight ??= new Map());

export async function cachedLive<V>(
  name: string,
  params: Record<string, string | number>,
  fresh: boolean,
  compute: () => Promise<V>,
): Promise<{ value: V; cache: "hit" | "miss"; computed_at: string }> {
  const key = JSON.stringify([
    name,
    GCP_CONFIG.projectId,
    GCP_CONFIG.spannerInstanceId,
    GCP_CONFIG.spannerDatabaseId,
    GCP_CONFIG.bqDatasetId,
    SPANNER_CONNECTION,
    params,
  ]);
  const hit = liveCache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { value: hit.value as V, cache: "hit", computed_at: new Date(hit.at).toISOString() };
  }
  let p = liveInflight.get(key);
  if (!p) {
    p = compute()
      .then((value) => {
        const entry = { at: Date.now(), value };
        liveCache.set(key, entry);
        return entry;
      })
      .finally(() => liveInflight.delete(key));
    liveInflight.set(key, p);
  }
  const entry = await p;
  return { value: entry.value as V, cache: "miss", computed_at: new Date(entry.at).toISOString() };
}

/** Map any thrown error to an explicit HTTP error body (never a canned payload). */
export function crewErrorBody(e: unknown, route: string): { status: number; body: Record<string, any> } {
  if (e instanceof CrewServiceError) {
    console.error(`[${route}] ${e.service} ${e.resource}: ${e.message}`);
    return { status: e.status, body: { route, ...e.toJSON() } };
  }
  const err = e as any;
  console.error(`[${route}] unexpected error`, err);
  return {
    status: 500,
    body: { route, error: err?.message || String(err), service: "app", resource: route, stack: err?.stack ?? null },
  };
}

/** Run a Spanner GQL/SQL statement and re-throw with service + resource details. */
async function spanner(sql: string, params?: Record<string, any>): Promise<any[]> {
  try {
    return await runRawGql(sql, params);
  } catch (e: any) {
    const msg = e instanceof SpannerUnavailableError ? e.message : `Spanner query failed: ${e?.message || e}`;
    throw new CrewServiceError({
      service: "cloud-spanner",
      resource: SPANNER_RESOURCE(),
      message: msg,
      query: sql,
    });
  }
}

export interface BqRun<T> {
  rows: T[];
  jobId: string | null;
  bytesProcessed: number;
  elapsedMs: number;
}

async function bigquery<T = Record<string, any>>(
  sql: string,
  params: Record<string, any> | undefined,
  service: CrewService = "bigquery",
): Promise<BqRun<T>> {
  const started = Date.now();
  try {
    const client = getBigQueryClient();
    const [job] = await client.createQueryJob({
      query: sql,
      params,
      location: BQ_LOCATION,
      useLegacySql: false,
    });
    const [rows] = await job.getQueryResults();
    const [meta] = await job.getMetadata();
    const bytes = Number(meta?.statistics?.totalBytesProcessed || 0);
    return { rows: rows as T[], jobId: job.id ?? null, bytesProcessed: bytes, elapsedMs: Date.now() - started };
  } catch (e: any) {
    const message: string = e?.message || String(e);
    const connMissing = /connection/i.test(message) && /(not found|does not exist|404)/i.test(message);
    const tableMissing = /Not found: Table/i.test(message);
    throw new CrewServiceError({
      service,
      resource: connMissing ? `bigquery-connection://${SPANNER_CONNECTION}` : BQ_DATASET_RESOURCE(),
      message: `BigQuery query failed (location ${BQ_LOCATION}): ${message}`,
      query: sql,
      missingResource: connMissing
        ? SPANNER_CONNECTION
        : tableMissing
          ? (message.match(/Not found: Table ([^\s]+)/i)?.[1] ?? "table")
          : undefined,
    });
  }
}

const T = (table: string) => `\`${GCP_CONFIG.projectId}.${GCP_CONFIG.bqDatasetId}.${table}\``;

function iso(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v?.toISOString === "function") return v.toISOString();
  if (typeof v?.value === "string") return v.value;
  return String(v);
}

function num(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && v !== null && "value" in v) return Number((v as any).value);
  return toNumber(v);
}

function round(n: number, d = 3): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/**
 * Data as-of: the latest player activity in Spanner. Windows ("last 14 days",
 * "this week") are measured from here so they track the live snapshot.
 */
export const AS_OF_SQL = `SELECT MAX(last_active_at) AS t FROM Players`;
export async function getAsOf(): Promise<string> {
  const rows = await spanner(AS_OF_SQL);
  const t = iso(rows[0]?.t);
  if (!t) {
    throw new CrewServiceError({
      service: "cloud-spanner",
      resource: SPANNER_RESOURCE(),
      status: 502,
      message: "Players.last_active_at is empty; cannot anchor time windows.",
      query: AS_OF_SQL,
    });
  }
  return t;
}

/* ------------------------------------------------------------------ */
/* Types (UI imports these with `import type`)                         */
/* ------------------------------------------------------------------ */

export interface ChurnExposureBucket {
  bucket: number;
  label: string;
  lo: number;
  hi: number;
  /** Active players whose co-play-neighbor churn share falls in this bucket. */
  players: number;
}

export interface ChurnExposureSummary {
  /** Active players with >= 1 PLAYED_WITH neighbor. */
  players: number;
  /** Active players with >= 1 neighbor churned in the last 14 days (exposed right now). */
  exposed_players: number;
  /** Mantel-Haenszel hazard ratio (stratified by archetype), exposed vs. unexposed person-days. */
  hazard_ratio: number | null;
  hr_ci_low: number | null;
  hr_ci_high: number | null;
  crude_hazard_ratio: number | null;
  events_exposed: number;
  person_days_exposed: number;
  events_unexposed: number;
  person_days_unexposed: number;
  window_days: number;
}

export interface AnchorDependency {
  /** Relative D14 retention gap, treated vs. matched control, in percent (negative = drop). */
  lift_pct: number;
  ci_low: number;
  ci_high: number;
  /** Diff-in-diff (D14 minus pre-event baseline, treated minus control), percentage points. */
  did_pp: number;
  did_ci_low: number;
  did_ci_high: number;
  n_treated: number;
  n_control: number;
  members_treated: number;
  members_control: number;
  retention_treated_pre: number;
  retention_treated_post: number;
  retention_control_pre: number;
  retention_control_post: number;
  as_of: string | null;
  method: string;
  sql: string;
  bigquery_job_id: string | null;
  bytes_processed: number;
  latency_ms: number;
}

export interface Keystone {
  player_id: string;
  gamer_tag: string;
  clan_id: string;
  clan_name: string;
  crew_centrality: number;
  session_min_7d: number;
  session_min_prev_7d: number;
  session_ratio: number;
  crewmates: number;
  crewmates_spend_usd: number;
  lifetime_spend_usd: number;
  /** crewmates x anchor-dependency drop: expected crewmates lost if this keystone churns. */
  cluster_at_risk: number;
}

export interface KeystoneSummary {
  threshold: number;
  active_memberships: number;
  keystone_total: number;
  keystone_pct: number;
  declining: number;
}

export interface CrewDynamics {
  splits_90d: number;
  reforms_90d: number;
  events_30d: Record<string, number>;
  featured_crew_id: string | null;
  featured_crew_name: string | null;
  answer: string;
}

export interface RetentionOffer {
  id: string;
  title: string;
  priceUsd: number;
  vc_grant: number;
  item: { item_id: string; name: string; item_type: string; brand: string; vc_price: number | null; crewmate_buys: number } | null;
  item_selection: string;
}

export interface CrewChurnResponse {
  as_of: string;
  churn_exposure_dist: ChurnExposureBucket[];
  churn_exposure_summary: ChurnExposureSummary;
  anchor_dependency: AnchorDependency;
  keystones: Keystone[];
  keystone_summary: KeystoneSummary;
  dynamics: CrewDynamics;
  retention_offer: RetentionOffer;
  gql: string;
  queries: Record<string, string>;
  engines: string[];
  database: string;
  latency_ms: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* 1a. Churn exposure (Spanner GQL over undirected PLAYED_WITH)        */
/* ------------------------------------------------------------------ */

/** 2K players only. On the Take-Two portfolio database the crew metrics stay 2K (Rockstar / Zynga
 *  players and crews are excluded); on the 2K-only database this matches every player. */
export const TWOK_PLAYERS = `primary_franchise IN (SELECT franchise FROM Games WHERE is_parent_hub = true AND label NOT IN ('ROCKSTAR', 'ZYNGA'))`;
const NON_2K_CREW_FRANCHISES = `('GTAO', 'RDO', 'WWF', 'MATCHFACTORY', 'TOONBLAST', 'CSR2', 'EMPIRES', 'ZPOKER')`;

const EXPOSURE_LABELS = ["0%", "0–10%", "10–20%", "20–30%", "30–40%", "40–50%", "50%+"];

/** Distribution: share of each ACTIVE player's co-play neighbors who churned in the last 14 days. */
export const CHURN_EXPOSURE_GQL = `-- Churn exposure: share of each active player's co-play neighbors who churned in the last 14 days.
-- PlayedWith backs the PLAYED_WITH edge and stores one row per unordered pair, so both orientations
-- are unioned (undirected). Hash joins keep the full-graph scan sub-second.
WITH pairs AS (
  SELECT player_id AS a, other_player_id AS b FROM PlayedWith
  UNION ALL
  SELECT other_player_id AS a, player_id AS b FROM PlayedWith
),
pl AS (SELECT player_id, churned_at FROM Players WHERE ${TWOK_PLAYERS})
SELECT IF(exposure = 0, 0, LEAST(6, CAST(CEIL(exposure * 10) AS INT64))) AS bucket, COUNT(*) AS players
FROM (
  SELECT pairs.a AS player_id,
    SAFE_DIVIDE(
      COUNTIF(nb.churned_at >= TIMESTAMP_SUB(CAST(@as_of AS TIMESTAMP), INTERVAL 14 DAY)),
      COUNT(*)) AS exposure
  FROM pairs
  JOIN @{JOIN_METHOD=HASH_JOIN} pl pa ON pa.player_id = pairs.a
  JOIN @{JOIN_METHOD=HASH_JOIN} pl nb ON nb.player_id = pairs.b
  WHERE pa.churned_at IS NULL
  GROUP BY pairs.a
)
GROUP BY bucket
ORDER BY bucket`;

/**
 * Hazard: discrete-time person-day model over window days 14..89 (same definition as
 * scripts/validate_dataset_v2.py). Event = churned_at falls on day t. Exposed on day t =
 * >= 1 PLAYED_WITH neighbor churned in [t-14, t-1]. Spanner returns every (player, churned
 * neighbor day) pair live; person-days are tallied per archetype for Mantel-Haenszel.
 */
export const CHURN_NEIGHBOR_GQL = `-- Every (player, churned PLAYED_WITH neighbor) pair, undirected, with the neighbor's churn day index
WITH ch AS (SELECT player_id, churned_at FROM Players WHERE churned_at IS NOT NULL AND ${TWOK_PLAYERS})
SELECT pw.player_id AS player_id,
  DATE_DIFF(DATE(ch.churned_at, "UTC"), DATE(CAST(@as_of AS TIMESTAMP), "UTC"), DAY) + 89 AS nc
FROM PlayedWith pw JOIN @{JOIN_METHOD=HASH_JOIN} ch ON ch.player_id = pw.other_player_id
UNION ALL
SELECT pw.other_player_id AS player_id,
  DATE_DIFF(DATE(ch.churned_at, "UTC"), DATE(CAST(@as_of AS TIMESTAMP), "UTC"), DAY) + 89 AS nc
FROM PlayedWith pw JOIN @{JOIN_METHOD=HASH_JOIN} ch ON ch.player_id = pw.player_id`;

export const CHURN_PLAYERS_SQL = `SELECT player_id, primary_archetype AS arch,
  IF(churned_at IS NULL, NULL, DATE_DIFF(DATE(churned_at, "UTC"), DATE(CAST(@as_of AS TIMESTAMP), "UTC"), DAY) + 89) AS c
FROM Players WHERE ${TWOK_PLAYERS}`;

export async function getChurnExposure(asOf: string): Promise<{
  dist: ChurnExposureBucket[];
  summary: ChurnExposureSummary;
  ms: number;
}> {
  const started = Date.now();
  const [distRows, nbrRows, playerRows] = await Promise.all([
    spanner(CHURN_EXPOSURE_GQL, { as_of: asOf }),
    spanner(CHURN_NEIGHBOR_GQL, { as_of: asOf }),
    spanner(CHURN_PLAYERS_SQL, { as_of: asOf }),
  ]);
  const byBucket = new Map<number, number>();
  for (const r of distRows) byBucket.set(num(r.bucket), num(r.players));
  const dist: ChurnExposureBucket[] = EXPOSURE_LABELS.map((label, b) => ({
    bucket: b,
    label,
    lo: b === 0 ? 0 : (b - 1) / 10,
    hi: b === 0 ? 0 : b === 6 ? 1 : b / 10,
    players: byBucket.get(b) ?? 0,
  }));
  const players = dist.reduce((s, d) => s + d.players, 0);
  const exposedPlayers = players - dist[0].players;

  // Exposure mask per player: days covered by [nc+1, nc+14] of any churned neighbor.
  const WINDOW = 90;
  const masks = new Map<string, Uint8Array>();
  for (const r of nbrRows) {
    const pid = String(r.player_id);
    const nc = num(r.nc);
    let m = masks.get(pid);
    if (!m) {
      m = new Uint8Array(WINDOW);
      masks.set(pid, m);
    }
    for (let t = Math.max(0, nc + 1); t <= Math.min(WINDOW - 1, nc + 14); t++) m[t] = 1;
  }
  // Per-archetype strata: a = exposed events, t1 = exposed person-days, b / t0 unexposed.
  const strata = new Map<string, { a: number; t1: number; b: number; t0: number }>();
  for (const r of playerRows) {
    const arch = String(r.arch);
    const c = r.c === null || r.c === undefined ? null : num(r.c);
    const last = c === null ? WINDOW - 1 : c;
    const m = masks.get(String(r.player_id));
    const st = strata.get(arch) ?? { a: 0, t1: 0, b: 0, t0: 0 };
    for (let t = 14; t <= last; t++) {
      const ev = c !== null && t === c ? 1 : 0;
      if (m && m[t]) {
        st.a += ev;
        st.t1 += 1;
      } else {
        st.b += ev;
        st.t0 += 1;
      }
    }
    strata.set(arch, st);
  }

  // Crude rate ratio + Mantel-Haenszel RR (person-time) with Greenland-Robins variance.
  let A = 0, T1 = 0, B = 0, T0 = 0, mhNum = 0, mhDen = 0, varNum = 0;
  for (const { a, t1, b, t0 } of Array.from(strata.values())) {
    A += a; T1 += t1; B += b; T0 += t0;
    const T = t1 + t0;
    if (T > 0) {
      mhNum += (a * t0) / T;
      mhDen += (b * t1) / T;
      varNum += (t1 * t0 * (a + b)) / (T * T);
    }
  }
  let hr: number | null = null, lo: number | null = null, hi: number | null = null, crude: number | null = null;
  if (A > 0 && B > 0 && T1 > 0 && T0 > 0) crude = (A / T1) / (B / T0);
  if (mhNum > 0 && mhDen > 0) {
    hr = mhNum / mhDen;
    const se = Math.sqrt(varNum / (mhNum * mhDen));
    lo = hr * Math.exp(-1.96 * se);
    hi = hr * Math.exp(1.96 * se);
  }
  return {
    dist,
    summary: {
      players,
      exposed_players: exposedPlayers,
      hazard_ratio: hr === null ? null : round(hr, 2),
      hr_ci_low: lo === null ? null : round(lo, 2),
      hr_ci_high: hi === null ? null : round(hi, 2),
      crude_hazard_ratio: crude === null ? null : round(crude, 2),
      events_exposed: A,
      person_days_exposed: T1,
      events_unexposed: B,
      person_days_unexposed: T0,
      window_days: 14,
    },
    ms: Date.now() - started,
  };
}

/* ------------------------------------------------------------------ */
/* 1b. Anchor dependency (BigQuery diff-in-diff)                       */
/* ------------------------------------------------------------------ */

export function anchorDependencySql(): string {
  return `-- Anchor dependency: D14 retention of crewmates after a top-centrality departure, vs. matched crews
-- top-centrality departure = MemberOfClan row with left_at set AND crew_centrality = 1.0, 14..60d before as_of
-- control  = size-matched crews with no top-centrality departure in 90d, given the matched exit date T
-- D14 retention = session in [T+7, T+13] among members active in [T-7, T-1]
-- baseline      = session in [T-14, T-8] among members active in [T-28, T-22] (same lag, pre-event)
WITH as_of AS (SELECT MAX(date) AS d FROM ${T("v2_sessions_daily")}),
mem AS (
  SELECT player_id, clan_id, DATE(joined_at) AS joined_d, DATE(left_at) AS left_d, crew_centrality
  FROM ${T("v2_member_of_clan")}
),
crew_size AS (
  SELECT m.clan_id, COUNT(*) AS n_members
  FROM mem m CROSS JOIN as_of a
  WHERE m.joined_d <= DATE_SUB(a.d, INTERVAL 60 DAY)
    AND (m.left_d IS NULL OR m.left_d > DATE_SUB(a.d, INTERVAL 60 DAY))
  GROUP BY m.clan_id
),
departures AS (
  SELECT clan_id, player_id AS anchor_id, left_d AS t
  FROM mem
  WHERE left_d IS NOT NULL AND crew_centrality = 1.0
),
treated AS (
  SELECT d.clan_id, d.anchor_id, d.t, LEAST(DIV(cs.n_members, 10), 4) AS size_b
  FROM departures d
  JOIN crew_size cs USING (clan_id)
  CROSS JOIN as_of a
  WHERE d.t BETWEEN DATE_SUB(a.d, INTERVAL 60 DAY) AND DATE_SUB(a.d, INTERVAL 14 DAY)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY d.clan_id ORDER BY d.t DESC) = 1
),
treated_rn AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY size_b ORDER BY clan_id) - 1 AS rn,
    COUNT(*) OVER (PARTITION BY size_b) AS nb
  FROM treated
),
control_base AS (
  SELECT cs.clan_id, LEAST(DIV(cs.n_members, 10), 4) AS size_b,
    (SELECT ANY_VALUE(m.player_id) FROM mem m
     WHERE m.clan_id = cs.clan_id AND m.crew_centrality = 1.0 AND m.left_d IS NULL) AS anchor_id
  FROM crew_size cs
  WHERE cs.clan_id NOT IN (
    SELECT d.clan_id FROM departures d CROSS JOIN as_of a
    WHERE d.t >= DATE_SUB(a.d, INTERVAL 90 DAY))
),
controls AS (
  SELECT c.clan_id, c.anchor_id, t.t
  FROM control_base c
  JOIN treated_rn t
    ON t.size_b = c.size_b
   AND MOD(ABS(MOD(FARM_FINGERPRINT(c.clan_id), 1000003)), t.nb) = t.rn
),
cohort AS (
  SELECT clan_id, anchor_id, t, 'treated' AS grp FROM treated
  UNION ALL
  SELECT clan_id, anchor_id, t, 'control' AS grp FROM controls
),
members_at_t AS (
  SELECT c.clan_id, c.grp, c.t, m.player_id
  FROM cohort c
  JOIN mem m ON m.clan_id = c.clan_id
  WHERE (c.anchor_id IS NULL OR m.player_id != c.anchor_id)
    AND m.joined_d <= DATE_SUB(c.t, INTERVAL 28 DAY)
    AND (m.left_d IS NULL OR m.left_d >= c.t)
),
activity AS (
  SELECT x.clan_id, x.grp, x.player_id,
    COUNTIF(s.date BETWEEN DATE_SUB(x.t, INTERVAL 28 DAY) AND DATE_SUB(x.t, INTERVAL 22 DAY)) > 0 AS base_cohort,
    COUNTIF(s.date BETWEEN DATE_SUB(x.t, INTERVAL 14 DAY) AND DATE_SUB(x.t, INTERVAL 8 DAY)) > 0 AS base_retained,
    COUNTIF(s.date BETWEEN DATE_SUB(x.t, INTERVAL 7 DAY) AND DATE_SUB(x.t, INTERVAL 1 DAY)) > 0 AS cohort,
    COUNTIF(s.date BETWEEN DATE_ADD(x.t, INTERVAL 7 DAY) AND DATE_ADD(x.t, INTERVAL 13 DAY)) > 0 AS retained
  FROM members_at_t x
  LEFT JOIN ${T("v2_sessions_daily")} s
    ON s.player_id = x.player_id
   AND s.session_minutes > 0
   AND s.date BETWEEN DATE_SUB(x.t, INTERVAL 28 DAY) AND DATE_ADD(x.t, INTERVAL 13 DAY)
  GROUP BY x.clan_id, x.grp, x.player_id
),
per_crew AS (
  SELECT clan_id, grp,
    COUNTIF(cohort) AS n_cohort,
    SAFE_DIVIDE(COUNTIF(cohort AND retained), COUNTIF(cohort)) AS d14,
    SAFE_DIVIDE(COUNTIF(base_cohort AND base_retained), COUNTIF(base_cohort)) AS base
  FROM activity
  GROUP BY clan_id, grp
  HAVING COUNTIF(cohort) >= 3 AND COUNTIF(base_cohort) >= 3
),
agg AS (
  SELECT grp,
    COUNT(*) AS n_crews,
    SUM(n_cohort) AS n_members,
    AVG(d14) AS mean_d14, VAR_SAMP(d14) AS var_d14,
    AVG(base) AS mean_base,
    AVG(d14 - base) AS mean_diff, VAR_SAMP(d14 - base) AS var_diff
  FROM per_crew
  GROUP BY grp
)
SELECT
  t.n_crews AS n_treated, c.n_crews AS n_control,
  t.n_members AS members_treated, c.n_members AS members_control,
  t.mean_d14 AS d14_treated, c.mean_d14 AS d14_control,
  IFNULL(t.var_d14, 0) AS var_d14_treated, IFNULL(c.var_d14, 0) AS var_d14_control,
  t.mean_base AS base_treated, c.mean_base AS base_control,
  t.mean_diff - c.mean_diff AS did,
  SQRT(IFNULL(t.var_diff, 0) / t.n_crews + IFNULL(c.var_diff, 0) / c.n_crews) AS did_se,
  (SELECT d FROM as_of) AS as_of
FROM (SELECT * FROM agg WHERE grp = 'treated') t
CROSS JOIN (SELECT * FROM agg WHERE grp = 'control') c`;
}

export async function getAnchorDependency(): Promise<AnchorDependency> {
  const sql = anchorDependencySql();
  const run = await bigquery<any>(sql, undefined);
  const r = run.rows[0];
  if (!r) {
    throw new CrewServiceError({
      service: "bigquery",
      resource: BQ_DATASET_RESOURCE(),
      status: 502,
      message:
        "Anchor dependency returned no rows: no treated crews (crew_centrality = 1.0 member left 14-60d before as_of) or no size-matched controls in v2_member_of_clan / v2_sessions_daily.",
      query: sql,
    });
  }
  const nT = num(r.n_treated);
  const nC = num(r.n_control);
  const mT = num(r.d14_treated);
  const mC = num(r.d14_control);
  // Ratio of mean D14 retention, delta-method CI on log scale.
  const ratio = mC > 0 ? mT / mC : NaN;
  const seLog =
    mT > 0 && mC > 0 ? Math.sqrt(num(r.var_d14_treated) / (nT * mT * mT) + num(r.var_d14_control) / (nC * mC * mC)) : NaN;
  if (!Number.isFinite(ratio) || !Number.isFinite(seLog)) {
    throw new CrewServiceError({
      service: "bigquery",
      resource: BQ_DATASET_RESOURCE(),
      status: 502,
      message: `Anchor dependency is undefined: D14 retention treated=${mT}, control=${mC} (n=${nT}/${nC}).`,
      query: sql,
    });
  }
  const did = num(r.did);
  const didSe = num(r.did_se);
  return {
    lift_pct: round((ratio - 1) * 100, 1),
    ci_low: round((Math.exp(Math.log(ratio) - 1.96 * seLog) - 1) * 100, 1),
    ci_high: round((Math.exp(Math.log(ratio) + 1.96 * seLog) - 1) * 100, 1),
    did_pp: round(did * 100, 1),
    did_ci_low: round((did - 1.96 * didSe) * 100, 1),
    did_ci_high: round((did + 1.96 * didSe) * 100, 1),
    n_treated: nT,
    n_control: nC,
    members_treated: num(r.members_treated),
    members_control: num(r.members_control),
    retention_treated_pre: round(num(r.base_treated), 4),
    retention_treated_post: round(mT, 4),
    retention_control_pre: round(num(r.base_control), 4),
    retention_control_post: round(mC, 4),
    as_of: iso(r.as_of),
    method:
      "D14 retention = session in [T+7, T+13] among crewmates active in [T-7, T-1], T = exit of the crew_centrality 1.0 member (14-60d ago). Controls: size-matched crews with no such exit in 90d, pseudo-event at the matched T. lift_pct = treated / control - 1 (95% CI, delta method). Diff-in-diff vs. a pre-event baseline (same lag, [T-28, T-22] -> [T-14, T-8]) in did_pp.",
    sql,
    bigquery_job_id: run.jobId,
    bytes_processed: run.bytesProcessed,
    latency_ms: run.elapsedMs,
  };
}

/* ------------------------------------------------------------------ */
/* 1c. Keystones (Spanner GQL)                                         */
/* ------------------------------------------------------------------ */

/** Canonical keystone definition (matches scripts/validate_dataset_v2.py): active member, crew_centrality >= 0.9. */
export const KEYSTONE_THRESHOLD = 0.9;

export const KEYSTONE_GQL = `GRAPH ${GRAPH}
MATCH (p:Player)-[m:MEMBER_OF_CLAN]->(c:Clan)<-[m2:MEMBER_OF_CLAN]-(mate:Player)
WHERE m.is_active AND m.crew_centrality >= @threshold
  AND c.franchise NOT IN ${NON_2K_CREW_FRANCHISES}
  AND p.churned_at IS NULL
  AND p.session_min_prev_7d > 0
  AND p.session_min_7d / p.session_min_prev_7d < 0.7
  AND m2.is_active AND mate.player_id <> p.player_id
RETURN p.player_id AS player_id,
       c.clan_id AS clan_id,
       ANY_VALUE(p.gamer_tag) AS gamer_tag,
       ANY_VALUE(c.name) AS clan_name,
       ANY_VALUE(m.crew_centrality) AS crew_centrality,
       ANY_VALUE(p.session_min_7d) AS session_min_7d,
       ANY_VALUE(p.session_min_prev_7d) AS session_min_prev_7d,
       ANY_VALUE(p.lifetime_spend_usd) AS lifetime_spend_usd,
       COUNT(mate.player_id) AS crewmates,
       SUM(mate.lifetime_spend_usd) AS crewmates_spend_usd
GROUP BY player_id, clan_id
ORDER BY crew_centrality DESC
LIMIT 200`;

export async function getKeystones(): Promise<{ rows: Omit<Keystone, "cluster_at_risk">[]; summary: KeystoneSummary; ms: number }> {
  const started = Date.now();
  const [cnt] = await spanner(
    `SELECT COUNT(*) AS n FROM MemberOfClan WHERE is_active = TRUE`,
  );
  const n = num(cnt?.n);
  if (n === 0) {
    throw new CrewServiceError({
      service: "cloud-spanner",
      resource: SPANNER_RESOURCE(),
      status: 502,
      message: "MemberOfClan has no active memberships (is_active = TRUE); cannot compute keystones.",
    });
  }
  const threshold = KEYSTONE_THRESHOLD;
  const [totalRow, rows] = await Promise.all([
    spanner(
      `SELECT COUNT(*) AS n FROM MemberOfClan WHERE is_active = TRUE AND crew_centrality >= @threshold`,
      { threshold },
    ),
    spanner(KEYSTONE_GQL, { threshold }),
  ]);
  const keystoneTotal = num(totalRow[0]?.n);
  const mapped = rows.map((r) => {
    const s7 = num(r.session_min_7d);
    const sp = num(r.session_min_prev_7d);
    return {
      player_id: String(r.player_id),
      gamer_tag: String(r.gamer_tag ?? r.player_id),
      clan_id: String(r.clan_id),
      clan_name: String(r.clan_name ?? r.clan_id),
      crew_centrality: round(num(r.crew_centrality), 3),
      session_min_7d: round(s7, 1),
      session_min_prev_7d: round(sp, 1),
      session_ratio: sp > 0 ? round(s7 / sp, 3) : 0,
      crewmates: num(r.crewmates),
      crewmates_spend_usd: round(num(r.crewmates_spend_usd), 2),
      lifetime_spend_usd: round(num(r.lifetime_spend_usd), 2),
    };
  });
  return {
    rows: mapped,
    summary: {
      threshold: round(threshold, 4),
      active_memberships: n,
      keystone_total: keystoneTotal,
      keystone_pct: round(keystoneTotal / n, 4),
      declining: mapped.length,
    },
    ms: Date.now() - started,
  };
}

/* ------------------------------------------------------------------ */
/* 1d. Dynamic crews (lineage + membership events)                     */
/* ------------------------------------------------------------------ */

export const DYNAMICS_QUERIES = {
  splits: `SELECT COUNT(*) AS n FROM SplitFrom WHERE split_at >= TIMESTAMP_SUB(CAST(@as_of AS TIMESTAMP), INTERVAL 90 DAY)`,
  events: `SELECT event_type, COUNT(*) AS n
FROM CrewMembershipEvents
WHERE occurred_at >= TIMESTAMP_SUB(CAST(@as_of AS TIMESTAMP), INTERVAL 30 DAY)
GROUP BY event_type`,
  reforms: `-- Re-form: a player leaves / is kicked / splits off, then JOINs a different crew within 14 days
SELECT COUNT(DISTINCT l.player_id) AS n
FROM CrewMembershipEvents l
JOIN CrewMembershipEvents j
  ON j.player_id = l.player_id
 AND j.event_type = 'JOIN'
 AND j.clan_id != l.clan_id
 AND j.occurred_at > l.occurred_at
 AND j.occurred_at <= TIMESTAMP_ADD(l.occurred_at, INTERVAL 14 DAY)
WHERE l.event_type IN ('LEAVE', 'KICK', 'SPLIT')
  AND l.occurred_at >= TIMESTAMP_SUB(CAST(@as_of AS TIMESTAMP), INTERVAL 90 DAY)`,
  featured: `-- Featured lineage: the root crew with the deepest / widest split family (re-splits rank first)
GRAPH ${GRAPH}
MATCH (child:Clan)-[s:SPLIT_FROM]->(parent:Clan)
OPTIONAL MATCH (grand:Clan)-[:SPLIT_FROM]->(child)
RETURN parent.clan_id AS clan_id, ANY_VALUE(parent.name) AS name,
       COUNT(DISTINCT grand.clan_id) AS grandchildren, COUNT(DISTINCT child.clan_id) AS children,
       MAX(s.split_at) AS last_split
GROUP BY clan_id
ORDER BY grandchildren DESC, children DESC, last_split DESC
LIMIT 1`,
};

export async function getDynamics(asOf: string): Promise<{ dynamics: CrewDynamics; ms: number }> {
  const started = Date.now();
  const [splits, events, reforms, featured] = await Promise.all([
    spanner(DYNAMICS_QUERIES.splits, { as_of: asOf }),
    spanner(DYNAMICS_QUERIES.events, { as_of: asOf }),
    spanner(DYNAMICS_QUERIES.reforms, { as_of: asOf }),
    spanner(DYNAMICS_QUERIES.featured),
  ]);
  const ev: Record<string, number> = { JOIN: 0, LEAVE: 0, KICK: 0, SPLIT: 0 };
  for (const r of events) ev[String(r.event_type)] = num(r.n);
  return {
    dynamics: {
      splits_90d: num(splits[0]?.n),
      reforms_90d: num(reforms[0]?.n),
      events_30d: ev,
      featured_crew_id: featured[0]?.clan_id ? String(featured[0].clan_id) : null,
      featured_crew_name: featured[0]?.name ? String(featured[0].name) : null,
      answer:
        "Membership is time-versioned in Spanner: every JOIN, LEAVE, KICK and SPLIT is an event row, MEMBER_OF edges carry joined_at / left_at, and SPLIT_FROM edges keep crew lineage, so splits and re-forms are queried, not guessed.",
    },
    ms: Date.now() - started,
  };
}

/* ------------------------------------------------------------------ */
/* Retention offer (real branded 2K item from the graph)               */
/* ------------------------------------------------------------------ */

export const RETENTION_ITEM_SQL = `-- Exclusive cosmetic for the retention offer: the branded item most bought by the target's crewmates
SELECT i.item_id, i.name, i.item_type, i.vc_price, b.name AS brand, COUNT(*) AS buys
FROM MemberOfClan k
JOIN MemberOfClan mm ON mm.clan_id = k.clan_id AND mm.player_id != k.player_id AND mm.is_active = TRUE
JOIN Bought bo ON bo.player_id = mm.player_id
JOIN Items i ON i.item_id = bo.item_id
JOIN Brands b ON b.brand_id = i.brand_id
WHERE k.player_id IN UNNEST(@ids) AND k.is_active = TRUE
  AND i.is_branded = TRUE AND i.item_type != 'BUNDLE'
GROUP BY i.item_id, i.name, i.item_type, i.vc_price, b.name
ORDER BY buys DESC, i.item_id
LIMIT 1`;

export const RETENTION_ITEM_GLOBAL_SQL = `-- No crewmate purchases for this target: most bought branded cosmetic in the last 30 days
SELECT i.item_id, i.name, i.item_type, i.vc_price, b.name AS brand, COUNT(*) AS buys
FROM Bought bo
JOIN Items i ON i.item_id = bo.item_id
JOIN Brands b ON b.brand_id = i.brand_id
WHERE i.is_branded = TRUE AND i.item_type != 'BUNDLE'
  AND bo.bought_at >= TIMESTAMP_SUB(CAST(@as_of AS TIMESTAMP), INTERVAL 30 DAY)
GROUP BY i.item_id, i.name, i.item_type, i.vc_price, b.name
ORDER BY buys DESC, i.item_id
LIMIT 1`;

export async function resolveRetentionOffer(playerIds: string[]): Promise<RetentionOffer> {
  const asOf = await getAsOf();
  const ids = Array.from(new Set(playerIds.filter(Boolean))).slice(0, 400);
  let rows: any[] = ids.length ? await spanner(RETENTION_ITEM_SQL, { ids }) : [];
  let selection = "Branded cosmetic most bought by the target players' active crewmates (Spanner Bought x Items x Brands).";
  if (rows.length === 0) {
    rows = await spanner(RETENTION_ITEM_GLOBAL_SQL, { as_of: asOf });
    selection = "No crewmate purchases for this target; branded cosmetic most bought across all players in the last 30 days.";
  }
  const r = rows[0];
  const item = r
    ? {
        item_id: String(r.item_id),
        name: String(r.name),
        item_type: String(r.item_type),
        brand: String(r.brand),
        vc_price: r.vc_price === null || r.vc_price === undefined ? null : num(r.vc_price),
        crewmate_buys: num(r.buys),
      }
    : null;
  if (!item) {
    throw new CrewServiceError({
      service: "cloud-spanner",
      resource: SPANNER_RESOURCE(),
      status: 502,
      message: "No branded, non-bundle Items with purchases found in Spanner (Items x Bought x Brands); cannot build the retention cosmetic.",
      query: RETENTION_ITEM_GLOBAL_SQL,
    });
  }
  return {
    id: "keystone-retention",
    title: `Keystone Retention: 10,000 VC + exclusive ${item.name}`,
    priceUsd: 0,
    vc_grant: 10000,
    item,
    item_selection: selection,
  };
}

/* ------------------------------------------------------------------ */
/* GET /api/v2/crew/churn                                              */
/* ------------------------------------------------------------------ */

export async function getCrewChurn(limit = 25): Promise<CrewChurnResponse> {
  const started = Date.now();
  const asOf = await getAsOf();
  const [exposure, anchor, ks, dyn] = await Promise.all([
    getChurnExposure(asOf),
    getAnchorDependency(),
    getKeystones(),
    getDynamics(asOf),
  ]);

  const drop = Math.max(0, -anchor.lift_pct / 100);
  const keystones: Keystone[] = ks.rows
    .map((k) => ({ ...k, cluster_at_risk: round(k.crewmates * drop, 1) }))
    .sort((a, b) => b.cluster_at_risk - a.cluster_at_risk || b.crew_centrality - a.crew_centrality)
    .slice(0, Math.max(1, Math.min(200, limit)));

  const offerStarted = Date.now();
  const retention_offer = await resolveRetentionOffer(keystones.map((k) => k.player_id));
  const offerMs = Date.now() - offerStarted;

  return {
    as_of: asOf,
    churn_exposure_dist: exposure.dist,
    churn_exposure_summary: exposure.summary,
    anchor_dependency: anchor,
    keystones,
    keystone_summary: ks.summary,
    dynamics: dyn.dynamics,
    retention_offer,
    gql: CHURN_EXPOSURE_GQL,
    queries: {
      churn_exposure: CHURN_EXPOSURE_GQL,
      churn_neighbors: CHURN_NEIGHBOR_GQL,
      churn_players: CHURN_PLAYERS_SQL,
      keystones: KEYSTONE_GQL,
      anchor_dependency: anchor.sql,
      splits: DYNAMICS_QUERIES.splits,
      reforms: DYNAMICS_QUERIES.reforms,
      featured_lineage: DYNAMICS_QUERIES.featured,
      retention_item: RETENTION_ITEM_SQL,
    },
    engines: ["spanner", "bigquery"],
    database: SPANNER_RESOURCE(),
    latency_ms: {
      total: Date.now() - started,
      spanner_churn_exposure: exposure.ms,
      spanner_keystones: ks.ms,
      spanner_dynamics: dyn.ms,
      bigquery_anchor_dependency: anchor.latency_ms,
      spanner_retention_offer: offerMs,
    },
  };
}

/* ------------------------------------------------------------------ */
/* GET /api/v2/crew/lost-core-member (Section C, ONE BigQuery query)   */
/* ------------------------------------------------------------------ */

export interface LostCoreMemberCrew {
  clan_id: string;
  name: string;
  tier: string | null;
  lost_player: { player_id: string; gamer_tag: string };
  left_at: string | null;
  centrality: number;
  crewmates: number;
  members_at_risk: number;
  /** Annual bookings run-rate of the remaining crewmates (lifetime spend / tenure x 365, v2_players). */
  bookings_at_risk_usd: number;
  /** Trailing-90d in-game VC purchases of the crewmates, in USD (v2_bought, 75,000 VC = $19.99). */
  vc_bookings_90d_usd: number;
  /** Weekly active rate of remaining crewmates, oldest -> newest (6 weeks). */
  retention_trend: number[];
  session_change_pct: number | null;
}

export interface LostCoreMemberResponse {
  days: number;
  /** Data as-of (MAX(Players.last_active_at), read live through EXTERNAL_QUERY). Null when no crews matched. */
  as_of: string | null;
  crews: LostCoreMemberCrew[];
  totals: { crews: number; crewmates: number; members_at_risk: number; bookings_at_risk_usd: number };
  query_sql: string;
  query_params: Record<string, number>;
  engines: string[];
  connection: string;
  bigquery_job_id: string | null;
  bytes_processed: number;
  latency_ms: number;
  method: string;
}

export function lostCoreMemberSql(): string {
  return `-- Section C: crews that lost a core member, live Spanner membership + BigQuery history, ONE statement
-- Each EXTERNAL_QUERY is a root-partitionable single-table read of LIVE Spanner (Data Boost);
-- the relational join to BigQuery history happens right here, in the same statement.
WITH sp_events AS (
  SELECT * FROM EXTERNAL_QUERY('${SPANNER_CONNECTION}',
    """SELECT clan_id, player_id, occurred_at FROM CrewMembershipEvents WHERE event_type = 'LEAVE'""")
),
sp_members AS (
  SELECT * FROM EXTERNAL_QUERY('${SPANNER_CONNECTION}',
    """SELECT player_id, clan_id, crew_centrality, is_active, left_at FROM MemberOfClan""")
),
sp_clans AS (
  SELECT * FROM EXTERNAL_QUERY('${SPANNER_CONNECTION}',
    """SELECT clan_id, name, tier FROM Clans""")
),
sp_players AS (
  SELECT * FROM EXTERNAL_QUERY('${SPANNER_CONNECTION}',
    """SELECT player_id, gamer_tag, last_active_at FROM Players""")
),
live_as_of AS (SELECT MAX(last_active_at) AS t FROM sp_players),
-- top-centrality departure: the LEAVE of a member whose MemberOfClan row has left_at set AND crew_centrality = 1.0
lost AS (
  SELECT e.clan_id, c.name AS crew_name, c.tier AS tier,
         e.player_id AS lost_player_id, lp.gamer_tag AS lost_gamer_tag,
         m.crew_centrality AS lost_centrality, e.occurred_at AS left_at,
         mm.player_id AS mate_id, a.t AS as_of
  FROM sp_events e
  CROSS JOIN live_as_of a
  JOIN sp_members m ON m.player_id = e.player_id AND m.clan_id = e.clan_id
  JOIN sp_clans c ON c.clan_id = e.clan_id
  JOIN sp_players lp ON lp.player_id = e.player_id
  JOIN sp_members mm ON mm.clan_id = e.clan_id AND mm.is_active AND mm.player_id != e.player_id
  WHERE m.left_at IS NOT NULL
    AND m.crew_centrality = 1.0
    AND e.occurred_at >= TIMESTAMP_SUB(a.t, INTERVAL @days DAY)
),
as_of AS (SELECT MAX(date) AS d FROM ${T("v2_sessions_daily")}),
mates AS (SELECT DISTINCT clan_id, mate_id FROM lost),
mate_sessions AS (
  SELECT m.clan_id, m.mate_id,
    SUM(IF(s.date > DATE_SUB(a.d, INTERVAL 7 DAY), s.session_minutes, 0)) AS min_7d,
    SUM(IF(s.date <= DATE_SUB(a.d, INTERVAL 7 DAY), s.session_minutes, 0)) AS min_prev_7d
  FROM mates m
  CROSS JOIN as_of a
  LEFT JOIN ${T("v2_sessions_daily")} s
    ON s.player_id = m.mate_id AND s.date > DATE_SUB(a.d, INTERVAL 14 DAY)
  GROUP BY m.clan_id, m.mate_id
),
weekly AS (
  SELECT m.clan_id, w AS weeks_ago,
    SAFE_DIVIDE(COUNT(DISTINCT s.player_id), COUNT(DISTINCT m.mate_id)) AS active_rate
  FROM mates m
  CROSS JOIN as_of a
  CROSS JOIN UNNEST(GENERATE_ARRAY(0, 5)) AS w
  LEFT JOIN ${T("v2_sessions_daily")} s
    ON s.player_id = m.mate_id
   AND s.session_minutes > 0
   AND s.date > DATE_SUB(a.d, INTERVAL 7 * (w + 1) DAY)
   AND s.date <= DATE_SUB(a.d, INTERVAL 7 * w DAY)
  GROUP BY m.clan_id, w
),
bookings AS (
  SELECT m.clan_id, SUM(b.vc_amount) AS vc_90d
  FROM mates m
  CROSS JOIN as_of a
  JOIN ${T("v2_bought")} b
    ON b.player_id = m.mate_id AND DATE(b.bought_at) > DATE_SUB(a.d, INTERVAL 90 DAY)
  GROUP BY m.clan_id
),
runrate AS (
  -- annual bookings run-rate per crewmate: lifetime spend / tenure, annualized (v2_players)
  SELECT m.clan_id,
    SUM(SAFE_DIVIDE(p.lifetime_spend_usd, GREATEST(p.account_tenure_days, 30)) * 365) AS annual_usd
  FROM mates m
  JOIN ${T("v2_players")} p ON p.player_id = m.mate_id
  GROUP BY m.clan_id
),
crew AS (
  SELECT clan_id,
    ANY_VALUE(crew_name) AS name, ANY_VALUE(tier) AS tier,
    ANY_VALUE(lost_player_id) AS lost_player_id, ANY_VALUE(lost_gamer_tag) AS lost_gamer_tag,
    MAX(lost_centrality) AS centrality, MAX(left_at) AS left_at,
    COUNT(DISTINCT mate_id) AS crewmates,
    MAX(as_of) AS as_of
  FROM lost
  GROUP BY clan_id
),
risk AS (
  SELECT clan_id,
    COUNTIF(min_prev_7d > 0 AND min_7d < 0.7 * min_prev_7d) AS members_at_risk,
    SAFE_DIVIDE(SUM(min_7d), SUM(min_prev_7d)) - 1 AS session_change
  FROM mate_sessions
  GROUP BY clan_id
),
trend AS (
  SELECT clan_id, ARRAY_AGG(ROUND(IFNULL(active_rate, 0), 3) ORDER BY weeks_ago DESC) AS retention_trend
  FROM weekly
  GROUP BY clan_id
)
SELECT c.clan_id, c.name, c.tier, c.lost_player_id, c.lost_gamer_tag, c.centrality, c.left_at, c.crewmates, c.as_of,
  IFNULL(r.members_at_risk, 0) AS members_at_risk,
  r.session_change,
  ROUND(IFNULL(rr.annual_usd, 0), 2) AS bookings_at_risk_usd,
  ROUND(IFNULL(b.vc_90d, 0) * 19.99 / 75000, 2) AS vc_bookings_90d_usd,
  t.retention_trend
FROM crew c
LEFT JOIN risk r USING (clan_id)
LEFT JOIN bookings b USING (clan_id)
LEFT JOIN runrate rr USING (clan_id)
LEFT JOIN trend t USING (clan_id)
ORDER BY bookings_at_risk_usd DESC, c.centrality DESC`;
}

export async function getLostCoreMembers(days = 7): Promise<LostCoreMemberResponse> {
  const d = Math.max(1, Math.min(30, Math.round(days)));
  const sql = lostCoreMemberSql();
  const run = await bigquery<any>(sql, { days: d }, "bigquery+spanner");
  const crews: LostCoreMemberCrew[] = run.rows.map((r) => ({
    clan_id: String(r.clan_id),
    name: String(r.name ?? r.clan_id),
    tier: r.tier ?? null,
    lost_player: { player_id: String(r.lost_player_id), gamer_tag: String(r.lost_gamer_tag ?? r.lost_player_id) },
    left_at: iso(r.left_at),
    centrality: round(num(r.centrality), 3),
    crewmates: num(r.crewmates),
    members_at_risk: num(r.members_at_risk),
    bookings_at_risk_usd: round(num(r.bookings_at_risk_usd), 2),
    vc_bookings_90d_usd: round(num(r.vc_bookings_90d_usd), 2),
    retention_trend: Array.isArray(r.retention_trend) ? r.retention_trend.map((x: any) => round(num(x), 3)) : [],
    session_change_pct:
      r.session_change === null || r.session_change === undefined ? null : round(num(r.session_change) * 100, 1),
  }));
  return {
    days: d,
    as_of: run.rows.length ? iso(run.rows[0].as_of) : null,
    crews,
    totals: {
      crews: crews.length,
      crewmates: crews.reduce((s, c) => s + c.crewmates, 0),
      members_at_risk: crews.reduce((s, c) => s + c.members_at_risk, 0),
      bookings_at_risk_usd: round(crews.reduce((s, c) => s + c.bookings_at_risk_usd, 0), 2),
    },
    query_sql: sql,
    query_params: { days: d },
    engines: ["spanner", "bigquery"],
    connection: SPANNER_CONNECTION,
    bigquery_job_id: run.jobId,
    bytes_processed: run.bytesProcessed,
    latency_ms: run.elapsedMs,
    method:
      "Spanner (live, via EXTERNAL_QUERY + Data Boost): LEAVE events, MemberOfClan (centrality, active), Clans, Players; LEAVE of a crew_centrality 1.0 member in the last @days days, joined to its active crewmates. BigQuery: crewmate session trend (v2_sessions_daily), annual bookings run-rate at risk (v2_players lifetime spend / tenure x 365) and trailing-90d VC bookings (v2_bought, 75,000 VC = $19.99). Members at risk: crewmates whose last-7d minutes fell below 70% of the prior 7d.",
  };
}

/* ------------------------------------------------------------------ */
/* GET /api/v2/crew/[id]/timeline (dynamic crews)                      */
/* ------------------------------------------------------------------ */

export interface LineageNode {
  clan_id: string;
  name: string;
  tier: string | null;
  active_members: number;
  depth: number;
  is_focus: boolean;
}

export interface LineageEdge {
  child: string;
  parent: string;
  split_at: string | null;
  shared_members: number;
}

export interface CrewTimelineResponse {
  crew_id: string;
  root_id: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  weekly_events: Array<{ weeks_ago: number; JOIN: number; LEAVE: number; KICK: number; SPLIT: number }>;
  recent_events: Array<{ event_type: string; gamer_tag: string; player_id: string; clan_id: string; occurred_at: string | null; related_clan_id: string | null }>;
  queries: Record<string, string>;
  latency_ms: number;
}

const LINEAGE_GQL = `GRAPH ${GRAPH}
MATCH (c:Clan)-[s:SPLIT_FROM]->(p:Clan)
RETURN c.clan_id AS child, p.clan_id AS parent, s.split_at AS split_at, s.shared_members AS shared_members`;

const CLAN_INFO_GQL = `GRAPH ${GRAPH}
MATCH (c:Clan)
WHERE c.clan_id IN UNNEST(@ids)
OPTIONAL MATCH (p:Player)-[m:MEMBER_OF_CLAN]->(c)
WHERE m.is_active
RETURN c.clan_id AS clan_id, ANY_VALUE(c.name) AS name, ANY_VALUE(c.tier) AS tier, COUNT(p.player_id) AS active_members
GROUP BY clan_id`;

const WEEKLY_EVENTS_SQL = `SELECT DIV(TIMESTAMP_DIFF(CAST(@as_of AS TIMESTAMP), occurred_at, DAY), 7) AS weeks_ago, event_type, COUNT(*) AS n
FROM CrewMembershipEvents
WHERE clan_id IN UNNEST(@ids)
  AND occurred_at >= TIMESTAMP_SUB(CAST(@as_of AS TIMESTAMP), INTERVAL 84 DAY)
GROUP BY weeks_ago, event_type`;

const RECENT_EVENTS_SQL = `SELECT e.event_type, e.player_id, p.gamer_tag, e.clan_id, e.occurred_at, e.related_clan_id
FROM CrewMembershipEvents e
JOIN Players p ON p.player_id = e.player_id
WHERE e.clan_id IN UNNEST(@ids)
ORDER BY e.occurred_at DESC
LIMIT 12`;

export async function getCrewTimeline(crewId: string): Promise<CrewTimelineResponse> {
  const started = Date.now();
  const asOf = await getAsOf();
  const edges = new Map<string, LineageEdge>();
  const addEdges = (rows: any[]) => {
    for (const r of rows) {
      const key = `${r.child}->${r.parent}`;
      if (!edges.has(key)) {
        edges.set(key, {
          child: String(r.child),
          parent: String(r.parent),
          split_at: iso(r.split_at),
          shared_members: num(r.shared_members),
        });
      }
    }
  };

  // SPLIT_FROM is small (one row per split); read every lineage edge in one live
  // query and walk up to the root, then down (max 3 levels each way), in memory.
  const all = await spanner(LINEAGE_GQL);
  const parentsOf = new Map<string, any[]>();
  const childrenOf = new Map<string, any[]>();
  for (const r of all) {
    const c = String(r.child), p = String(r.parent);
    parentsOf.set(c, [...(parentsOf.get(c) ?? []), r]);
    childrenOf.set(p, [...(childrenOf.get(p) ?? []), r]);
  }
  let root = crewId;
  for (let i = 0; i < 3; i++) {
    const up = parentsOf.get(root);
    if (!up || up.length === 0) break;
    addEdges(up);
    root = String(up[0].parent);
  }
  const depth = new Map<string, number>([[root, 0]]);
  let frontier = [root];
  for (let level = 1; level <= 3 && frontier.length; level++) {
    const next: string[] = [];
    for (const id of frontier) {
      const rows = childrenOf.get(id) ?? [];
      addEdges(rows);
      for (const r of rows) {
        const c = String(r.child);
        if (!depth.has(c)) {
          depth.set(c, level);
          next.push(c);
        }
      }
    }
    frontier = next;
  }
  if (!depth.has(crewId)) depth.set(crewId, 0);
  const ids = Array.from(depth.keys());

  const [info, weekly, recent] = await Promise.all([
    spanner(CLAN_INFO_GQL, { ids }),
    spanner(WEEKLY_EVENTS_SQL, { ids, as_of: asOf }),
    spanner(RECENT_EVENTS_SQL, { ids }),
  ]);
  if (!info.some((r) => String(r.clan_id) === crewId)) {
    throw new CrewServiceError({
      service: "cloud-spanner",
      resource: SPANNER_RESOURCE(),
      status: 404,
      message: `Crew ${crewId} not found in Clans.`,
    });
  }
  const infoById = new Map(info.map((r) => [String(r.clan_id), r]));
  const nodes: LineageNode[] = ids.map((id) => {
    const r = infoById.get(id);
    return {
      clan_id: id,
      name: String(r?.name ?? id),
      tier: r?.tier ?? null,
      active_members: num(r?.active_members),
      depth: depth.get(id) ?? 0,
      is_focus: id === crewId,
    };
  });

  const weeks = Array.from({ length: 12 }, (_, w) => ({ weeks_ago: w, JOIN: 0, LEAVE: 0, KICK: 0, SPLIT: 0 }));
  for (const r of weekly) {
    const w = num(r.weeks_ago);
    const t = String(r.event_type) as "JOIN" | "LEAVE" | "KICK" | "SPLIT";
    if (w >= 0 && w < 12 && t in weeks[w]) weeks[w][t] += num(r.n);
  }

  return {
    crew_id: crewId,
    root_id: root,
    nodes,
    edges: Array.from(edges.values()).filter((e) => depth.has(e.child) && depth.has(e.parent)),
    weekly_events: weeks.reverse(),
    recent_events: recent.map((r) => ({
      event_type: String(r.event_type),
      gamer_tag: String(r.gamer_tag ?? r.player_id),
      player_id: String(r.player_id),
      clan_id: String(r.clan_id),
      occurred_at: iso(r.occurred_at),
      related_clan_id: r.related_clan_id ? String(r.related_clan_id) : null,
    })),
    queries: {
      lineage: LINEAGE_GQL,
      clan_info: CLAN_INFO_GQL,
      weekly_events: WEEKLY_EVENTS_SQL,
      recent_events: RECENT_EVENTS_SQL,
    },
    latency_ms: Date.now() - started,
  };
}

/* ------------------------------------------------------------------ */
/* POST /api/v2/crew/act: target resolution + Focus Group handoff      */
/* ------------------------------------------------------------------ */

export type CrewTargetKind = "keystones" | "crews";

export interface ResolvedTarget {
  kind: CrewTargetKind;
  ids: string[];
  player_ids: string[];
  label: string;
  count: number;
  avg_spend: number;
  avg_churn: number;
  avg_tilt: number;
  high_churn: number;
  dominant_archetype: string;
  archetypes: Record<string, number>;
  gql: string;
}

const CREW_MEMBERS_GQL = `GRAPH ${GRAPH}
MATCH (p:Player)-[m:MEMBER_OF_CLAN]->(c:Clan)
WHERE c.clan_id IN UNNEST(@ids) AND m.is_active AND p.churned_at IS NULL
RETURN DISTINCT p.player_id AS player_id`;

const COHORT_STATS_GQL = `GRAPH ${GRAPH}
MATCH (p:Player)
WHERE p.player_id IN UNNEST(@ids)
RETURN COUNT(p.player_id) AS n,
       AVG(p.lifetime_spend_usd) AS avg_spend,
       AVG(p.churn_risk_score) AS avg_churn,
       AVG(p.tilt_sensitivity) AS avg_tilt,
       SUM(IF(p.churn_risk_score >= 0.7, 1, 0)) AS high_churn`;

const COHORT_ARCH_GQL = `GRAPH ${GRAPH}
MATCH (p:Player)
WHERE p.player_id IN UNNEST(@ids)
RETURN p.primary_archetype AS k, COUNT(p.player_id) AS n
GROUP BY k
ORDER BY n DESC`;

export async function resolveTarget(kind: CrewTargetKind, rawIds: string[], label?: string): Promise<ResolvedTarget> {
  const ids = Array.from(new Set(rawIds.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 128))).slice(0, 200);
  if (ids.length === 0) {
    throw new CrewServiceError({ service: "cloud-spanner", resource: SPANNER_RESOURCE(), status: 400, message: "target.ids must be a non-empty array of ids" });
  }
  let playerIds = ids;
  if (kind === "crews") {
    const rows = await spanner(CREW_MEMBERS_GQL, { ids });
    playerIds = rows.map((r) => String(r.player_id));
  }
  if (playerIds.length === 0) {
    throw new CrewServiceError({ service: "cloud-spanner", resource: SPANNER_RESOURCE(), status: 404, message: `No active players found for ${kind} ${ids.join(", ")}` });
  }
  const scoped = playerIds.slice(0, 2000);
  const [stats, arch] = await Promise.all([
    spanner(COHORT_STATS_GQL, { ids: scoped }),
    spanner(COHORT_ARCH_GQL, { ids: scoped }),
  ]);
  const s = stats[0] || {};
  const archetypes: Record<string, number> = {};
  for (const r of arch) if (r.k) archetypes[String(r.k)] = num(r.n);
  const dominant = Object.entries(archetypes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "UNKNOWN";
  const n = num(s.n);
  if (n === 0) {
    throw new CrewServiceError({ service: "cloud-spanner", resource: SPANNER_RESOURCE(), status: 404, message: `Target players not found in Players: ${scoped.slice(0, 5).join(", ")}` });
  }
  return {
    kind,
    ids,
    player_ids: scoped,
    label:
      label ||
      (kind === "keystones"
        ? `Keystones with declining sessions (${n})`
        : `Crews that lost a core member (${ids.length} crews, ${n} players)`),
    count: n,
    avg_spend: round(num(s.avg_spend), 2),
    avg_churn: round(num(s.avg_churn), 3),
    avg_tilt: round(num(s.avg_tilt), 3),
    high_churn: num(s.high_churn),
    dominant_archetype: dominant,
    archetypes,
    gql: kind === "crews" ? `${CREW_MEMBERS_GQL}\n\n${COHORT_STATS_GQL}` : COHORT_STATS_GQL,
  };
}

export interface OfferPresetV2 {
  id: string;
  title: string;
  priceUsd: number;
  altPriceUsd?: number;
}

/** Shape the UI hands to the existing <FocusGroupModal offerPreset cohortContext />. */
export interface CrewFocusGroupHandoff {
  offerPreset: OfferPresetV2;
  presets: OfferPresetV2[];
  initialCreativeTitle: string;
  cohortContext: {
    query: string;
    franchise: string;
    matchedCount: number;
    estimatedTotal: number;
    dominantArchetype: string;
    avgSpend: number;
    avgChurn: number;
    avgTilt: number;
    highChurnCount: number;
    isLive: true;
    source: string;
    suggestedCampaign: string;
  };
  /** The exact cohort to simulate (focus group personas are drawn from these players). */
  targetCohort: { kind: CrewTargetKind; crewIds: string[]; playerIds: string[] };
}

export function buildFocusGroupHandoff(target: ResolvedTarget, offer: RetentionOffer): CrewFocusGroupHandoff {
  const presets: OfferPresetV2[] = [
    { id: offer.id, title: offer.title, priceUsd: offer.priceUsd },
    {
      id: "crew-stabilizer",
      title: "Crew Stabilizer: 5,000 VC per active crewmate + 2x Crew REP weekend",
      priceUsd: 0,
    },
    { id: "crew-reup", title: "Crew Re-Up Bundle · 15,000 VC + 2x Crew REP Booster", priceUsd: 4.99 },
  ];
  return {
    offerPreset: presets[0],
    presets,
    initialCreativeTitle: presets[0].title,
    cohortContext: {
      query: target.label,
      franchise: "NBA2K",
      matchedCount: target.count,
      estimatedTotal: target.count,
      dominantArchetype: target.dominant_archetype,
      avgSpend: target.avg_spend,
      avgChurn: target.avg_churn,
      avgTilt: target.avg_tilt,
      highChurnCount: target.high_churn,
      isLive: true,
      source: SPANNER_RESOURCE(),
      suggestedCampaign: presets[0].title,
    },
    targetCohort: {
      kind: target.kind,
      crewIds: target.kind === "crews" ? target.ids : [],
      playerIds: target.player_ids.slice(0, 400),
    },
  };
}
