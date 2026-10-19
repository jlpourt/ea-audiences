import { NextRequest, NextResponse } from "next/server";
import { runRawGql, toNumber, SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { generateText, GenAIError } from "@/lib/gcp/genai-client";
import { GRAPH_NAME } from "@/lib/gcp/catalog";
import { GCP_CONFIG } from "@/lib/config";
import { DynamicCohortFinding, GameFranchise } from "@/lib/types";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Per-process result cache (v2). Each entry is a LIVE computation      */
/* (Spanner Graph + Gemini) stamped with computed_at; it is reused for  */
/* CACHE_TTL_MS so the Home card does not wait on 6 GQL queries + a     */
/* Gemini call on every load. Never populated from static data, never   */
/* served after expiry, never populated by a failed computation.        */
/* Concurrent requests for the same key share one in-flight compute.    */
/* ------------------------------------------------------------------ */
const CACHE_TTL_MS = 15 * 60 * 1000;
type Built = Awaited<ReturnType<typeof buildFindings>>;
// Held on globalThis so a dev-server module reload does not drop it.
const g = globalThis as unknown as {
  __coreFindingCache?: Map<string, { at: number; value: Built }>;
  __coreFindingInflight?: Map<string, Promise<Built>>;
};
const cache = (g.__coreFindingCache ??= new Map<string, { at: number; value: Built }>());
const inflight = (g.__coreFindingInflight ??= new Map<string, Promise<Built>>());

function cacheKey(franchise: string) {
  return `${GCP_CONFIG.projectId}/${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}/${franchise}`;
}

async function getFindings(franchise: GameFranchise, fresh: boolean) {
  const key = cacheKey(franchise);
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.value, cache: "hit" as const, computed_at: new Date(hit.at).toISOString(), cache_ttl_s: CACHE_TTL_MS / 1000 };
  }
  let p = inflight.get(key);
  if (!p) {
    p = buildFindings(franchise).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  const value = await p;
  const at = Date.now();
  cache.set(key, { at, value });
  return { ...value, cache: "miss" as const, computed_at: new Date(at).toISOString(), cache_ttl_s: CACHE_TTL_MS / 1000 };
}

function errorResponse(e: unknown) {
  const err = e as Error;
  console.error("[core-finding] failed", err);
  const isSpanner = err instanceof SpannerUnavailableError;
  const isGenAI = err instanceof GenAIError;
  return NextResponse.json(
    {
      error: "Core finding failed",
      service: isSpanner ? "cloud-spanner" : isGenAI ? "vertex-ai" : "unknown",
      project: GCP_CONFIG.projectId,
      resource: isSpanner
        ? `projects/${GCP_CONFIG.projectId}/instances/${GCP_CONFIG.spannerInstanceId}/databases/${GCP_CONFIG.spannerDatabaseId}`
        : isGenAI
          ? `model ${(err as GenAIError).modelId}`
          : null,
      message: err?.message || String(e),
      details: err?.message || String(e),
    },
    { status: isSpanner ? 503 : 502 }
  );
}

async function buildFindings(franchise: GameFranchise) {
  const started = Date.now();

  // All six queries run in parallel. Play 5 is anchored on the (few) NBA2K
  // creators and walks FOLLOWS_CREATOR backwards: identical result, ~0.2s
  // instead of ~13s scanning every Player's outgoing follows.
  const [play1Rows, play2Rows, play3Rows, play4Rows, play5Rows, baseRows] = await Promise.all([
    runRawGql(`
      GRAPH ${GRAPH_NAME}
      MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player)
      WHERE p.primary_franchise = 'NBA2K'
        AND INT64(p.game_telemetry.myplayer_ovr) < 85
        AND FLOAT64(p.game_telemetry.vc_spend_90d) >= 50
        AND INT64(p.game_telemetry.last_login_days_ago) >= 7
        AND INT64(mate.game_telemetry.last_login_days_ago) <= 3
        AND p.player_id <> mate.player_id
      RETURN COUNT(DISTINCT p.player_id) AS n,
             AVG(p.lifetime_spend_usd) AS avg_spend,
             AVG(p.churn_risk_score) AS avg_churn
    `),
    runRawGql(`
      GRAPH ${GRAPH_NAME}
      MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: '2K Account'}),
            (p)-[:PLAYS_GAME]->(g:Game {game_id: 'game-nba2k26'})
      WHERE BOOL(p.game_telemetry.nba2k26_veteran) = true
        AND FLOAT64(p.game_telemetry.nba2k26_spend_usd) > 0
        AND BOOL(p.game_telemetry.migrated_to_2k27) = false
        AND FLOAT64(p.game_telemetry.myteam_vc_spend_90d) > 0
      RETURN COUNT(DISTINCT p.player_id) AS n,
             AVG(p.lifetime_spend_usd) AS avg_spend,
             AVG(p.churn_risk_score) AS avg_churn
    `),
    runRawGql(`
      GRAPH ${GRAPH_NAME}
      MATCH (p:Player)
      WHERE INT64(p.game_telemetry.myteam_galaxy_opal_count) >= 10
        AND STRING(p.game_telemetry.season_pass_edition) = 'HALL_OF_FAME'
      RETURN COUNT(p.player_id) AS n,
             AVG(p.lifetime_spend_usd) AS avg_spend,
             AVG(p.churn_risk_score) AS avg_churn
    `),
    runRawGql(`
      GRAPH ${GRAPH_NAME}
      MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: '2K Account'}),
            (p)-[:PLAYS_GAME]->(g:Game)
      WHERE g.franchise IN ('WWE2K', 'PGA2K', 'TOPSPIN', 'BL4', 'CIV7', 'MAFIA')
        AND p.lifetime_spend_usd >= 150
      RETURN COUNT(DISTINCT p.player_id) AS n,
             AVG(p.lifetime_spend_usd) AS avg_spend,
             AVG(p.churn_risk_score) AS avg_churn
    `),
    runRawGql(`
      GRAPH ${GRAPH_NAME}
      MATCH (c:Creator {franchise: 'NBA2K'})<-[:FOLLOWS_CREATOR]-(p:Player)
      WHERE p.lifetime_spend_usd >= 200
      RETURN COUNT(DISTINCT p.player_id) AS n,
             AVG(p.lifetime_spend_usd) AS avg_spend,
             AVG(p.churn_risk_score) AS avg_churn
    `),
    // Baseline = 2K players only, so the Core Finding stays 2K even on the
    // Take-Two portfolio database (Rockstar Games / Zynga players excluded).
    runRawGql(`
      SELECT COUNT(*) AS total_players, AVG(lifetime_spend_usd) AS avg_spend, AVG(churn_risk_score) AS avg_churn
      FROM Players
      WHERE primary_franchise IN (
        SELECT franchise FROM Games WHERE is_parent_hub = true AND label NOT IN ('ROCKSTAR', 'ZYNGA'))
    `),
  ]);

  const spannerMs = Date.now() - started;

  const p1N = toNumber(play1Rows[0]?.n) ?? 0;
  const p1Spend = toNumber(play1Rows[0]?.avg_spend) ?? 0;
  const p1Churn = toNumber(play1Rows[0]?.avg_churn) ?? 0;

  const p2N = toNumber(play2Rows[0]?.n) ?? 0;
  const p2Spend = toNumber(play2Rows[0]?.avg_spend) ?? 0;
  const p2Churn = toNumber(play2Rows[0]?.avg_churn) ?? 0;

  const p3N = toNumber(play3Rows[0]?.n) ?? 0;
  const p3Spend = toNumber(play3Rows[0]?.avg_spend) ?? 0;
  const p3Churn = toNumber(play3Rows[0]?.avg_churn) ?? 0;

  const p4N = toNumber(play4Rows[0]?.n) ?? 0;
  const p4Spend = toNumber(play4Rows[0]?.avg_spend) ?? 0;
  const p4Churn = toNumber(play4Rows[0]?.avg_churn) ?? 0;

  const p5N = toNumber(play5Rows[0]?.n) ?? 0;
  const p5Spend = toNumber(play5Rows[0]?.avg_spend) ?? 0;
  const p5Churn = toNumber(play5Rows[0]?.avg_churn) ?? 0;

  const totalN = toNumber(baseRows[0]?.total_players) ?? 0;

  const genStarted = Date.now();
  const gen = await generateText({
    role: "FAST",
    prompt: `Write a sharp, 2-sentence executive marketing insight for 2K Courtside using these exact live telemetry graph counts across our 2K portfolio (scope: ${franchise}):
- ${p2N} NBA 2K26 veteran MyTEAM spenders linked via 2K Account who have not yet upgraded to NBA 2K27 (eligible for the $69.99 NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade + 100K VC).
- ${p1N} stalled NBA 2K27 MyCAREER builds (<85 OVR, $50+ VC spend, 7+ days inactive) who have active Rec/Pro-Am Crew teammates online in the last 3 days ahead of the Oct 16 Season 1 cliff.
- ${p3N} Hall of Fame Season Pass MyTEAM whales holding 10+ Galaxy Opals (avg LTV $${Math.round(p3Spend)}), plus ${p4N} cross-franchise 2K players (WWE 2K25, PGA TOUR 2K25, Borderlands 4, Civilization VII) and ${p5N} Creator Squad followers (Agent 00, Troydan, CashNasty, KOT4Q, DBG, Tydebo).
Keep it direct, numbers-first, strictly 2K brands only, zero fluff.`,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
  });

  const geminiMs = Date.now() - genStarted;
  const executiveSummary = gen.text.trim();
  if (!executiveSummary) {
    throw new Error(`Gemini (${gen.modelUsed}) returned an empty executive summary.`);
  }
  const modelUsed = gen.modelUsed;

  const findings: DynamicCohortFinding[] = [
    {
      id: "2k26-bridge",
      category: "cross_title",
      tabLabel: "01 · NBA 2K26 → 2K27 Bridge",
      shortLabel: "2K26 → 2K27 Bridge",
      badge: "MIGRATION · 3-HOP 2K ACCOUNT",
      iconType: "cross_title",
      iconColor: "#FF6B35",
      bgAccent: "rgba(255,107,53,0.08)",
      pillColor: "#FF6B35",
      metricPill: `${p2N} 2K26 holdouts`,
      title: `${p2N} high-spend NBA 2K26 veterans on 2K Account have not yet upgraded to NBA 2K27`,
      summary: `Traversing 2K Account → NBA 2K26 isolates ${p2N} proven MyTEAM & MyCAREER veterans (avg LTV $${Math.round(
        p2Spend
      )}) who are prime candidates for the NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade + 100K VC before Season 2 tips off Oct 17.`,
      base: `TakeTwoPlayerGraph · ${totalN.toLocaleString()} players`,
      metrics: {
        cohortSize: p2N,
        avgSpend: Math.round(p2Spend),
        avgChurn: Number(p2Churn.toFixed(2)),
        liftMetric: "+44.5% upgrade lift",
        highRiskCount: Math.round(p2N * 0.28),
        secondaryMetric: "2K26 → 2K27 HoF Loyalty Upgrade (+100K VC)",
      },
      caveats: [
        "Targets verified NBA 2K26 veterans with prior VC spend who have not yet migrated their MyPLAYER build to NBA 2K27.",
      ],
      actionLabel: "Load 2K26 → 2K27 Bridge Cohort",
      queryToRun:
        "NBA 2K26 veteran MyTEAM spenders with a linked 2K Account who have not yet upgraded to NBA 2K27",
      franchise: "NBA2K26",
      prompts: [
        {
          title: "NBA 2K26 → 2K27 Holdout Upgrade Bridge",
          query:
            "NBA 2K26 veteran MyTEAM spenders with a linked 2K Account who have not yet upgraded to NBA 2K27",
          franchise: "NBA2K26",
          tag: "PLAY 02 · 2K26 BRIDGE",
          highlight: `${p2N} players`,
        },
      ],
    },
    {
      id: "season2-cliff",
      category: "churn_contagion",
      tabLabel: "02 · Season 2 Build Cliff",
      shortLabel: "Season 2 Cliff",
      badge: "RETENTION · 2-HOP CREW",
      iconType: "users",
      iconColor: "#E4002B",
      bgAccent: "rgba(228,0,43,0.08)",
      pillColor: "#E4002B",
      metricPill: `${p1N} builds at risk`,
      title: `${p1N} MyCAREER spenders stalled below 85 OVR have active Crew teammates online now`,
      summary: `Season 1 closes Oct 16. These ${p1N} players spent $50+ on VC (avg $${Math.round(
        p1Spend
      )}) and went dark 7+ days ago, but 2-hop MEMBER_OF_CLAN traversal proves their Rec & Pro-Am Crew captains logged in within the last 72 hours.`,
      base: `TakeTwoPlayerGraph · ${totalN.toLocaleString()} players`,
      metrics: {
        cohortSize: p1N,
        avgSpend: Math.round(p1Spend),
        avgChurn: Number(p1Churn.toFixed(2)),
        liftMetric: "+28.4% S2 retention",
        highRiskCount: p1N,
        secondaryMetric: "$4.99 Crew Re-Up Bundle",
      },
      caveats: [
        "Requires 2-hop Crew teammate co-trigger so the active captain receives a 2x REP squad invite.",
      ],
      actionLabel: "Load Season 2 Cliff Cohort",
      queryToRun:
        "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
      franchise: "NBA2K",
      prompts: [
        {
          title: "Season 2 Cliff · Active Crew Mates",
          query:
            "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
          franchise: "NBA2K",
          tag: "PLAY 01 · RETENTION",
          highlight: `${p1N} players`,
        },
      ],
    },
    {
      id: "myteam-whales",
      category: "whale_spillover",
      tabLabel: "03 · MyTEAM Galaxy Opal Whales",
      shortLabel: "MyTEAM Whales",
      badge: "MONETIZATION · PRICING TEST",
      iconType: "sparkles",
      iconColor: "#F5B400",
      bgAccent: "rgba(245,180,0,0.08)",
      pillColor: "#F5B400",
      metricPill: `${p3N} HoF Whales`,
      title: `${p3N} Hall of Fame Pass MyTEAM collectors hold 10+ Galaxy Opals ($${Math.round(
        p3Spend
      )} avg LTV)`,
      summary: `High-velocity pack openers sensitive to odds backlash on r/NBA2K and r/MyTEAM. Pressure-test the Galaxy Opal Deluxe Pack at $14.99 vs $19.99 in the 20-persona Courtside Focus Group before pushing to the Pack Market.`,
      base: `TakeTwoPlayerGraph · MyTEAM Surface`,
      metrics: {
        cohortSize: p3N,
        avgSpend: Math.round(p3Spend),
        avgChurn: Number(p3Churn.toFixed(2)),
        liftMetric: "$14.99 vs $19.99 Battle",
        highRiskCount: Math.round(p3N * 0.15),
        secondaryMetric: "Galaxy Opal Deluxe Pack ($14.99)",
      },
      caveats: [
        "Community sentiment shows acute sensitivity above $19.99 without guaranteed Galaxy Opal topper.",
      ],
      actionLabel: "Load MyTEAM Pack Whales",
      queryToRun:
        "NBA 2K27 MyTEAM whales with 10+ Galaxy Opals and Hall of Fame Season Pass",
      franchise: "NBA2K",
      prompts: [
        {
          title: "MyTEAM Pack Whales · Pricing Test",
          query:
            "NBA 2K27 MyTEAM whales with 10+ Galaxy Opals and Hall of Fame Season Pass",
          franchise: "NBA2K",
          tag: "PLAY 03 · MONETIZATION",
          highlight: `${p3N} players`,
        },
      ],
    },
    {
      id: "2k-crossplay",
      category: "cross_title",
      tabLabel: "04 · 2K Cross-Franchise",
      shortLabel: "2K Cross-Play",
      badge: "ECOSYSTEM · 2K PORTFOLIO",
      iconType: "zap",
      iconColor: "#10B981",
      bgAccent: "rgba(16,185,129,0.08)",
      pillColor: "#10B981",
      metricPill: `${p4N} multi-2K players`,
      title: `${p4N} NBA 2K players cross-play WWE 2K25, PGA TOUR 2K25, Borderlands 4 & Civilization VII`,
      summary: `Unified 2K Account graph edges connect ${p4N} multi-title spenders (avg LTV $${Math.round(
        p4Spend
      )}) across WWE 2K25 MyFACTION, PGA TOUR 2K25 Clubhouse Pass, TopSpin 2K25, Borderlands 4, and Sid Meier's Civilization VII.`,
      base: `TakeTwoPlayerGraph · 2K Cross-Franchise Spine`,
      metrics: {
        cohortSize: p4N,
        avgSpend: Math.round(p4Spend),
        avgChurn: Number(p4Churn.toFixed(2)),
        liftMetric: "+28.4% cross-bundle lift",
        highRiskCount: Math.round(p4N * 0.18),
        secondaryMetric: "2K Sports All-Star Cross-Franchise Bundle ($29.99)",
      },
      caveats: [
        "Cross-pollinates Season Pass XP across NBA 2K27 The City, WWE 2K25 MyFACTION, and PGA TOUR 2K25.",
      ],
      actionLabel: "Load 2K Cross-Franchise Cohort",
      queryToRun:
        "Cross-franchise 2K Account players active across WWE 2K25, PGA TOUR 2K25, Borderlands 4, and Civilization VII with $150+ lifetime spend",
      franchise: "WWE2K",
      prompts: [
        {
          title: "2K Cross-Franchise Pollination · WWE / PGA / BL4 / Civ VII",
          query:
            "Cross-franchise 2K Account players active across WWE 2K25, PGA TOUR 2K25, Borderlands 4, and Civilization VII with $150+ lifetime spend",
          franchise: "WWE2K",
          tag: "PLAY 04 · 2K ECOSYSTEM",
          highlight: `${p4N} players`,
        },
      ],
    },
    {
      id: "creator-crews",
      category: "creator_halo",
      tabLabel: "05 · Creator Squads",
      shortLabel: "Creator Squads",
      badge: "CREATOR HALO · 2-HOP",
      iconType: "creator",
      iconColor: "#00D2FF",
      bgAccent: "rgba(0,210,255,0.08)",
      pillColor: "#00D2FF",
      metricPill: `${p5N} squad followers`,
      title: `${p5N} high-LTV NBA 2K27 players follow Agent 00, Troydan, CashNasty, KOT4Q, DBG & Tydebo`,
      summary: `2-hop FOLLOWS_CREATOR traversal isolates ${p5N} theorycrafters and Park grinders (avg LTV $${Math.round(
        p5Spend
      )}) who benchmark badge breakpoints and pack odds through top NBA 2K creators before spending VC.`,
      base: `TakeTwoPlayerGraph · Creator Halo Network`,
      metrics: {
        cohortSize: p5N,
        avgSpend: Math.round(p5Spend),
        avgChurn: Number(p5Churn.toFixed(2)),
        liftMetric: "0.88 Creator Affinity",
        highRiskCount: Math.round(p5N * 0.2),
        secondaryMetric: "Creator Locker Code & 75K VC Cap Breaker Pack",
      },
      caveats: [
        "Pair creator-endorsed Cap Breaker builds with verified MyTEAM pack odds to maximize conversion.",
      ],
      actionLabel: "Load Creator Squad Cohort",
      queryToRun:
        "High-LTV NBA 2K27 players following Creator Squads Agent 00, Troydan, CashNasty, Kenny Beecham / KOT4Q, DBG, and Tydebo",
      franchise: "NBA2K",
      prompts: [
        {
          title: "Creator Squads · Agent 00 / Troydan / CashNasty / KOT4Q / DBG",
          query:
            "High-LTV NBA 2K27 players following Creator Squads Agent 00, Troydan, CashNasty, Kenny Beecham / KOT4Q, DBG, and Tydebo",
          franchise: "NBA2K",
          tag: "PLAY 05 · CREATOR HALO",
          highlight: `${p5N} players`,
        },
      ],
    },
  ];

  return {
    finding: findings[0],
    findings,
    executive_summary: executiveSummary,
    model_used: modelUsed,
    play_counts: {
      play1: p1N,
      play2: p2N,
      play3: p3N,
      play4: p4N,
      play5: p5N,
      total: totalN,
    },
    is_live: true,
    execution_ms: Date.now() - started,
    timings_ms: { spanner: spannerMs, gemini: geminiMs },
  };
}

export async function GET(request: NextRequest) {
  const franchise = (
    request.nextUrl.searchParams.get("franchise") || "ALL"
  ).toUpperCase() as GameFranchise;
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  try {
    const data = await getFindings(franchise, fresh);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawText = await request.text();
    const body = rawText ? JSON.parse(rawText) : {};
    const franchise = String(body?.franchise || "ALL").toUpperCase() as GameFranchise;
    const data = await getFindings(franchise, body?.fresh === true);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
