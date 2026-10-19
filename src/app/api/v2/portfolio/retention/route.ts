/**
 * GET /api/v2/portfolio/retention
 *
 * BigQuery half of the Take-Two command center: weekly retention curves for
 * players who picked up a title from ANOTHER studio, split by how they arrived
 * (FRIEND_INVITE, ORGANIC, CROSS_PROMO, CREATOR).
 *
 * Reads the lakehouse mirror `take_two_portfolio` (scripts/mirror_t2_bigquery.js):
 *   t2_plays_game (first_played_at, acquired_via) + t2_players (home studio)
 *   + t2_games (title studio) + t2_sessions_daily (per player, title and day).
 * Sessions are modelled for Rockstar Games and Zynga titles, so the cohort is
 * cross-studio adoptions INTO those titles in the 120 days before the as-of.
 *
 * Retained at day N = at least one session in that title in days [N, N+6]
 * after the first session. Zero fallbacks: BigQuery errors return 502 with the
 * dataset, job details and message. Cached in-process for one hour.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/gcp/bigquery-client";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATASET = process.env.T2_BQ_DATASET_ID || "take_two_portfolio";
const DAYS = [1, 7, 14, 21, 28];
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface RetentionCurve {
  via: string;
  cohort: number;
  points: { day: number; retained: number; rate: number }[];
}

export interface RetentionResponse {
  as_of: string;
  curves: RetentionCurve[];
  query_sql: string;
  engine: "bigquery";
  dataset: string;
  bytes_processed: number | null;
  latency_ms: number;
  cache: "hit" | "miss";
}

const g = globalThis as unknown as { __t2RetentionCache?: { at: number; value: Omit<RetentionResponse, "cache"> } };

function sql(project: string) {
  const T = (t: string) => `\`${project}.${DATASET}.${t}\``;
  return `-- Weekly retention of cross-studio adopters, by how they arrived
WITH asof AS (SELECT DATE(MAX(last_active_at)) AS d FROM ${T("t2_players")}),
adopt AS (
  SELECT pg.player_id, pg.game_id, pg.acquired_via, DATE(pg.first_played_at) AS d0
  FROM ${T("t2_plays_game")} pg
  JOIN ${T("t2_players")} p USING (player_id)
  JOIN ${T("t2_games")} g USING (game_id)
  CROSS JOIN asof
  WHERE g.studio != p.home_studio
    AND g.studio IN ('ROCKSTAR', 'ZYNGA')
    AND DATE(pg.first_played_at) BETWEEN DATE_SUB(asof.d, INTERVAL 120 DAY) AND DATE_SUB(asof.d, INTERVAL 35 DAY)
),
active AS (
  SELECT DISTINCT a.player_id, a.game_id, DATE_DIFF(s.date, a.d0, DAY) AS age
  FROM adopt a
  JOIN ${T("t2_sessions_daily")} s
    ON s.player_id = a.player_id AND s.game_id = a.game_id
   AND s.date > a.d0 AND s.date <= DATE_ADD(a.d0, INTERVAL 35 DAY)
)
SELECT a.acquired_via AS via, d AS day,
       COUNT(*) AS cohort,
       COUNTIF(EXISTS (
         SELECT 1 FROM active x
         WHERE x.player_id = a.player_id AND x.game_id = a.game_id AND x.age BETWEEN d AND d + 6)) AS retained,
       ANY_VALUE(asof.d) AS as_of
FROM adopt a CROSS JOIN asof, UNNEST(@days) AS d
GROUP BY via, day
ORDER BY via, day`;
}

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const hit = g.__t2RetentionCache;
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.value, cache: "hit" } satisfies RetentionResponse);
  }
  const t0 = Date.now();
  const query = sql(GCP_CONFIG.projectId);
  try {
    const bq = getBigQueryClient();
    const [job] = await bq.createQueryJob({ query, params: { days: DAYS }, location: "US" });
    const [rows] = await job.getQueryResults();
    const [meta] = await job.getMetadata();
    if (!rows.length) throw new Error(`No cross-studio adoptions in ${DATASET} for the retention window; run scripts/mirror_t2_bigquery.js.`);
    const by = new Map<string, RetentionCurve>();
    let asOf = "";
    for (const r of rows as { via: string; day: number; cohort: number; retained: number; as_of: { value: string } | string }[]) {
      asOf = typeof r.as_of === "string" ? r.as_of : r.as_of?.value;
      const c = by.get(r.via) ?? { via: r.via, cohort: Number(r.cohort), points: [] };
      c.points.push({ day: Number(r.day), retained: Number(r.retained), rate: Number(r.cohort) ? Number(r.retained) / Number(r.cohort) : 0 });
      by.set(r.via, c);
    }
    const value: Omit<RetentionResponse, "cache"> = {
      as_of: asOf,
      curves: Array.from(by.values()).sort((a, b) => b.cohort - a.cohort),
      query_sql: query,
      engine: "bigquery",
      dataset: `${GCP_CONFIG.projectId}.${DATASET}`,
      bytes_processed: meta?.statistics?.totalBytesProcessed ? Number(meta.statistics.totalBytesProcessed) : null,
      latency_ms: Date.now() - t0,
    };
    g.__t2RetentionCache = { at: Date.now(), value };
    return NextResponse.json({ ...value, cache: "miss" } satisfies RetentionResponse);
  } catch (e) {
    console.error("[api/v2/portfolio/retention]", e);
    return NextResponse.json(
      {
        error: "BigQuery retention query failed",
        service: "bigquery",
        resource: `${GCP_CONFIG.projectId}.${DATASET}`,
        message: (e as Error).message,
        query_sql: query,
      },
      { status: 502 },
    );
  }
}
