/**
 * GET /api/insights/weekly-briefing
 *
 * Weekly Executive Briefing for the v2 Home (contract section 3).
 * Live BigQuery week-over-week KPIs from the v2 mirror tables in
 * `twok_marketing_intelligence`, plus a one-line Gemini (FAST) headline.
 *
 * Windows are anchored to the DATA as-of, not the wall clock, so the demo shows
 * the same week regardless of when it runs:
 *   as_of = end of MAX(date) in v2_sessions_daily, else MAX(last_active_at)
 *   in v2_players. "This week" = (as_of - 7d, as_of]; "last week" = the 7 days before.
 * Canonical definitions (contract):
 *   top-centrality departure = MemberOfClan.left_at set AND crew_centrality = 1.0
 *   churned = churned_at IS NOT NULL
 *
 * Honesty rules:
 *  - If a KPI's source table is not loaded yet, that KPI is returned with
 *    status "n/a" and the missing table names. No estimate is substituted.
 *  - Any BigQuery or Vertex AI failure returns HTTP 502 with the service,
 *    resource and error message. Nothing is canned.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBigQueryClient, queryBigQuery } from "@/lib/gcp/bigquery-client";
import { generateText } from "@/lib/gcp/genai-client";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KpiStatus = "ok" | "n/a";

export interface WeeklyKpi {
  id: "crews_lost_core" | "avg_churn_exposure" | "branded_vc_revenue";
  label: string;
  value: number | null;
  previous: number | null;
  delta_pct: number | null;
  status: KpiStatus;
  unit: "count" | "pct" | "vc";
  /** Which direction is good for the business. Drives delta color. */
  good_direction: "up" | "down";
  definition: string;
  source_tables: string[];
  missing_tables?: string[];
}

export interface WeeklyBriefingResponse {
  week_of: string;
  /** Data as-of timestamp the windows are anchored to. */
  as_of: string | null;
  as_of_source: string | null;
  window: { this_week_start: string; last_week_start: string; end: string };
  kpis: WeeklyKpi[];
  headline: string | null;
  model_used: string | null;
  engine: "bigquery";
  latency_ms: number;
}

const DATASET = GCP_CONFIG.bqDatasetId;
const PROJECT = GCP_CONFIG.projectId;
const t = (name: string) => `\`${PROJECT}.${DATASET}.${name}\``;

class StageError extends Error {
  constructor(
    public service: "bigquery" | "vertex-ai",
    public resource: string,
    message: string,
  ) {
    super(message);
  }
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const [exists] = await getBigQueryClient().dataset(DATASET).table(name).exists();
    return exists;
  } catch (e) {
    throw new StageError("bigquery", `${PROJECT}.${DATASET}.${name}`, (e as Error).message);
  }
}

function pctDelta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(1));
}

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "object" && v !== null && "value" in (v as Record<string, unknown>)) {
    return Number((v as { value: unknown }).value);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function runKpi(
  base: Omit<WeeklyKpi, "value" | "previous" | "delta_pct" | "status" | "missing_tables">,
  sql: string,
  round: (n: number) => number,
  asOf: Date | null,
): Promise<WeeklyKpi> {
  const presence = await Promise.all(base.source_tables.map(tableExists));
  const missing = base.source_tables.filter((_, i) => !presence[i]);
  if (missing.length || !asOf) {
    if (!asOf && !missing.length) missing.push("v2_sessions_daily | v2_players (as-of anchor)");
    return { ...base, value: null, previous: null, delta_pct: null, status: "n/a", missing_tables: missing };
  }
  let rows: Record<string, unknown>[];
  try {
    rows = await queryBigQuery(sql, { as_of: asOf });
  } catch (e) {
    throw new StageError("bigquery", base.source_tables.map((s) => `${DATASET}.${s}`).join(", "), (e as Error).message);
  }
  const cur = num(rows[0]?.this_week);
  const prev = num(rows[0]?.last_week);
  const value = cur == null ? null : round(cur);
  const previous = prev == null ? null : round(prev);
  return { ...base, value, previous, delta_pct: pctDelta(value, previous), status: "ok" };
}

/* Crews whose top-centrality member (crew_centrality = 1.0) left in the window. */
const SQL_CREWS_LOST_CORE = `
SELECT
  COUNT(DISTINCT IF(left_at >  TIMESTAMP_SUB(@as_of, INTERVAL 7 DAY), clan_id, NULL)) AS this_week,
  COUNT(DISTINCT IF(left_at <= TIMESTAMP_SUB(@as_of, INTERVAL 7 DAY), clan_id, NULL)) AS last_week
FROM ${t("v2_member_of_clan")}
WHERE left_at IS NOT NULL
  AND crew_centrality >= 0.9999
  AND left_at >  TIMESTAMP_SUB(@as_of, INTERVAL 14 DAY)
  AND left_at <= @as_of`;

/* Mean share of each active player's co-play neighbors who churned in the
   trailing 14 days, measured at as_of vs. as_of - 7d. */
const SQL_CHURN_EXPOSURE = `
WITH edges AS (
  SELECT player_id AS a, other_player_id AS b FROM ${t("v2_played_with")}
  UNION ALL
  SELECT other_player_id AS a, player_id AS b FROM ${t("v2_played_with")}
),
p AS (SELECT player_id, churned_at FROM ${t("v2_players")}),
anchors AS (
  SELECT 'this' AS wk, @as_of AS anchor_ts
  UNION ALL
  SELECT 'last' AS wk, TIMESTAMP_SUB(@as_of, INTERVAL 7 DAY) AS anchor_ts
),
per_player AS (
  SELECT an.wk, e.a,
         AVG(IF(nb.churned_at IS NOT NULL
                AND nb.churned_at <= an.anchor_ts
                AND nb.churned_at > TIMESTAMP_SUB(an.anchor_ts, INTERVAL 14 DAY), 1.0, 0.0)) AS exposure
  FROM edges e
  CROSS JOIN anchors an
  JOIN p me ON me.player_id = e.a
  JOIN p nb ON nb.player_id = e.b
  WHERE me.churned_at IS NULL OR me.churned_at > an.anchor_ts
  GROUP BY an.wk, e.a
)
SELECT
  AVG(IF(wk = 'this', exposure, NULL)) * 100 AS this_week,
  AVG(IF(wk = 'last', exposure, NULL)) * 100 AS last_week
FROM per_player`;

/* VC spent on branded items (Items.is_branded) this week vs. last. */
const SQL_BRANDED_VC = `
SELECT
  SUM(IF(b.bought_at >  TIMESTAMP_SUB(@as_of, INTERVAL 7 DAY), b.vc_amount, 0)) AS this_week,
  SUM(IF(b.bought_at <= TIMESTAMP_SUB(@as_of, INTERVAL 7 DAY), b.vc_amount, 0)) AS last_week
FROM ${t("v2_bought")} b
JOIN ${t("v2_items")} i ON i.item_id = b.item_id
WHERE i.is_branded = TRUE
  AND b.bought_at >  TIMESTAMP_SUB(@as_of, INTERVAL 14 DAY)
  AND b.bought_at <= @as_of`;

/* Data as-of: end of the last day with sessions, else latest activity. */
async function resolveAsOf(): Promise<{ asOf: Date | null; source: string | null }> {
  if (await tableExists("v2_sessions_daily")) {
    let rows: Record<string, unknown>[];
    try {
      rows = await queryBigQuery(
        `SELECT TIMESTAMP(DATE_ADD(MAX(date), INTERVAL 1 DAY)) AS as_of FROM ${t("v2_sessions_daily")}`,
      );
    } catch (e) {
      throw new StageError("bigquery", `${DATASET}.v2_sessions_daily`, (e as Error).message);
    }
    const v = rows[0]?.as_of as { value?: string } | string | null | undefined;
    const iso = typeof v === "string" ? v : v?.value;
    if (iso) return { asOf: new Date(iso), source: "MAX(v2_sessions_daily.date) + 1d" };
  }
  if (await tableExists("v2_players")) {
    let rows: Record<string, unknown>[];
    try {
      rows = await queryBigQuery(`SELECT MAX(last_active_at) AS as_of FROM ${t("v2_players")}`);
    } catch (e) {
      throw new StageError("bigquery", `${DATASET}.v2_players`, (e as Error).message);
    }
    const v = rows[0]?.as_of as { value?: string } | string | null | undefined;
    const iso = typeof v === "string" ? v : v?.value;
    if (iso) return { asOf: new Date(iso), source: "MAX(v2_players.last_active_at)" };
  }
  return { asOf: null, source: null };
}

function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return x.toISOString().slice(0, 10);
}

function describe(k: WeeklyKpi): string {
  const fmt = (n: number | null) =>
    n == null ? "n/a" : k.unit === "pct" ? `${n.toFixed(1)}%` : k.unit === "vc" ? `${Math.round(n).toLocaleString()} VC` : `${n}`;
  return `${k.label}: ${fmt(k.value)} this week vs ${fmt(k.previous)} last week (${
    k.delta_pct == null ? "no comparable prior" : `${k.delta_pct > 0 ? "+" : ""}${k.delta_pct}%`
  }; lower is better: ${k.good_direction === "down"}).`;
}

/* 15 min per-process cache of a LIVE computation (same contract as
   core-finding): stamped computed_at, never from static data, never served
   past TTL, never populated by a failure. `?fresh=1` forces a recompute. */
const CACHE_TTL_MS = 15 * 60 * 1000;
const g = globalThis as unknown as {
  __briefingCache?: Map<string, { at: number; value: WeeklyBriefingResponse }>;
  __briefingInflight?: Map<string, Promise<WeeklyBriefingResponse>>;
};
const cache = (g.__briefingCache ??= new Map());
const inflight = (g.__briefingInflight ??= new Map());

export async function GET(req: NextRequest) {
  const key = `${PROJECT}/${DATASET}`;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const hit = cache.get(key);
    if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json(
        { ...hit.value, cache: "hit", computed_at: new Date(hit.at).toISOString() },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    let p = inflight.get(key);
    if (!p) {
      p = computeBriefing().finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    const value = await p;
    const at = Date.now();
    cache.set(key, { at, value });
    return NextResponse.json(
      { ...value, cache: "miss", computed_at: new Date(at).toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const err = e as StageError;
    console.error("[weekly-briefing] failed", err);
    return NextResponse.json(
      {
        error: "Weekly briefing failed",
        service: err.service ?? "unknown",
        project: PROJECT,
        dataset: DATASET,
        resource: err.resource ?? null,
        message: err.message,
      },
      { status: 502 },
    );
  }
}

async function computeBriefing(): Promise<WeeklyBriefingResponse> {
  const started = Date.now();
  {
    const { asOf, source } = await resolveAsOf();
    const anchor = asOf ?? new Date();
    const kpis = await Promise.all([
      runKpi(
        {
          id: "crews_lost_core",
          label: "Crews that lost a core member",
          unit: "count",
          good_direction: "down",
          definition: "Crews whose top-centrality member (crew_centrality = 1.0) left in the window.",
          source_tables: ["v2_member_of_clan"],
        },
        SQL_CREWS_LOST_CORE,
        (n) => Math.round(n),
        asOf,
      ),
      runKpi(
        {
          id: "avg_churn_exposure",
          label: "Avg churn exposure",
          unit: "pct",
          good_direction: "down",
          definition: "Share of an active player's co-play neighbors who churned in the trailing 14 days.",
          source_tables: ["v2_played_with", "v2_players"],
        },
        SQL_CHURN_EXPOSURE,
        (n) => Number(n.toFixed(2)),
        asOf,
      ),
      runKpi(
        {
          id: "branded_vc_revenue",
          label: "Branded VC revenue",
          unit: "vc",
          good_direction: "up",
          definition: "VC spent on branded partner items.",
          source_tables: ["v2_bought", "v2_items"],
        },
        SQL_BRANDED_VC,
        (n) => Math.round(n),
        asOf,
      ),
    ]);

    const live = kpis.filter((k) => k.status === "ok");
    let headline: string | null = null;
    let modelUsed: string | null = null;
    if (live.length) {
      try {
        const gen = await generateText({
          role: "FAST",
          system:
            "You write one-line headlines for a games marketing executive. Plain words. Max 14 words. No emoji. No em dashes. No hype. Use only the numbers given.",
          prompt: `Write the single most important takeaway from this week's NBA 2K player network KPIs:\n${live
            .map(describe)
            .join("\n")}`,
          temperature: 0.4,
          maxOutputTokens: 1024,
          thinkingBudget: 0,
        });
        if (gen.finishReason === "MAX_TOKENS") {
          throw new Error(`Gemini (${gen.modelUsed}) truncated the headline (MAX_TOKENS).`);
        }
        headline = gen.text.trim().replace(/^["']|["']$/g, "").replace(/\u2014/g, ",") || null;
        modelUsed = gen.modelUsed;
        if (!headline) {
          throw new Error(`Gemini (${gen.modelUsed}) returned an empty headline.`);
        }
      } catch (e) {
        throw new StageError("vertex-ai", "generateText(FAST)", (e as Error).message);
      }
    }

    const body: WeeklyBriefingResponse = {
      week_of: mondayOf(new Date(anchor.getTime() - 1)),
      as_of: asOf ? asOf.toISOString() : null,
      as_of_source: source,
      window: {
        this_week_start: new Date(anchor.getTime() - 7 * 864e5).toISOString(),
        last_week_start: new Date(anchor.getTime() - 14 * 864e5).toISOString(),
        end: anchor.toISOString(),
      },
      kpis,
      headline,
      model_used: modelUsed,
      engine: "bigquery",
      latency_ms: Date.now() - started,
    };
    return body;
  }
}
