import { NextRequest, NextResponse } from "next/server";
import { runRawGql, toNumber, SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { generateText } from "@/lib/gcp/genai-client";

export const dynamic = "force-dynamic";

interface PlayerRecord {
  player_id: string;
  gamer_tag: string;
  dma_market: string;
  country: string;
  primary_archetype: string;
  primary_franchise: string;
  franchises_played: string[];
  account_tenure_days: number;
  lifetime_spend_usd: number;
  churn_risk_score: number;
  tilt_sensitivity: number;
  recent_loss_streak: number;
  game_telemetry: Record<string, any>;
}

interface StageDefinition {
  stageIndex: number;
  id: string;
  title: string;
  subtitle: string;
  color: string;
}

const STAGES: StageDefinition[][] = [
  // Stage 1 (0): Acquisition
  [
    { stageIndex: 0, id: "acq_launch", title: "NBA 2K27 Launch", subtitle: "Cover Stars Wemby & Clark", color: "#E4002B" },
    { stageIndex: 0, id: "acq_returning", title: "2K26 Returning Veterans", subtitle: "2K Account Multi-Year", color: "#FF6B35" },
    { stageIndex: 0, id: "acq_cross2k", title: "Cross-2K Ecosystem", subtitle: "WWE 2K25 · PGA 2K25 · BL4", color: "#F5B400" },
  ],
  // Stage 2 (1): Mode Entry
  [
    { stageIndex: 1, id: "mode_career", title: "MyCAREER / The City", subtitle: "Park, Rec & Pro-Am Crews", color: "#E4002B" },
    { stageIndex: 1, id: "mode_myteam", title: "MyTEAM", subtitle: "Packs & Auction House", color: "#F5B400" },
    { stageIndex: 1, id: "mode_mynba_w", title: "MyNBA & The W", subtitle: "Eras & Caitlin Clark WNBA", color: "#2E8B57" },
  ],
  // Stage 3 (2): Week 4-6 Status
  [
    { stageIndex: 2, id: "status_85plus", title: "85+ OVR Grinders", subtitle: "Badges & Cap Breakers", color: "#19C37D" },
    { stageIndex: 2, id: "status_sub85_cliff", title: "Sub-85 Stalled Cliff", subtitle: "Play 1 Retention Churn Risk", color: "#FF4D5E" },
    { stageIndex: 2, id: "status_whale", title: "MyTEAM Opal Whales", subtitle: "10+ Opals Collector", color: "#F5B400" },
    { stageIndex: 2, id: "status_2k26_holdout", title: "2K26 Holdout Squads", subtitle: "Play 2 Loyalty Upgrade Target", color: "#FF6B35" },
  ],
  // Stage 4 (3): Intervention Offer
  [
    { stageIndex: 3, id: "offer_crew_reup", title: "$4.99 Crew Re-Up", subtitle: "15K VC + Teammate Invite", color: "#19C37D" },
    { stageIndex: 3, id: "offer_hof_pass", title: "HoF Season Pass", subtitle: "$19.99 40-Tier Accelerator", color: "#F5B400" },
    { stageIndex: 3, id: "offer_deluxe_pack", title: "Galaxy Opal Pack", subtitle: "$14.99 97+ Player Card", color: "#C8905A" },
    { stageIndex: 3, id: "offer_2k26_upgrade", title: "2K26 → 2K27 HoF Upgrade", subtitle: "$69.99 Full Game + 100K VC", color: "#FF6B35" },
  ],
  // Stage 5 (4): Season 2 Outcome
  [
    { stageIndex: 4, id: "out_retained", title: "Retained in Season 2", subtitle: "Ready for Oct 17 Tip-Off", color: "#19C37D" },
    { stageIndex: 4, id: "out_expansion", title: "High-LTV 2K Expansion", subtitle: "Season 2 VIP & Multi-2K", color: "#F5B400" },
    { stageIndex: 4, id: "out_churn", title: "Season 1 Cliff Churn", subtitle: "Lost Engagement Pre-Oct 16", color: "#FF4D5E" },
  ],
];

const CROSS_2K_FRANCHISES = new Set(["WWE2K", "PGA2K", "TOPSPIN", "BL4", "CIV7", "MAFIA"]);

function classifyPlayer(p: PlayerRecord) {
  const tel = p.game_telemetry || {};
  const spend = p.lifetime_spend_usd || 0;
  const churn = p.churn_risk_score || 0;
  const ovr = tel.myplayer_ovr !== null && tel.myplayer_ovr !== undefined ? Number(tel.myplayer_ovr) : null;
  const opals = Number(tel.myteam_galaxy_opal_count || 0);
  const daysAgo = Number(tel.last_login_days_ago || 0);
  const is2k26Veteran = Boolean(tel.nba2k26_veteran);
  const migratedTo2k27 = Boolean(tel.migrated_to_2k27);
  const hasCross2k =
    CROSS_2K_FRANCHISES.has(p.primary_franchise) ||
    (Array.isArray(p.franchises_played) && p.franchises_played.some((f) => CROSS_2K_FRANCHISES.has(f))) ||
    Number(tel.cross_2k_titles || 0) >= 2;

  // Stage 1 (0): Acquisition
  let s0 = "acq_launch";
  if (is2k26Veteran || p.primary_franchise === "NBA2K26") {
    s0 = "acq_returning";
  } else if (hasCross2k) {
    s0 = "acq_cross2k";
  }

  // Stage 2 (1): Mode Entry
  let s1 = "mode_career";
  if (p.primary_archetype === "MYTEAM_PACK_WHALE" || opals > 0 || Number(tel.myteam_packs_opened_30d || 0) > 0) {
    s1 = "mode_myteam";
  } else if (p.primary_archetype === "MYNBA_FRANCHISE_SIM" || p.primary_archetype === "THE_W_LOYALIST") {
    s1 = "mode_mynba_w";
  }

  // Stage 3 (2): Week 4–6 Status
  let s2 = "status_85plus";
  if ((is2k26Veteran && !migratedTo2k27) || p.primary_franchise === "NBA2K26" || p.primary_archetype === "CROSS_LABEL_NOMAD") {
    s2 = "status_2k26_holdout";
  } else if (opals >= 10 || p.primary_archetype === "MYTEAM_PACK_WHALE") {
    s2 = "status_whale";
  } else if (ovr !== null && ovr < 85 && (daysAgo >= 5 || churn >= 0.45)) {
    s2 = "status_sub85_cliff";
  }

  // Stage 4 (3): Intervention Offer
  let s3 = "offer_hof_pass";
  if (s2 === "status_sub85_cliff") {
    s3 = "offer_crew_reup";
  } else if (s2 === "status_whale") {
    s3 = "offer_deluxe_pack";
  } else if (s2 === "status_2k26_holdout" || (is2k26Veteran && !migratedTo2k27)) {
    s3 = "offer_2k26_upgrade";
  }

  // Stage 5 (4): Season 2 Outcome
  let s4 = "out_retained";
  if (churn >= 0.6 || (s2 === "status_sub85_cliff" && daysAgo >= 10)) {
    s4 = "out_churn";
  } else if (spend >= 250 || Number(tel.vc_spend_90d || 0) >= 80 || tel.season_pass_edition === "HALL_OF_FAME") {
    s4 = "out_expansion";
  }

  return [s0, s1, s2, s3, s4];
}

async function computeFunnel() {
  const started = Date.now();
  const rows = await runRawGql(
    `SELECT p.player_id, p.display_name, p.gamer_tag, p.primary_franchise,
            p.franchises_played, p.primary_archetype, p.lifetime_spend_usd,
            p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak,
            p.account_tenure_days, p.dma_market, p.country, p.game_telemetry
     FROM Players p`
  );

  const players: PlayerRecord[] = rows.map((r: any) => ({
    player_id: String(r.player_id),
    gamer_tag: String(r.gamer_tag || r.display_name || r.player_id),
    dma_market: String(r.dma_market || "National"),
    country: String(r.country || "USA"),
    primary_archetype: String(r.primary_archetype || "MYCAREER_STORY_CASUAL"),
    primary_franchise: String(r.primary_franchise || "NBA2K"),
    franchises_played: Array.isArray(r.franchises_played) ? r.franchises_played : [],
    account_tenure_days: toNumber(r.account_tenure_days),
    lifetime_spend_usd: toNumber(r.lifetime_spend_usd),
    churn_risk_score: toNumber(r.churn_risk_score),
    tilt_sensitivity: toNumber(r.tilt_sensitivity),
    recent_loss_streak: toNumber(r.recent_loss_streak),
    game_telemetry: typeof r.game_telemetry === "string" ? JSON.parse(r.game_telemetry) : (r.game_telemetry || {}),
  }));

  const totalPlayers = players.length || 1;

  // Flatten stage definitions
  const nodeDefMap = new Map<string, StageDefinition>();
  for (const stageList of STAGES) {
    for (const def of stageList) {
      nodeDefMap.set(def.id, def);
    }
  }

  // Node stats
  const nodeStats = new Map<string, { count: number; spend: number; sampled: any[] }>();
  for (const id of nodeDefMap.keys()) {
    nodeStats.set(id, { count: 0, spend: 0, sampled: [] });
  }

  // Link stats
  const linkStats = new Map<string, {
    id: string;
    source: string;
    target: string;
    sourceStage: number;
    targetStage: number;
    count: number;
    spend: number;
    sampled: any[];
  }>();

  for (const p of players) {
    const trajectory = classifyPlayer(p);
    const pSummary = {
      player_id: p.player_id,
      gamer_tag: p.gamer_tag,
      dma_market: p.dma_market,
      primary_archetype: p.primary_archetype,
      ovr: p.game_telemetry.myplayer_ovr ?? null,
      spend: p.lifetime_spend_usd,
      churn_risk: p.churn_risk_score,
      tilt: p.tilt_sensitivity,
    };

    // Update nodes
    for (const nodeId of trajectory) {
      const ns = nodeStats.get(nodeId);
      if (ns) {
        ns.count += 1;
        ns.spend += p.lifetime_spend_usd;
        if (ns.sampled.length < 8) ns.sampled.push(pSummary);
      }
    }

    // Update 4 transitions
    for (let s = 0; s < 4; s++) {
      const sourceId = trajectory[s];
      const targetId = trajectory[s + 1];
      const linkKey = `${sourceId}->${targetId}`;

      let ls = linkStats.get(linkKey);
      if (!ls) {
        ls = {
          id: linkKey,
          source: sourceId,
          target: targetId,
          sourceStage: s,
          targetStage: s + 1,
          count: 0,
          spend: 0,
          sampled: [],
        };
        linkStats.set(linkKey, ls);
      }
      ls.count += 1;
      ls.spend += p.lifetime_spend_usd;
      if (ls.sampled.length < 6) ls.sampled.push(pSummary);
    }
  }

  // Format nodes
  const nodes = Array.from(nodeDefMap.values()).map((def) => {
    const ns = nodeStats.get(def.id) || { count: 0, spend: 0, sampled: [] };
    return {
      id: def.id,
      name: def.title,
      subtitle: def.subtitle,
      stage: def.stageIndex,
      color: def.color,
      count: ns.count,
      spend: Math.round(ns.spend),
      pct: Math.round((ns.count / totalPlayers) * 100),
      sampled_players: ns.sampled,
    };
  });

  // Format links
  const links = Array.from(linkStats.values()).map((ls) => ({
    id: ls.id,
    source: ls.source,
    target: ls.target,
    sourceStage: ls.sourceStage,
    targetStage: ls.targetStage,
    count: ls.count,
    spend: Math.round(ls.spend),
    pct: Math.round((ls.count / totalPlayers) * 100),
    sampled_players: ls.sampled,
  }));

  // Aggregate metrics
  const cliffChurnCount = nodeStats.get("out_churn")?.count || 0;
  const retainedCount = (nodeStats.get("out_retained")?.count || 0) + (nodeStats.get("out_expansion")?.count || 0);
  const sub85Count = nodeStats.get("status_sub85_cliff")?.count || 0;
  const crewReupCount = nodeStats.get("offer_crew_reup")?.count || 0;
  const holdout2k26Count = nodeStats.get("status_2k26_holdout")?.count || 0;
  const totalSpend = players.reduce((sum, p) => sum + p.lifetime_spend_usd, 0);

  const metrics = {
    totalPlayers,
    totalSpend: Math.round(totalSpend),
    retainedCount,
    retainedRatePct: Math.round((retainedCount / totalPlayers) * 100),
    cliffChurnCount,
    sub85Count,
    crewReupCount,
    holdout2k26Count,
  };

  const sampled_players = players.slice(0, 12).map((p) => ({
    player_id: p.player_id,
    gamer_tag: p.gamer_tag,
    dma_market: p.dma_market,
    primary_archetype: p.primary_archetype,
    ovr: p.game_telemetry.myplayer_ovr ?? null,
    spend: p.lifetime_spend_usd,
    churn_risk: p.churn_risk_score,
  }));

  const execution_ms = Date.now() - started;

  return { nodes, links, metrics, sampled_players, execution_ms };
}

export async function GET() {
  try {
    const funnel = await computeFunnel();
    const diagnosis = `Rescued ${funnel.metrics.crewReupCount} sub-85 MyPLAYER builds via the $4.99 Crew Re-Up (${funnel.metrics.retainedRatePct}% Season 2 retention), while ${funnel.metrics.holdout2k26Count} NBA 2K26 holdout veterans remain primed for the $69.99 HoF Loyalty Upgrade.`;

    return NextResponse.json({
      nodes: funnel.nodes,
      links: funnel.links,
      metrics: funnel.metrics,
      diagnosis,
      model_used: "live-telemetry-eval",
      execution_ms: funnel.execution_ms,
      sampled_players: funnel.sampled_players,
    });
  } catch (error: any) {
    console.error("[journey-summary] Route error:", error);
    if (error instanceof SpannerUnavailableError) {
      return NextResponse.json(
        { error: error.message, service: "2K Telemetry Graph", is_live: false },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: error?.message || "Failed to compute journey summary",
        service: "2K Intelligence Engine",
        is_live: false,
      },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawText = await request.text();
    const body = rawText ? JSON.parse(rawText) : {};
    const { stageFrom, stageTo } = body;

    const funnel = await computeFunnel();

    const genRes = await generateText({
      role: "FAST",
      prompt: `You are the VP Growth Marketing strategist for 2K Courtside analyzing a specific cohort path in NBA 2K27 Season 1 -> Season 2.
Path: "${stageFrom || "NBA 2K27 Launch"}" -> "${stageTo || "Retained in Season 2"}".
Total Audience: ${funnel.metrics.totalPlayers} players (Sub-85 Stalled Cliff: ${funnel.metrics.sub85Count}, 2K26 Holdout Squads: ${funnel.metrics.holdout2k26Count}, Retained Rate: ${funnel.metrics.retainedRatePct}%).

Provide a single concise sentence (under 25 words, no em-dashes) detailing why players flow along this path and how 2K live-ops maximizes retention or LTV.`,
      temperature: 0.2,
      maxOutputTokens: 512,
      thinkingBudget: 0,
    });

    const diagnosis = genRes.text.trim().replace(/\s*\u2014\s*/g, " · ");
    if (!diagnosis) {
      throw new Error(`2K Intelligence Engine (${genRes.modelUsed}) returned an empty transition diagnosis.`);
    }
    const model_used = genRes.modelUsed;

    return NextResponse.json({
      nodes: funnel.nodes,
      links: funnel.links,
      metrics: funnel.metrics,
      diagnosis,
      model_used,
      execution_ms: funnel.execution_ms,
      sampled_players: funnel.sampled_players,
    });
  } catch (error: any) {
    console.error("[journey-summary-post] Route error:", error);
    if (error instanceof SpannerUnavailableError) {
      return NextResponse.json(
        { error: error.message, service: "2K Telemetry Graph", is_live: false },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: error?.message || "Failed to process journey transition",
        service: "2K Intelligence Engine",
        is_live: false,
      },
      { status: 502 }
    );
  }
}
