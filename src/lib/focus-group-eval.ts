import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { runRawGql, parseJsonColumn, toNumber } from "@/lib/gcp/spanner-client";
import { buildPersonaPrompt } from "@/lib/prompts/courtside_personas";
import { FocusGroupReaction, FocusGroupResult } from "@/lib/types";

export interface ExtendedFocusGroupResult extends FocusGroupResult {
  backlash_index: number;
  wtp_curve: Array<{ price: number; conversion_pct: number }>;
  recommended_price: number;
  model_used: string;
  reasoning_model_used: string;
  latency_ms: number;
  alt_result?: {
    price_usd: number;
    reactions: FocusGroupReaction[];
    consensus_summary: string;
    predicted_conversion_lift: number;
    backlash_index: number;
    projected_revenue_impact_usd: number;
    purchased_count: number;
    evaluating_count: number;
    abandoned_count: number;
    boycott_count: number;
  };
}

export async function fetchLiveSpannerPersonas(
  limit = 20,
  _franchise = "NBA2K"
): Promise<any[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const sql = `SELECT p.player_id, p.gamer_tag, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.dma_market, p.game_telemetry FROM GRAPH_TABLE(TakeTwoPlayerGraph MATCH (p:Player) RETURN p.player_id, p.gamer_tag, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.dma_market, p.game_telemetry) AS p LIMIT @limit`;
  const rows = await runRawGql(sql, { limit: safeLimit });

  return rows.map((r) => {
    const telemetry = parseJsonColumn(r.game_telemetry, {});
    return {
      player_id: r.player_id,
      gamer_tag: r.gamer_tag,
      archetype: r.primary_archetype || "MYCAREER_STORY_CASUAL",
      primary_archetype: r.primary_archetype || "MYCAREER_STORY_CASUAL",
      lifetime_spend_usd: toNumber(r.lifetime_spend_usd),
      churn_risk_score: toNumber(r.churn_risk_score),
      tilt_sensitivity: toNumber(r.tilt_sensitivity),
      recent_loss_streak: toNumber(r.recent_loss_streak),
      dma_market: r.dma_market ?? null,
      game_telemetry: telemetry,
      myplayer_ovr:
        telemetry.myplayer_ovr !== undefined && telemetry.myplayer_ovr !== null
          ? toNumber(telemetry.myplayer_ovr)
          : 85,
      myplayer_build: telemetry.myplayer_build || "Balanced Build",
      vc_spend_90d:
        telemetry.vc_spend_90d !== undefined && telemetry.vc_spend_90d !== null
          ? toNumber(telemetry.vc_spend_90d)
          : toNumber(r.lifetime_spend_usd),
      vc_balance:
        telemetry.vc_balance !== undefined && telemetry.vc_balance !== null
          ? toNumber(telemetry.vc_balance)
          : 15000,
      loss_streak:
        telemetry.loss_streak !== undefined && telemetry.loss_streak !== null
          ? toNumber(telemetry.loss_streak)
          : toNumber(r.recent_loss_streak),
      rage_quits_7d:
        telemetry.rage_quits_7d !== undefined && telemetry.rage_quits_7d !== null
          ? toNumber(telemetry.rage_quits_7d)
          : 0,
      season_pass_edition: telemetry.season_pass_edition || "NONE",
      season_pass_tier:
        telemetry.season_pass_tier !== undefined && telemetry.season_pass_tier !== null
          ? toNumber(telemetry.season_pass_tier)
          : 12,
      myteam_galaxy_opal_count:
        telemetry.myteam_galaxy_opal_count !== undefined &&
        telemetry.myteam_galaxy_opal_count !== null
          ? toNumber(telemetry.myteam_galaxy_opal_count)
          : 0,
      park_win_pct:
        telemetry.park_win_pct !== undefined && telemetry.park_win_pct !== null
          ? toNumber(telemetry.park_win_pct)
          : 0.5,
      rockstar_linked: Boolean(telemetry.rockstar_linked),
      gta_online_spend_usd:
        telemetry.gta_online_spend_usd !== undefined && telemetry.gta_online_spend_usd !== null
          ? toNumber(telemetry.gta_online_spend_usd)
          : 0,
      gta6_preorder: Boolean(telemetry.gta6_preorder),
      gravity_score:
        telemetry.gravity_score !== undefined && telemetry.gravity_score !== null
          ? toNumber(telemetry.gravity_score)
          : 0.5,
      favorite_team: telemetry.favorite_team || "Los Angeles Lakers",
    };
  });
}

export async function evaluatePersonas(
  players: any[],
  offerTitle: string,
  priceUsd: number,
  franchise: string
): Promise<{ reactions: FocusGroupReaction[]; modelUsed: string }> {
  let modelUsed = "gemini-3.5-flash";

  const promises = players.map(async (player, index) => {
    const { system, prompt } = buildPersonaPrompt(player, offerTitle, priceUsd, franchise);
    const res = await generateText({
      role: "FAST",
      system,
      prompt,
      json: true,
    });
    modelUsed = res.modelUsed;
    const parsed = parseModelJson<any>(res.text);
    if (!parsed) {
      throw new Error(
        `Vertex AI persona evaluation returned unparseable JSON for ${player.gamer_tag || `persona-${index + 1}`}`
      );
    }

    const reaction: FocusGroupReaction = {
      player_id: player.player_id || `persona-${index + 1}`,
      gamer_tag: player.gamer_tag || `Player_${index + 1}`,
      archetype: player.archetype || player.primary_archetype || "MYCAREER_STORY_CASUAL",
      willingness_to_pay_usd: Number(parsed.willingness_to_pay_usd),
      final_fsm_state: parsed.final_fsm_state,
      verbatim_quote: parsed.verbatim_quote,
      sentiment_score: Number(parsed.sentiment_score),
      authenticity_rating: Number(parsed.authenticity_rating ?? 0.94),
      churn_risk_score: Number(parsed.churn_risk_score ?? player.churn_risk_score ?? 0.25),
    };
    return reaction;
  });

  const reactions = await Promise.all(promises);
  return { reactions, modelUsed };
}

export async function synthesizeConsensus(
  reactions: FocusGroupReaction[],
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  cohortContext?: any
): Promise<{
  consensusSummary: string;
  predictedConversionLift: number;
  backlashIndex: number;
  wtpCurve: Array<{ price: number; conversion_pct: number }>;
  recommendedPrice: number;
  projectedRevenueImpactUsd: number;
  churnMitigationLift: number;
  reasoningModelUsed: string;
}> {
  const prompt = `You are the Lead Audience Intelligence & Pricing Strategist for Take-Two Interactive / 2K Games.
Synthesize the results of a 20-persona synthetic focus group evaluating the commercial offer:
Offer Title: "${offerTitle}"
Proposed Price: $${priceUsd.toFixed(2)} USD
Franchise: ${franchise}
Target Cohort: ${cohortContext?.query || "2K27 Active Cohort"}

Here are the individual persona evaluations from across the 10 Take-Two player archetypes:
${JSON.stringify(
  reactions.map((r) => ({
    gamer_tag: r.gamer_tag,
    archetype: r.archetype,
    state: r.final_fsm_state,
    wtp: r.willingness_to_pay_usd,
    sentiment: r.sentiment_score,
    quote: r.verbatim_quote,
  })),
  null,
  2
)}

Provide an executive synthesis in strict JSON format:
{
  "consensus_summary": "1-2 dense sentences summarizing the community consensus, key friction points (e.g. VC pricing skepticism, pack odds, squad utility), and winning proposition.",
  "predicted_conversion_lift": <number: estimated percentage lift, e.g. 24.8>,
  "backlash_index": <number: 0 to 100 indicating community backlash / boycott risk>,
  "wtp_curve": [
    { "price": 2.99, "conversion_pct": <number 0-100> },
    { "price": 4.99, "conversion_pct": <number 0-100> },
    { "price": 7.99, "conversion_pct": <number 0-100> },
    { "price": 9.99, "conversion_pct": <number 0-100> },
    { "price": 12.99, "conversion_pct": <number 0-100> },
    { "price": 14.99, "conversion_pct": <number 0-100> },
    { "price": 19.99, "conversion_pct": <number 0-100> },
    { "price": 24.99, "conversion_pct": <number 0-100> }
  ],
  "recommended_price": <number: the revenue-maximizing price point that keeps backlash under control>,
  "projected_revenue_impact_usd": <number: estimated incremental gross revenue, e.g. 142000>,
  "churn_mitigation_lift": <number: churn reduction percentage, e.g. 18.5>
}`;

  const res = await generateText({
    role: "REASONING",
    prompt,
    system: "You are an expert game monetization and community sentiment economist at Take-Two Interactive.",
    json: true,
  });
  const parsed = parseModelJson<any>(res.text);
  if (!parsed || !Array.isArray(parsed.wtp_curve)) {
    throw new Error("Vertex AI consensus synthesis returned invalid or incomplete JSON payload");
  }

  return {
    consensusSummary: String(parsed.consensus_summary),
    predictedConversionLift: Number(parsed.predicted_conversion_lift),
    backlashIndex: Number(parsed.backlash_index),
    wtpCurve: parsed.wtp_curve.map((pt: any) => ({
      price: Number(pt.price),
      conversion_pct: Number(pt.conversion_pct),
    })),
    recommendedPrice: Number(parsed.recommended_price),
    projectedRevenueImpactUsd: Number(parsed.projected_revenue_impact_usd),
    churnMitigationLift: Number(parsed.churn_mitigation_lift),
    reasoningModelUsed: res.modelUsed,
  };
}

