import { NextRequest, NextResponse } from "next/server";
import { runRawGql, SpannerUnavailableError } from "@/lib/gcp/spanner-client";

export const dynamic = "force-dynamic";

/**
 * The landing page's "Core Finding" — computed live, not asserted.
 *
 * These numbers were previously hardcoded ("74.6% Churn Risk", "7.8x surge",
 * "$4,250 Avg LTV"). Against the real dataset the actual figures are a 1.47x
 * lift, 64.5% cohort churn and ~$356 average LTV. That gap is not cosmetic: the
 * Core Finding card has a button that loads the very cohort it describes, so a
 * prospect who clicks through sees numbers that contradict the headline they
 * were just shown. Computing it live makes the two agree by construction.
 */

interface FranchiseProfile {
  /** Telemetry event that defines the frustration signal for this franchise. */
  signal: string;
  /**
   * The query the action button runs. MUST select exactly the cohort the
   * headline describes — adding extra predicates (a city, a tilt floor) makes
   * the drill-down contradict the number the prospect was just shown.
   */
  /** Human-readable name of the loss event. */
  eventLabel: string;
  title: string;
  queryToRun: string;
}

const PROFILE_BY_FRANCHISE: Record<string, FranchiseProfile> = {
  COD: {
    signal: "Gulag defeat streaks",
    eventLabel: "Gulag defeat",
    title: "Gulag Defeat Streaks Drive Churn Risk",
    queryToRun: "Call of Duty players with 3 or more recent loss streaks",
  },
  WOW: {
    signal: "raid wipe streaks",
    eventLabel: "raid wipe",
    title: "Raid Wipe Streaks Drive Churn Risk",
    queryToRun: "World of Warcraft players with 3 or more recent loss streaks",
  },
  DIABLO4: {
    signal: "Pit death slumps",
    eventLabel: "Pit death",
    title: "Pit Death Slumps Drive Churn Risk",
    queryToRun: "Diablo IV players with 3 or more recent loss streaks",
  },
  OVERWATCH2: {
    signal: "competitive demotion streaks",
    eventLabel: "demotion loss",
    title: "Competitive Demotion Streaks Drive Churn Risk",
    queryToRun: "Overwatch 2 players with 3 or more recent loss streaks",
  },
  CANDYCRUSH: {
    signal: "out-of-moves stalls",
    eventLabel: "out-of-moves stall",
    title: "Level Stalls Drive Churn Risk",
    queryToRun: "Candy Crush players with 3 or more recent loss streaks",
  },
};

/** Loss-streak threshold that defines the at-risk cohort. */
const STREAK_THRESHOLD = 3;

function num(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  // Spanner numerics arrive as objects with a value string.
  if (typeof v === "object" && "value" in v) return Number((v as any).value);
  return Number(v);
}

export async function GET(request: NextRequest) {
  const franchise = (
    request.nextUrl.searchParams.get("franchise") || "COD"
  ).toUpperCase();
  const profile = PROFILE_BY_FRANCHISE[franchise] || PROFILE_BY_FRANCHISE.COD;

  try {
    // One pass over the franchise's players: baseline and at-risk cohort
    // together, so the lift is internally consistent.
    const [row] = await runRawGql(`
      SELECT
        COUNT(*) AS base_n,
        AVG(churn_risk_score) AS base_churn,
        AVG(lifetime_spend_usd) AS base_ltv,
        COUNTIF(recent_loss_streak >= ${STREAK_THRESHOLD}) AS cohort_n,
        AVG(IF(recent_loss_streak >= ${STREAK_THRESHOLD}, churn_risk_score, NULL)) AS cohort_churn,
        AVG(IF(recent_loss_streak >= ${STREAK_THRESHOLD}, lifetime_spend_usd, NULL)) AS cohort_ltv,
        COUNTIF(recent_loss_streak >= ${STREAK_THRESHOLD} AND churn_risk_score >= 0.70) AS cohort_high_risk
      FROM Players
      WHERE '${franchise}' IN UNNEST(franchises_played)
    `);

    const baseN = num(row?.base_n);
    const baseChurn = num(row?.base_churn);
    const baseLtv = num(row?.base_ltv);
    const cohortN = num(row?.cohort_n);
    const cohortChurn = num(row?.cohort_churn);
    const cohortLtv = num(row?.cohort_ltv);
    const cohortHighRisk = num(row?.cohort_high_risk);

    if (baseN === 0) {
      return NextResponse.json(
        {
          error: `No players found for franchise ${franchise}.`,
          error_kind: "EMPTY_COHORT",
        },
        { status: 404 }
      );
    }

    const lift = baseChurn > 0 ? cohortChurn / baseChurn : 0;
    const highRiskShare = cohortN > 0 ? cohortHighRisk / cohortN : 0;
    // Spend already banked by the at-risk cohort — the value actually exposed.
    const revenueAtRisk = cohortLtv * cohortN;

    return NextResponse.json({
      franchise,
      is_live: true,
      source: "live_spanner",
      computed_at: new Date().toISOString(),
      title: profile.title,
      metric_pill: `${(cohortChurn * 100).toFixed(1)}% Churn Risk`,
      summary:
        `Players on ${STREAK_THRESHOLD}+ consecutive ${profile.signal} carry an average churn risk of ` +
        `${(cohortChurn * 100).toFixed(1)}%, versus ${(baseChurn * 100).toFixed(1)}% across the ` +
        `franchise — a ${lift.toFixed(2)}x lift. ${cohortHighRisk.toLocaleString()} of them ` +
        `(${(highRiskShare * 100).toFixed(1)}%) are already above the 0.70 high-risk threshold.`,
      base: `${baseN.toLocaleString()} ${franchise} players • Spanner property graph (live)`,
      metrics: {
        cohort_size: cohortN,
        cohort_avg_churn: Number(cohortChurn.toFixed(4)),
        cohort_avg_ltv: Number(cohortLtv.toFixed(2)),
        cohort_high_risk_count: cohortHighRisk,
        cohort_high_risk_share: Number(highRiskShare.toFixed(4)),
        baseline_population: baseN,
        baseline_avg_churn: Number(baseChurn.toFixed(4)),
        baseline_avg_ltv: Number(baseLtv.toFixed(2)),
        churn_lift: Number(lift.toFixed(2)),
        revenue_at_risk_usd: Number(revenueAtRisk.toFixed(2)),
        streak_threshold: STREAK_THRESHOLD,
      },
      caveats: [
        `Cohort: ${cohortN.toLocaleString()} players with a recent loss streak of ${STREAK_THRESHOLD}+ ${profile.eventLabel}s.`,
        `Lifetime spend already banked by this cohort: $${Math.round(
          revenueAtRisk
        ).toLocaleString()} at an average of $${cohortLtv.toFixed(2)} per player.`,
        `Baseline is all ${baseN.toLocaleString()} players with ${franchise} in franchises_played, not the whole database.`,
      ],
      action_label: "Load this cohort in the Spanner graph",
      query_to_run: profile.queryToRun,
    });
  } catch (error: any) {
    if (error instanceof SpannerUnavailableError) {
      return NextResponse.json(
        {
          error: "Spanner is unavailable, so the core finding cannot be computed.",
          error_kind: "SPANNER_UNAVAILABLE",
          details: error.message,
        },
        { status: 503 }
      );
    }
    console.error("[Core Finding] Failed:", error?.message);
    return NextResponse.json(
      { error: "Failed to compute core finding.", details: error?.message },
      { status: 500 }
    );
  }
}
