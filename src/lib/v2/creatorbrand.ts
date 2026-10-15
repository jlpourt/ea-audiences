/**
 * 2K Courtside v2: Creator Engagement + Brand & Crew analytics.
 *
 * Every function here executes live against BigQuery (`twok_marketing_intelligence.v2_*`)
 * or Spanner Graph (`twok_graph_db_v2`, property graph `TakeTwoPlayerGraph`).
 * There are no fallbacks: a failing query throws `CreatorBrandQueryError`, which the
 * route handlers turn into an HTTP 502 naming the service, resource, and message.
 *
 * Contract: docs/v2/CONTRACT.md sections 1-3 (CreatorBrand rows).
 */
import { queryBigQuery } from "@/lib/gcp/bigquery-client";
import { runRawGql, toNumber, GRAPH } from "@/lib/gcp/spanner-client";
import { GCP_CONFIG } from "@/lib/config";

/* ------------------------------------------------------------------ */
/* Errors + engine helpers                                             */
/* ------------------------------------------------------------------ */

export type Engine = "bigquery" | "spanner";

export class CreatorBrandQueryError extends Error {
  readonly service: Engine;
  readonly resource: string;
  constructor(service: Engine, resource: string, message: string) {
    super(message);
    this.name = "CreatorBrandQueryError";
    this.service = service;
    this.resource = resource;
  }
}

const BQ_DATASET = () => `${GCP_CONFIG.projectId}.${GCP_CONFIG.bqDatasetId}`;
const bqt = (table: string) => `\`${BQ_DATASET()}.${table}\``;
const SPANNER_RESOURCE = () =>
  `projects/${GCP_CONFIG.projectId}/instances/${GCP_CONFIG.spannerInstanceId}/databases/${GCP_CONFIG.spannerDatabaseId}`;

async function bq<T = Record<string, any>>(
  label: string,
  sql: string,
  params?: Record<string, any>
): Promise<T[]> {
  try {
    return await queryBigQuery<T>(sql, params);
  } catch (e: any) {
    throw new CreatorBrandQueryError(
      "bigquery",
      `bigquery://${BQ_DATASET()} (${label})`,
      e?.message || String(e)
    );
  }
}

async function gql(label: string, sql: string, params?: Record<string, any>): Promise<any[]> {
  try {
    return await runRawGql(sql, params);
  } catch (e: any) {
    throw new CreatorBrandQueryError(
      "spanner",
      `spanner://${SPANNER_RESOURCE()} (${label})`,
      e?.message || String(e)
    );
  }
}

const num = (v: any): number => toNumber(v);
const numOrNull = (v: any): number | null =>
  v === null || v === undefined || Number.isNaN(toNumber(v)) ? null : toNumber(v);
const round = (v: number, d = 4) => Number(v.toFixed(d));

/* ------------------------------------------------------------------ */
/* Shared types (CreatorBrand-owned)                                   */
/* ------------------------------------------------------------------ */

export interface CreatorMeta {
  creator_id: string;
  handle: string;
  name: string;
  platform: string;
  followers: number;
  hub_score: number | null;
  community_span: number | null;
}

export interface CreatorIncrementalRow {
  creator_id: string;
  handle: string;
  name: string;
  platform: string;
  followers: number;
  treated_n: number;
  /** Treated players whose first 20+ minute watch was this creator. */
  first_touch_n: number;
  control_n: number;
  d30_treated: number;
  d30_control: number;
  lift_pp: number;
  incremental_players: number;
  ci_low: number;
  ci_high: number;
  significant: boolean;
  hub_score: number | null;
  community_span: number | null;
  offstream: {
    n: number;
    pre_treated: number;
    post_treated: number;
    pre_control: number;
    post_control: number;
    did_pp: number;
    did_ci_low: number;
    did_ci_high: number;
  };
}

export interface CreatorIncrementalResponse {
  creators: CreatorIncrementalRow[];
  /** First-touch attributed total (each treated player counted once). */
  totals: {
    treated_n: number;
    incremental_players: number;
    ci_low: number;
    ci_high: number;
    creators_positive: number;
    creators_flat_or_negative: number;
  };
  as_of: string | null;
  method: string;
  definitions: Record<string, string>;
  query_sql: string;
  engines: Engine[];
  latency_ms: { bigquery: number; spanner: number; total: number };
}

export interface BrandAttachRow {
  brand_id: string;
  brand: string;
  category: string | null;
  logo_url: string | null;
  partnership_summary: string | null;
  branded_vc_revenue: number;
  units: number;
  buyers_n: number;
  exposed_n: number;
  attach_rate: number;
  in_crew_attach: number;
  out_crew_attach: number;
  in_crew_n: number;
  out_crew_n: number;
  social_multiplier: number | null;
  social_ci_low: number | null;
  social_ci_high: number | null;
  attach_with_neighbor: number;
  attach_without_neighbor: number;
  with_neighbor_n: number;
  without_neighbor_n: number;
  top_items: Array<{ item_id: string; name: string; item_type: string; vc_price: number; buyers: number; social_buyers: number }>;
}

export interface PlayersLikeYouItem {
  item_id: string;
  name: string;
  item_type: string;
  brand_id: string | null;
  brand: string | null;
  logo_url: string | null;
  vc_price: number;
  neighbor_buyers: number;
}

export interface BrandAttachResponse {
  brands: BrandAttachRow[];
  totals: {
    branded_vc_revenue: number;
    total_vc_revenue: number;
    branded_share: number;
    /** Mantel-Haenszel risk ratio stratified by brand (the headline social multiplier). */
    social_multiplier_adjusted: number | null;
    social_adjusted_ci_low: number | null;
    social_adjusted_ci_high: number | null;
    /** Crude pooled ratio across brands, shown only for transparency (confounded by brand popularity). */
    social_multiplier_crude: number | null;
  };
  players_like_you_bought: { player_id: string; gamer_tag: string | null; items: PlayersLikeYouItem[] } | null;
  definitions: Record<string, string>;
  query_sql: string;
  gql: string | null;
  engines: Engine[];
  latency_ms: { bigquery: number; spanner: number; total: number };
}

export interface HopNode {
  player_id: string;
  gamer_tag: string | null;
  community_id: string | null;
  primary_archetype: string | null;
}

export interface HopEdge {
  from: string;
  to: string;
  kind: "PLAYED_WITH" | "FRIENDS_WITH";
}

export interface SocialHopsResponse {
  from: { query: string; player: HopNode };
  to: { query: string; player: HopNode };
  hops: number | null;
  path: HopNode[];
  edges: HopEdge[];
  max_hops: number;
  candidates_checked: number;
  gql: string;
  engines: Engine[];
  latency_ms: number;
}

export interface CreatorHub {
  creator_id: string;
  handle: string;
  name: string;
  platform: string;
  followers: number;
  hub_score: number | null;
  community_span: number | null;
  viewers: number;
  participation: number;
  effective_communities: number;
  live_span: number;
  communities_reached: number;
  is_bridge: boolean;
  communities: Array<{ community_id: string; viewers: number; share: number }>;
}

export interface CreatorHubsResponse {
  hubs: CreatorHub[];
  communities: Array<{ community_id: string; players: number }>;
  community_count: number;
  followers_median: number;
  followers_q3: number;
  method: string;
  gql: string;
  engines: Engine[];
  latency_ms: number;
}

/* ------------------------------------------------------------------ */
/* Spanner: creator metadata                                           */
/* ------------------------------------------------------------------ */

const CREATOR_META_GQL = `GRAPH ${GRAPH}
MATCH (c:Creator)
RETURN c.creator_id AS creator_id, c.handle AS handle, c.name AS name, c.platform AS platform,
       c.followers AS followers, c.hub_score AS hub_score, c.community_span AS community_span`;

export async function getCreatorMeta(): Promise<Map<string, CreatorMeta>> {
  const rows = await gql("Creator metadata", CREATOR_META_GQL);
  const out = new Map<string, CreatorMeta>();
  for (const r of rows) {
    out.set(String(r.creator_id), {
      creator_id: String(r.creator_id),
      handle: String(r.handle),
      name: String(r.name ?? r.handle),
      platform: String(r.platform ?? ""),
      followers: num(r.followers),
      hub_score: numOrNull(r.hub_score),
      community_span: numOrNull(r.community_span),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 1. Creator incremental retention (BigQuery)                         */
/* ------------------------------------------------------------------ */

/**
 * Creator lift design (mirrors scripts/validate_dataset_v2.py):
 *  - treated: watched >= @min_watch min of an offer-featuring stream; t = first such stream day,
 *    t in [first day + 7, as-of - 30]
 *  - eligible (both arms): >= 1 session in [t-7, t-1] AND alive at t (last session day >= t)
 *  - controls: had NOT watched that creator by day t (no conditioning on future viewing),
 *    exact-matched on index day x archetype x pre-period activity bucket (session days in
 *    [t-14, t-1]: <=4 / <=8 / <=11 / more), up to @k per treated, ATT-weighted by stratum
 *  - D30 active: >= 1 session in [t+24, t+30]
 */
function creatorIncrementalSql(): string {
  return `
-- Creator -> Stream -> Viewer -> Player: D30 retention lift vs matched not-yet-viewers.
WITH bounds AS (
  SELECT MIN(date) AS min_d, MAX(date) AS max_d FROM ${bqt("v2_sessions_daily")}
),
act AS (
  SELECT player_id, date FROM ${bqt("v2_sessions_daily")} WHERE session_minutes > 0
),
last_sess AS (
  SELECT player_id, MAX(date) AS last_d FROM act GROUP BY player_id
),
views AS (
  SELECT s.creator_id, h.player_id, DATE(s.started_at) AS d, w.watch_minutes,
         s.featured_offer_id IS NOT NULL AS has_offer
  FROM ${bqt("v2_watched")} w
  JOIN ${bqt("v2_streams")} s USING (stream_id)
  JOIN ${bqt("v2_has_identity")} h USING (identity_id)
),
first_watch AS (
  SELECT creator_id, player_id, MIN(d) AS fw FROM views GROUP BY creator_id, player_id
),
exposures AS (
  SELECT v.creator_id, v.player_id, MIN(v.d) AS t
  FROM views v CROSS JOIN bounds b
  WHERE v.watch_minutes >= @min_watch AND v.has_offer
    AND v.d BETWEEN DATE_ADD(b.min_d, INTERVAL 7 DAY) AND DATE_SUB(b.max_d, INTERVAL 30 DAY)
  GROUP BY v.creator_id, v.player_id
),
index_days AS (
  SELECT DISTINCT t FROM exposures
),
status AS (
  -- Every player's activity around every index day (players x ~50 days: small).
  SELECT p.player_id, p.primary_archetype AS arch, x.t,
    COUNTIF(a.date BETWEEN DATE_SUB(x.t, INTERVAL 7 DAY) AND DATE_SUB(x.t, INTERVAL 1 DAY)) AS pre7,
    COUNTIF(a.date BETWEEN DATE_SUB(x.t, INTERVAL 14 DAY) AND DATE_SUB(x.t, INTERVAL 1 DAY)) AS pre14,
    COUNTIF(a.date BETWEEN DATE_ADD(x.t, INTERVAL 17 DAY) AND DATE_ADD(x.t, INTERVAL 30 DAY)) AS post14,
    COUNTIF(a.date BETWEEN DATE_ADD(x.t, INTERVAL 24 DAY) AND DATE_ADD(x.t, INTERVAL 30 DAY)) AS d30_days
  FROM ${bqt("v2_players")} p
  CROSS JOIN index_days x
  LEFT JOIN act a
    ON a.player_id = p.player_id
   AND a.date BETWEEN DATE_SUB(x.t, INTERVAL 14 DAY) AND DATE_ADD(x.t, INTERVAL 30 DAY)
  GROUP BY p.player_id, arch, x.t
),
elig AS (
  SELECT st.*,
    CASE WHEN pre14 <= 4 THEN 0 WHEN pre14 <= 8 THEN 1 WHEN pre14 <= 11 THEN 2 ELSE 3 END AS bucket,
    IF(d30_days > 0, 1, 0) AS d30, pre14 / 14 AS pre_rate, post14 / 14 AS post_rate
  FROM status st JOIN last_sess ls USING (player_id)
  WHERE st.pre7 > 0 AND ls.last_d >= st.t
),
treated AS (
  SELECT e.creator_id, el.player_id, el.t, el.arch, el.bucket, el.d30, el.pre_rate, el.post_rate
  FROM exposures e JOIN elig el ON el.player_id = e.player_id AND el.t = e.t
),
strata AS (
  SELECT creator_id, t, arch, bucket, COUNT(*) AS n_t FROM treated GROUP BY creator_id, t, arch, bucket
),
controls AS (
  SELECT * EXCEPT (rn, n_t) FROM (
    SELECT st.creator_id, el.player_id, el.t, el.arch, el.bucket, el.d30, el.pre_rate, el.post_rate, st.n_t,
           ROW_NUMBER() OVER (PARTITION BY st.creator_id, st.t, st.arch, st.bucket
                              ORDER BY FARM_FINGERPRINT(CONCAT(el.player_id, ':', st.creator_id, ':', CAST(st.t AS STRING)))) AS rn
    FROM strata st
    JOIN elig el ON el.t = st.t AND el.arch = st.arch AND el.bucket = st.bucket
    LEFT JOIN first_watch f ON f.creator_id = st.creator_id AND f.player_id = el.player_id
    WHERE f.fw IS NULL OR f.fw > st.t
  ) WHERE rn <= @k * n_t
),
arms AS (
  SELECT creator_id, player_id, t, CONCAT(CAST(t AS STRING), '|', arch, '|', CAST(bucket AS STRING)) AS stratum,
         d30, pre_rate, post_rate, 1 AS treated FROM treated
  UNION ALL
  SELECT creator_id, player_id, t, CONCAT(CAST(t AS STRING), '|', arch, '|', CAST(bucket AS STRING)) AS stratum,
         d30, pre_rate, post_rate, 0 AS treated FROM controls
),
by_stratum AS (
  SELECT creator_id, stratum,
    COUNTIF(treated = 1) AS nt, COUNTIF(treated = 0) AS nc,
    AVG(IF(treated = 1, d30, NULL)) AS pt, AVG(IF(treated = 0, d30, NULL)) AS pc,
    AVG(IF(treated = 1, pre_rate, NULL)) AS pre_t, AVG(IF(treated = 0, pre_rate, NULL)) AS pre_c,
    AVG(IF(treated = 1, post_rate, NULL)) AS post_t, AVG(IF(treated = 0, post_rate, NULL)) AS post_c,
    VAR_SAMP(IF(treated = 1, post_rate - pre_rate, NULL)) AS var_dt,
    VAR_SAMP(IF(treated = 0, post_rate - pre_rate, NULL)) AS var_dc
  FROM arms GROUP BY creator_id, stratum
),
supported AS (
  SELECT *, nt / SUM(nt) OVER (PARTITION BY creator_id) AS w
  FROM by_stratum WHERE nt > 0 AND nc > 0
),
first_touch AS (
  -- Each eligible treated player credited once, to the first creator they watched 20+ min.
  SELECT creator_id, COUNT(*) AS first_touch_n FROM (
    SELECT creator_id, player_id,
           ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY t, creator_id) AS rn
    FROM treated
  ) WHERE rn = 1 GROUP BY creator_id
)
SELECT
  creator_id,
  SUM(nt) AS treated_n,
  SUM(nc) AS control_n,
  SUM(w * pt) AS d30_treated,
  SUM(w * pc) AS d30_control,
  -- Binomial variance per stratum (a single-observation stratum still contributes p(1-p)/n).
  SUM(w * w * pt * (1 - pt) / nt) + SUM(w * w * pc * (1 - pc) / nc) AS var_diff,
  SUM(w * pre_t) AS pre_treated, SUM(w * post_t) AS post_treated,
  SUM(w * pre_c) AS pre_control, SUM(w * post_c) AS post_control,
  SUM(w * w * IFNULL(var_dt, 0) / nt) + SUM(w * w * IFNULL(var_dc, 0) / nc) AS var_did,
  (SELECT CAST(max_d AS STRING) FROM bounds) AS as_of,
  ANY_VALUE(ft.first_touch_n) AS first_touch_n
FROM supported
LEFT JOIN first_touch ft USING (creator_id)
GROUP BY creator_id
HAVING SUM(nt) >= @min_treated
ORDER BY creator_id`;
}

export const CREATOR_INCREMENTAL_METHOD =
  "Treated: players whose linked identity (HAS_IDENTITY) watched at least 20 minutes of one of the creator's offer streams; index day t = first such stream, kept only when the full 30-day outcome window is observed. " +
  "Eligible (both arms): played in [t-7, t-1] and still alive at t (last session on or after t). " +
  "Control: players who had not watched that creator by day t (no conditioning on later viewing), exact-matched on index day x archetype x pre-period activity (session days in [t-14, t-1], 4 buckets), up to 3 per treated, ATT-weighted by stratum. " +
  "D30 active = any session on days 24-30 after t. Incremental players = (D30 treated - D30 matched control) x treated N; 95% CI by normal approximation on the stratum-weighted difference. " +
  "Headline total uses first-touch attribution: each creator's lift applies only to players it reached first, so multi-creator viewers count once. " +
  "Off-stream check: difference-in-differences of active-day share, each player's own 14 days before t vs days 17-30 after, treated minus control.";

export async function getCreatorIncremental(opts?: {
  minWatch?: number;
  k?: number;
  minTreated?: number;
}): Promise<CreatorIncrementalResponse> {
  const started = Date.now();
  const sql = creatorIncrementalSql();
  const params = {
    min_watch: opts?.minWatch ?? 20,
    k: opts?.k ?? 3,
    min_treated: opts?.minTreated ?? 30,
  };

  const bqStart = Date.now();
  const bqPromise = bq("creator incremental CEM", sql, params).then((r) => ({
    rows: r,
    ms: Date.now() - bqStart,
  }));
  const spStart = Date.now();
  const spPromise = getCreatorMeta().then((m) => ({ meta: m, ms: Date.now() - spStart }));
  const [{ rows, ms: bqMs }, { meta, ms: spMs }] = await Promise.all([bqPromise, spPromise]);

  const Z = 1.96;
  let asOf: string | null = null;
  const mapped: CreatorIncrementalRow[] = rows.map((r: any) => {
    asOf = asOf ?? (r.as_of ? String(r.as_of) : null);
    const m = meta.get(String(r.creator_id));
    const treated_n = num(r.treated_n);
    const pt = num(r.d30_treated);
    const pc = num(r.d30_control);
    const diff = pt - pc;
    const se = Math.sqrt(Math.max(0, num(r.var_diff)));
    const did = num(r.post_treated) - num(r.pre_treated) - (num(r.post_control) - num(r.pre_control));
    const seDid = Math.sqrt(Math.max(0, num(r.var_did)));
    const ciLow = (diff - Z * se) * treated_n;
    const ciHigh = (diff + Z * se) * treated_n;
    return {
      creator_id: String(r.creator_id),
      handle: m?.handle ?? String(r.creator_id),
      name: m?.name ?? String(r.creator_id),
      platform: m?.platform ?? "",
      followers: m?.followers ?? 0,
      treated_n,
      first_touch_n: num(r.first_touch_n),
      control_n: num(r.control_n),
      d30_treated: round(pt),
      d30_control: round(pc),
      lift_pp: round(diff * 100, 2),
      incremental_players: Math.round(diff * treated_n),
      ci_low: Math.round(ciLow),
      ci_high: Math.round(ciHigh),
      significant: ciLow > 0 || ciHigh < 0,
      hub_score: m?.hub_score ?? null,
      community_span: m?.community_span ?? null,
      offstream: {
        n: treated_n,
        pre_treated: round(num(r.pre_treated)),
        post_treated: round(num(r.post_treated)),
        pre_control: round(num(r.pre_control)),
        post_control: round(num(r.post_control)),
        did_pp: round(did * 100, 2),
        did_ci_low: round((did - Z * seDid) * 100, 2),
        did_ci_high: round((did + Z * seDid) * 100, 2),
      },
    };
  });
  const creators = mapped;
  creators.sort((a, b) => b.incremental_players - a.incremental_players);

  // Headline: first-touch attribution. Each creator's lift is applied only to the players it
  // reached first, so a player who watched several creators is counted once. SEs combine in
  // quadrature (creator comparisons treated as independent).
  let inc = 0;
  let varSum = 0;
  let ftN = 0;
  for (const c of creators) {
    const n = c.first_touch_n;
    const se = (c.ci_high - c.ci_low) / (2 * Z) / Math.max(1, c.treated_n);
    inc += (c.lift_pp / 100) * n;
    varSum += Math.pow(se * n, 2);
    ftN += n;
  }
  const totals = {
    treated_n: ftN,
    incremental_players: Math.round(inc),
    ci_low: Math.round(inc - Z * Math.sqrt(varSum)),
    ci_high: Math.round(inc + Z * Math.sqrt(varSum)),
    creators_positive: creators.filter((c) => c.significant && c.lift_pp > 0).length,
    creators_flat_or_negative: creators.filter((c) => !c.significant || c.lift_pp <= 0).length,
  };

  return {
    creators,
    totals,
    as_of: asOf,
    method: CREATOR_INCREMENTAL_METHOD,
    definitions: {
      treated: `watch_minutes >= ${params.min_watch} on an offer-featuring stream HOSTED by the creator (via HAS_IDENTITY)`,
      control: `had not watched the creator by day t, eligible at t, exact-matched on day x archetype x pre-period activity bucket; up to ${params.k}:1`,
      d30_active: "session on any of days 24-30 after the index day",
      eligible: "session in [t-7, t-1] and last session on or after t (both arms)",
      min_treated: `creators with fewer than ${params.min_treated} eligible treated players are omitted`,
    },
    query_sql: sql.trim(),
    engines: ["bigquery", "spanner"],
    latency_ms: { bigquery: bqMs, spanner: spMs, total: Date.now() - started },
  };
}

/* ------------------------------------------------------------------ */
/* 2. Brand attach + social multiplier (BigQuery)                      */
/* ------------------------------------------------------------------ */

function brandAttachSql(): string {
  return `
-- Branded VC revenue, attach, crew split, and co-play social multiplier per real 2K brand partner.
WITH crew AS (
  SELECT DISTINCT player_id FROM ${bqt("v2_member_of_clan")} WHERE is_active
),
active_base AS (
  -- Unit = (NBA 2K player, brand): every NBA 2K player sees the branded store.
  SELECT player_id FROM ${bqt("v2_players")}
  WHERE EXISTS (SELECT 1 FROM UNNEST(franchises_played) f WHERE f IN ('NBA2K', 'NBA2K26', 'NBA2KMOBILE'))
),
purchases AS (
  SELECT i.brand_id, b.player_id, b.item_id, b.vc_amount
  FROM ${bqt("v2_bought")} b
  JOIN ${bqt("v2_items")} i USING (item_id)
  WHERE i.is_branded AND i.brand_id IS NOT NULL
),
buyers AS (
  SELECT brand_id, player_id, SUM(vc_amount) AS vc, COUNT(*) AS units
  FROM purchases GROUP BY brand_id, player_id
),
exposed AS (
  SELECT br.brand_id, ab.player_id FROM ${bqt("v2_brands")} br CROSS JOIN active_base ab
  UNION DISTINCT
  SELECT brand_id, player_id FROM buyers
),
pw AS (
  SELECT player_id AS a, other_player_id AS b FROM ${bqt("v2_played_with")}
  UNION ALL
  SELECT other_player_id AS a, player_id AS b FROM ${bqt("v2_played_with")}
),
neighbor_bought AS (
  SELECT DISTINCT bu.brand_id, pw.b AS player_id
  FROM buyers bu JOIN pw ON pw.a = bu.player_id
),
base AS (
  SELECT e.brand_id, e.player_id,
         bu.player_id IS NOT NULL AS is_buyer,
         c.player_id IS NOT NULL AS in_crew,
         nb.player_id IS NOT NULL AS has_nb
  FROM exposed e
  LEFT JOIN buyers bu ON bu.brand_id = e.brand_id AND bu.player_id = e.player_id
  LEFT JOIN crew c ON c.player_id = e.player_id
  LEFT JOIN neighbor_bought nb ON nb.brand_id = e.brand_id AND nb.player_id = e.player_id
),
agg AS (
  SELECT brand_id,
    COUNT(*) AS exposed_n,
    COUNTIF(is_buyer) AS buyers_n,
    COUNTIF(in_crew) AS in_crew_n, COUNTIF(in_crew AND is_buyer) AS in_crew_buyers,
    COUNTIF(NOT in_crew) AS out_crew_n, COUNTIF(NOT in_crew AND is_buyer) AS out_crew_buyers,
    COUNTIF(has_nb) AS nb_n, COUNTIF(has_nb AND is_buyer) AS nb_buyers,
    COUNTIF(NOT has_nb) AS no_nb_n, COUNTIF(NOT has_nb AND is_buyer) AS no_nb_buyers
  FROM base GROUP BY brand_id
),
rev AS (
  SELECT brand_id, SUM(vc) AS branded_vc_revenue, SUM(units) AS units FROM buyers GROUP BY brand_id
),
item_rank AS (
  SELECT p.brand_id, p.item_id,
    COUNT(DISTINCT p.player_id) AS item_buyers,
    COUNT(DISTINCT IF(nb.player_id IS NOT NULL, p.player_id, NULL)) AS social_buyers
  FROM purchases p
  LEFT JOIN neighbor_bought nb ON nb.brand_id = p.brand_id AND nb.player_id = p.player_id
  GROUP BY p.brand_id, p.item_id
),
top_items AS (
  SELECT r.brand_id,
    ARRAY_AGG(STRUCT(r.item_id, i.name, i.item_type, i.vc_price, r.item_buyers AS buyers, r.social_buyers)
              ORDER BY r.social_buyers DESC, r.item_buyers DESC LIMIT 5) AS items
  FROM item_rank r JOIN ${bqt("v2_items")} i USING (item_id)
  GROUP BY r.brand_id
)
SELECT br.brand_id, br.name, br.category, br.logo_url, br.partnership_summary,
       IFNULL(rev.branded_vc_revenue, 0) AS branded_vc_revenue, IFNULL(rev.units, 0) AS units,
       agg.* EXCEPT (brand_id),
       ti.items AS top_items,
       (SELECT SUM(vc_amount) FROM ${bqt("v2_bought")}) AS total_vc_revenue
FROM ${bqt("v2_brands")} br
LEFT JOIN agg USING (brand_id)
LEFT JOIN rev USING (brand_id)
LEFT JOIN top_items ti USING (brand_id)
ORDER BY branded_vc_revenue DESC`;
}

function playersLikeYouGql(): string {
  return `GRAPH ${GRAPH}
MATCH (me:Player {player_id: @pid})-[:PLAYED_WITH]-(n:Player)-[:BOUGHT]->(it:Item)
WHERE it.is_branded
  AND NOT EXISTS { MATCH (me2:Player {player_id: @pid})-[:BOUGHT]->(it2:Item) WHERE it2.item_id = it.item_id }
RETURN it.item_id AS item_id, ANY_VALUE(it.name) AS name, ANY_VALUE(it.item_type) AS item_type,
       ANY_VALUE(it.brand_id) AS brand_id, ANY_VALUE(it.vc_price) AS vc_price,
       COUNT(DISTINCT n.player_id) AS neighbor_buyers
GROUP BY item_id
ORDER BY neighbor_buyers DESC, vc_price DESC
LIMIT 6`;
}

export async function getBrandAttach(opts?: { playerId?: string | null }): Promise<BrandAttachResponse> {
  const started = Date.now();
  const sql = brandAttachSql();
  const bqStart = Date.now();
  const bqPromise = bq("brand attach", sql).then((rows) => ({ rows, ms: Date.now() - bqStart }));

  const pid = opts?.playerId?.trim() || null;
  const plyGql = pid ? playersLikeYouGql() : null;
  const spStart = Date.now();
  const spPromise = pid
    ? Promise.all([
        gql("players like you bought", plyGql!, { pid }),
        gql(
          "player lookup",
          `GRAPH ${GRAPH}\nMATCH (p:Player {player_id: @pid})\nRETURN p.player_id AS player_id, p.gamer_tag AS gamer_tag`,
          { pid }
        ),
      ]).then(([items, me]) => ({ items, me, ms: Date.now() - spStart }))
    : Promise.resolve(null);

  const [{ rows, ms: bqMs }, sp] = await Promise.all([bqPromise, spPromise]);

  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);
  const brands: BrandAttachRow[] = rows.map((r: any) => {
    const nb_n = num(r.nb_n);
    const nb_buyers = num(r.nb_buyers);
    const no_nb_n = num(r.no_nb_n);
    const no_nb_buyers = num(r.no_nb_buyers);
    const p1 = rate(nb_buyers, nb_n);
    const p0 = rate(no_nb_buyers, no_nb_n);
    let mult: number | null = null;
    let lo: number | null = null;
    let hi: number | null = null;
    if (p1 > 0 && p0 > 0) {
      mult = p1 / p0;
      const seLog = Math.sqrt((1 - p1) / nb_buyers + (1 - p0) / no_nb_buyers);
      lo = Math.exp(Math.log(mult) - 1.96 * seLog);
      hi = Math.exp(Math.log(mult) + 1.96 * seLog);
    }
    return {
      brand_id: String(r.brand_id),
      brand: String(r.name),
      category: r.category ?? null,
      logo_url: r.logo_url ?? null,
      partnership_summary: r.partnership_summary ?? null,
      branded_vc_revenue: num(r.branded_vc_revenue),
      units: num(r.units),
      buyers_n: num(r.buyers_n),
      exposed_n: num(r.exposed_n),
      attach_rate: round(rate(num(r.buyers_n), num(r.exposed_n))),
      in_crew_attach: round(rate(num(r.in_crew_buyers), num(r.in_crew_n))),
      out_crew_attach: round(rate(num(r.out_crew_buyers), num(r.out_crew_n))),
      in_crew_n: num(r.in_crew_n),
      out_crew_n: num(r.out_crew_n),
      social_multiplier: mult === null ? null : round(mult, 2),
      social_ci_low: lo === null ? null : round(lo, 2),
      social_ci_high: hi === null ? null : round(hi, 2),
      attach_with_neighbor: round(p1),
      attach_without_neighbor: round(p0),
      with_neighbor_n: nb_n,
      without_neighbor_n: no_nb_n,
      top_items: (r.top_items || []).map((it: any) => ({
        item_id: String(it.item_id),
        name: String(it.name),
        item_type: String(it.item_type ?? ""),
        vc_price: num(it.vc_price),
        buyers: num(it.buyers),
        social_buyers: num(it.social_buyers),
      })),
    };
  });

  // Mantel-Haenszel RR stratified by brand + Greenland-Robins variance; crude pooled for contrast.
  let mhNum = 0;
  let mhDen = 0;
  let grVar = 0;
  let ae = 0;
  let an = 0;
  let ue = 0;
  let un = 0;
  for (const r of rows as any[]) {
    const x1 = num(r.nb_buyers);
    const n1 = num(r.nb_n);
    const x0 = num(r.no_nb_buyers);
    const n0 = num(r.no_nb_n);
    ae += x1;
    an += n1;
    ue += x0;
    un += n0;
    const N = n1 + n0;
    if (n1 > 0 && n0 > 0) {
      mhNum += (x1 * n0) / N;
      mhDen += (x0 * n1) / N;
      grVar += (n1 * n0 * (x1 + x0) - x1 * x0 * N) / (N * N);
    }
  }
  const mh = mhNum > 0 && mhDen > 0 ? mhNum / mhDen : null;
  const mhSe = mh !== null ? Math.sqrt(grVar / (mhNum * mhDen)) : null;
  const crude = an > 0 && un > 0 && ue > 0 ? ae / an / (ue / un) : null;

  const brandById = new Map(brands.map((b) => [b.brand_id, b]));
  const branded = brands.reduce((a, b) => a + b.branded_vc_revenue, 0);
  const total = rows.length ? num((rows[0] as any).total_vc_revenue) : 0;

  let ply: BrandAttachResponse["players_like_you_bought"] = null;
  if (sp && pid) {
    ply = {
      player_id: pid,
      gamer_tag: sp.me[0]?.gamer_tag ?? null,
      items: sp.items.map((it: any) => {
        const b = it.brand_id ? brandById.get(String(it.brand_id)) : undefined;
        return {
          item_id: String(it.item_id),
          name: String(it.name),
          item_type: String(it.item_type ?? ""),
          brand_id: it.brand_id ? String(it.brand_id) : null,
          brand: b?.brand ?? null,
          logo_url: b?.logo_url ?? null,
          vc_price: num(it.vc_price),
          neighbor_buyers: num(it.neighbor_buyers),
        };
      }),
    };
  }

  return {
    brands,
    totals: {
      branded_vc_revenue: branded,
      total_vc_revenue: total,
      branded_share: round(rate(branded, total)),
      social_multiplier_adjusted: mh === null ? null : round(mh, 2),
      social_adjusted_ci_low: mh === null || mhSe === null ? null : round(mh * Math.exp(-1.96 * mhSe), 2),
      social_adjusted_ci_high: mh === null || mhSe === null ? null : round(mh * Math.exp(1.96 * mhSe), 2),
      social_multiplier_crude: crude === null ? null : round(crude, 2),
    },
    players_like_you_bought: ply,
    definitions: {
      branded_vc_revenue: "SUM(BOUGHT.vc_amount) where Item.is_branded, grouped by Item.brand_id",
      exposed: "unit = (NBA 2K player, brand): every NBA 2K player, plus any buyer of the brand",
      attach_rate: "distinct buyers of any of the brand's items / exposed players",
      in_crew: "player has an active MEMBER_OF_CLAN edge",
      social_multiplier:
        "per brand: attach when at least one PLAYED_WITH neighbor bought the same brand / attach when none did (95% CI on the log risk ratio)",
      social_multiplier_adjusted:
        "all brands: Mantel-Haenszel risk ratio stratified by brand (adjusts for brand popularity, which otherwise inflates the pooled ratio via Simpson's paradox); Greenland-Robins 95% CI",
    },
    query_sql: sql.trim(),
    gql: plyGql,
    engines: pid ? ["bigquery", "spanner"] : ["bigquery"],
    latency_ms: { bigquery: bqMs, spanner: sp?.ms ?? 0, total: Date.now() - started },
  };
}

/* ------------------------------------------------------------------ */
/* 3. Social hops (Spanner Graph shortest path)                        */
/* ------------------------------------------------------------------ */

export const MAX_HOPS = 4;

/**
 * Resolve an audience token to up to `n` seed players.
 *  - `p-123` / any bare id: that player
 *  - `community:<id>`: most central players in that community
 *  - `archetype:<NAME>`: most central players of that archetype
 */
async function resolveSeeds(token: string, n = 3): Promise<HopNode[]> {
  const t = token.trim();
  const proj = `p.player_id AS player_id, p.gamer_tag AS gamer_tag, p.community_id AS community_id, p.primary_archetype AS primary_archetype`;
  let rows: any[];
  if (t.startsWith("community:") || t.startsWith("archetype:")) {
    const [kind, ...rest] = t.split(":");
    const value = rest.join(":");
    const field = kind === "community" ? "p.community_id" : "p.primary_archetype";
    rows = await gql(
      `resolve ${kind}`,
      `GRAPH ${GRAPH}
MATCH (p:Player)-[e:PLAYED_WITH]-(:Player)
WHERE ${field} = @v
RETURN ${proj}, COUNT(e) AS degree
GROUP BY player_id, gamer_tag, community_id, primary_archetype
ORDER BY degree DESC
LIMIT ${Math.max(1, Math.min(5, n))}`,
      { v: value }
    );
  } else {
    rows = await gql(
      "resolve player",
      `GRAPH ${GRAPH}\nMATCH (p:Player {player_id: @v})\nRETURN ${proj}`,
      { v: t }
    );
  }
  return rows.map((r) => ({
    player_id: String(r.player_id),
    gamer_tag: r.gamer_tag ?? null,
    community_id: r.community_id ?? null,
    primary_archetype: r.primary_archetype ?? null,
  }));
}

/**
 * Half of a meet-in-the-middle search: ANY SHORTEST quantified path {1,2} from one seed
 * to every player within two hops, returning each path as "a|b|LABEL" edge tokens.
 */
function halfPathGql(): string {
  return `GRAPH ${GRAPH}
MATCH p = ANY SHORTEST (a:Player {player_id: @seed})-[e:PLAYED_WITH|FRIENDS_WITH]-{1,${HALF_HOPS}}(m:Player)
RETURN m.player_id AS mid, ARRAY_LENGTH(e) AS d,
       ARRAY_TRANSFORM(e, x -> CONCAT(x.player_id, '|', x.other_player_id, '|', LABELS(x)[OFFSET(0)])) AS hops`;
}

const HALF_HOPS = MAX_HOPS / 2;

interface HalfPath {
  d: number;
  /** Ordered player ids from the seed to `mid` (inclusive). */
  nodes: string[];
  kinds: HopEdge["kind"][];
}

function walk(seed: string, tokens: string[]): HalfPath {
  const nodes = [seed];
  const kinds: HopEdge["kind"][] = [];
  let cur = seed;
  for (const t of tokens) {
    const [x, y, label] = String(t).split("|");
    const next = x === cur ? y : x;
    nodes.push(next);
    kinds.push(label === "FRIENDS_WITH" ? "FRIENDS_WITH" : "PLAYED_WITH");
    cur = next;
  }
  return { d: tokens.length, nodes, kinds };
}

async function halfSearch(seed: string, label: string): Promise<Map<string, HalfPath>> {
  const rows = await gql(label, halfPathGql(), { seed });
  const out = new Map<string, HalfPath>();
  out.set(seed, { d: 0, nodes: [seed], kinds: [] });
  for (const r of rows) {
    const mid = String(r.mid);
    if (mid === seed) continue;
    const hp = walk(seed, (r.hops || []) as string[]);
    const prev = out.get(mid);
    if (!prev || hp.d < prev.d) out.set(mid, hp);
  }
  return out;
}

export async function getSocialHops(fromToken: string, toToken: string): Promise<SocialHopsResponse> {
  const started = Date.now();
  const [fromSeeds, toSeeds] = await Promise.all([resolveSeeds(fromToken, 1), resolveSeeds(toToken, 1)]);
  if (!fromSeeds.length || !toSeeds.length) {
    const missing = !fromSeeds.length ? fromToken : toToken;
    throw new CreatorBrandQueryError("spanner", `spanner://${SPANNER_RESOURCE()}`, `No players match audience '${missing}'`);
  }
  const a = fromSeeds[0];
  const b = toSeeds[0];

  // Bidirectional bounded search: two {1,2} quantified-path queries run in parallel and
  // meet in the middle, so the shortest path up to 4 hops is exact without enumerating
  // every 4-hop path from one side.
  const [fromSide, toSide] = await Promise.all([
    halfSearch(a.player_id, "ANY SHORTEST {1,2} from source"),
    halfSearch(b.player_id, "ANY SHORTEST {1,2} from target"),
  ]);

  let best: { mid: string; hops: number } | null = null;
  for (const [mid, fp] of fromSide) {
    const tp = toSide.get(mid);
    if (!tp) continue;
    const h = fp.d + tp.d;
    if (!best || h < best.hops) best = { mid, hops: h };
  }

  let path: HopNode[] = [];
  let edges: HopEdge[] = [];
  if (best) {
    const fp = fromSide.get(best.mid)!;
    const tp = toSide.get(best.mid)!;
    const ids = [...fp.nodes, ...tp.nodes.slice(0, -1).reverse()];
    const kinds = [...fp.kinds, ...tp.kinds.slice().reverse()];
    const detail = await gql(
      "path players",
      `GRAPH ${GRAPH}
MATCH (p:Player)
WHERE p.player_id IN UNNEST(@ids)
RETURN p.player_id AS player_id, p.gamer_tag AS gamer_tag, p.community_id AS community_id, p.primary_archetype AS primary_archetype`,
      { ids }
    );
    const byId = new Map(detail.map((r) => [String(r.player_id), r]));
    path = ids.map((id) => {
      const r = byId.get(id);
      return {
        player_id: id,
        gamer_tag: r?.gamer_tag ?? null,
        community_id: r?.community_id ?? null,
        primary_archetype: r?.primary_archetype ?? null,
      };
    });
    edges = kinds.map((kind, i) => ({ from: ids[i], to: ids[i + 1], kind }));
  }

  return {
    from: { query: fromToken, player: a },
    to: { query: toToken, player: b },
    hops: best ? best.hops : null,
    path,
    edges,
    max_hops: MAX_HOPS,
    candidates_checked: fromSide.size + toSide.size,
    gql: halfPathGql(),
    engines: ["spanner"],
    latency_ms: Date.now() - started,
  };
}

/** Live pick of two well-connected players in the two largest different communities. */
export async function pickDefaultHopPair(): Promise<{ from: string; to: string }> {
  const rows = await gql(
    "largest communities",
    `GRAPH ${GRAPH}
MATCH (p:Player)
WHERE p.community_id IS NOT NULL
RETURN p.community_id AS community_id, COUNT(*) AS n
GROUP BY community_id
ORDER BY n DESC
LIMIT 6`
  );
  if (rows.length < 2) {
    throw new CreatorBrandQueryError(
      "spanner",
      `spanner://${SPANNER_RESOURCE()}`,
      "Need at least two communities (Players.community_id) to compute default hops"
    );
  }
  // Largest community vs. the smallest of the top six, to make the path non-trivial.
  return { from: `community:${rows[0].community_id}`, to: `community:${rows[rows.length - 1].community_id}` };
}

/* ------------------------------------------------------------------ */
/* 4. Creator hubs (Spanner Graph)                                     */
/* ------------------------------------------------------------------ */

function hubsGql(): string {
  return `GRAPH ${GRAPH}
MATCH (c:Creator)-[:HOSTED]->(:Stream)<-[w:WATCHED]-(:Identity)<-[:HAS_IDENTITY]-(p:Player)
WHERE w.watch_minutes >= @min_watch AND p.community_id IS NOT NULL
RETURN c.creator_id AS creator_id, p.community_id AS community_id, COUNT(DISTINCT p.player_id) AS viewers
GROUP BY creator_id, community_id`;
}

export const CREATOR_HUBS_METHOD =
  "Live Spanner Graph traversal Creator -HOSTED-> Stream <-WATCHED- Identity <-HAS_IDENTITY- Player, grouped by the viewer's co-play community (label propagation on co-play + watch edges). " +
  "live_span = communities with at least 3 of the creator's viewers; effective_communities = exp(Shannon entropy) of the viewer split; participation = Guimera-Amaral coefficient. " +
  "This is the SoundCloud-style creator-hub search: rank by how many separate communities a creator connects, not by follower count. " +
  "hub_score and community_span are the stored bridging scores on the Creator node. Bridge = top-quartile hub_score while outside the top-quartile follower count.";

const MIN_COMMUNITY_VIEWERS = 3;

export async function getCreatorHubs(opts?: { minWatch?: number; ringSize?: number }): Promise<CreatorHubsResponse> {
  const started = Date.now();
  const ringSize = Math.max(3, Math.min(16, opts?.ringSize ?? 10));
  const sql = hubsGql();
  const [meta, rows, comm] = await Promise.all([
    getCreatorMeta(),
    gql("creator community reach", sql, { min_watch: opts?.minWatch ?? 5 }),
    gql(
      "community sizes",
      `GRAPH ${GRAPH}
MATCH (p:Player)
WHERE p.community_id IS NOT NULL
RETURN p.community_id AS community_id, COUNT(*) AS players
GROUP BY community_id
ORDER BY players DESC`
    ),
  ]);

  const byCreator = new Map<string, Array<{ community_id: string; viewers: number }>>();
  for (const r of rows) {
    const id = String(r.creator_id);
    if (!byCreator.has(id)) byCreator.set(id, []);
    byCreator.get(id)!.push({ community_id: String(r.community_id), viewers: num(r.viewers) });
  }

  const allCreators = Array.from(meta.values());
  const followersSorted = allCreators.map((c) => c.followers).sort((a, b) => a - b);
  const followersMedian = followersSorted.length ? followersSorted[Math.floor(followersSorted.length / 2)] : 0;
  // Top-quartile cut points (ascending sort, 75th percentile).
  const q3 = (xs: number[]) => (xs.length ? xs[Math.floor(xs.length * 0.75)] : Infinity);
  const followersQ3 = q3(followersSorted);
  const hubQ3 = q3(
    allCreators
      .map((c) => c.hub_score)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)
  );
  const ringIds = new Set(comm.slice(0, ringSize).map((r) => String(r.community_id)));

  const hubs: CreatorHub[] = allCreators.map((c) => {
    const comms = (byCreator.get(c.creator_id) || []).sort((a, b) => b.viewers - a.viewers);
    const viewers = comms.reduce((a, x) => a + x.viewers, 0);
    const shares = comms.map((x) => ({ ...x, share: viewers > 0 ? x.viewers / viewers : 0 }));
    const participation = viewers > 0 ? 1 - shares.reduce((a, x) => a + x.share * x.share, 0) : 0;
    const entropy = shares.reduce((a, x) => (x.share > 0 ? a - x.share * Math.log(x.share) : a), 0);
    // Payload: the creator's own top communities plus any on the visual ring.
    const kept = shares.filter((x, i) => i < 8 || ringIds.has(x.community_id));
    return {
      creator_id: c.creator_id,
      handle: c.handle,
      name: c.name,
      platform: c.platform,
      followers: c.followers,
      hub_score: c.hub_score,
      community_span: c.community_span,
      viewers,
      participation: round(participation, 3),
      effective_communities: round(Math.exp(entropy), 1),
      live_span: comms.filter((x) => x.viewers >= MIN_COMMUNITY_VIEWERS).length,
      communities_reached: comms.length,
      is_bridge:
        c.hub_score !== null && c.hub_score >= hubQ3 && c.followers < followersQ3,
      communities: kept.map((x) => ({ ...x, share: round(x.share, 4) })),
    };
  });
  hubs.sort((a, b) => (b.hub_score ?? -1) - (a.hub_score ?? -1) || b.live_span - a.live_span);

  return {
    hubs,
    communities: comm.slice(0, ringSize).map((r) => ({ community_id: String(r.community_id), players: num(r.players) })),
    community_count: comm.length,
    followers_median: followersMedian,
    followers_q3: followersQ3,
    method: CREATOR_HUBS_METHOD,
    gql: sql,
    engines: ["spanner"],
    latency_ms: Date.now() - started,
  };
}

/* ------------------------------------------------------------------ */
/* Route helper                                                        */
/* ------------------------------------------------------------------ */

export function errorPayload(e: unknown, endpoint: string) {
  if (e instanceof CreatorBrandQueryError) {
    return {
      status: 502,
      body: {
        error: `${e.service === "bigquery" ? "BigQuery" : "Spanner Graph"} query failed`,
        service: e.service,
        project: GCP_CONFIG.projectId,
        resource: e.resource,
        message: e.message,
        endpoint,
      },
    };
  }
  const err = e as any;
  return {
    status: 500,
    body: {
      error: "Unhandled error",
      project: GCP_CONFIG.projectId,
      message: err?.message || String(e),
      endpoint,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Per-process live-result cache                                       */
/* Each entry is a LIVE BigQuery / Spanner computation stamped with     */
/* computed_at and reused for CACHE_TTL_MS. Never populated from static */
/* data, never served after expiry, never populated by a failure.       */
/* Concurrent requests for the same key share one in-flight compute.    */
/* ------------------------------------------------------------------ */

export const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = { at: number; value: unknown };
const cbGlobal = globalThis as unknown as {
  __creatorBrandCache?: Map<string, CacheEntry>;
  __creatorBrandInflight?: Map<string, Promise<unknown>>;
};
const cbCache = (cbGlobal.__creatorBrandCache ??= new Map<string, CacheEntry>());
const cbInflight = (cbGlobal.__creatorBrandInflight ??= new Map<string, Promise<unknown>>());

export type Cached<T> = T & { cache: "hit" | "miss"; computed_at: string; cache_ttl_s: number };

export async function liveCached<T extends object>(
  name: string,
  params: Record<string, unknown>,
  compute: () => Promise<T>,
  fresh = false
): Promise<Cached<T>> {
  const key = [
    GCP_CONFIG.projectId,
    GCP_CONFIG.spannerInstanceId,
    GCP_CONFIG.spannerDatabaseId,
    GCP_CONFIG.bqDatasetId,
    name,
    JSON.stringify(params),
  ].join("/");
  const now = Date.now();
  const hit = cbCache.get(key);
  if (!fresh && hit && now - hit.at < CACHE_TTL_MS) {
    return {
      ...(hit.value as T),
      cache: "hit",
      computed_at: new Date(hit.at).toISOString(),
      cache_ttl_s: CACHE_TTL_MS / 1000,
    };
  }
  if (hit && now - hit.at >= CACHE_TTL_MS) cbCache.delete(key);
  let p = cbInflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = compute().finally(() => cbInflight.delete(key));
    cbInflight.set(key, p);
  }
  const value = await p; // a rejection propagates and nothing is cached
  const at = Date.now();
  cbCache.set(key, { at, value });
  return { ...value, cache: "miss", computed_at: new Date(at).toISOString(), cache_ttl_s: CACHE_TTL_MS / 1000 };
}
