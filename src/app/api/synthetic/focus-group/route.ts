import { NextRequest, NextResponse } from "next/server";
import {
  evaluatePersonas,
  synthesizeConsensus,
  fetchLiveSpannerPersonas,
  ExtendedFocusGroupResult,
} from "@/lib/focus-group-eval";
import { SpannerUnavailableError } from "@/lib/gcp/spanner-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const campaignId = body.campaign_id || `fg-${Date.now()}`;
    const franchise = body.franchise || "NBA2K";
    const creativeTitle = body.creative_title || "Crew Re-Up Bundle";
    const priceUsd = Number(body.price_usd ?? 4.99);
    const altPriceUsd = typeof body.alt_price_usd === "number" ? body.alt_price_usd : null;
    const cohortContext = body.cohort_context || null;

    // Ensure 20 live Spanner personas
    let sampledPlayers: any[] = Array.isArray(body.sampled_players) ? [...body.sampled_players] : [];
    if (sampledPlayers.length < 20) {
      const needed = 20 - sampledPlayers.length;
      const liveSpannerPersonas = await fetchLiveSpannerPersonas(needed, franchise);
      sampledPlayers = [...sampledPlayers, ...liveSpannerPersonas];
    }
    sampledPlayers = sampledPlayers.slice(0, 20);

    // Evaluate primary offer
    const { reactions, modelUsed } = await evaluatePersonas(sampledPlayers, creativeTitle, priceUsd, franchise);
    const synthesis = await synthesizeConsensus(reactions, creativeTitle, priceUsd, franchise, cohortContext);

    // If alt_price_usd is set (Offer Battle $14.99 vs $19.99), evaluate alt offer against Vertex AI
    let altResult: ExtendedFocusGroupResult["alt_result"] | undefined = undefined;
    if (altPriceUsd !== null && altPriceUsd !== priceUsd) {
      const altEvaluation = await evaluatePersonas(sampledPlayers, creativeTitle, altPriceUsd, franchise);
      const altSynthesis = await synthesizeConsensus(altEvaluation.reactions, creativeTitle, altPriceUsd, franchise, cohortContext);

      const purchasedCount = altEvaluation.reactions.filter((r) => r.final_fsm_state === "PURCHASED").length;
      const evaluatingCount = altEvaluation.reactions.filter((r) => r.final_fsm_state === "EVALUATING" || r.final_fsm_state === "ENGAGED_FREE").length;
      const abandonedCount = altEvaluation.reactions.filter((r) => r.final_fsm_state === "ABANDONED").length;
      const boycottCount = altEvaluation.reactions.filter((r) => r.final_fsm_state === "BOYCOTT").length;

      altResult = {
        price_usd: altPriceUsd,
        reactions: altEvaluation.reactions,
        consensus_summary: altSynthesis.consensusSummary,
        predicted_conversion_lift: altSynthesis.predictedConversionLift,
        backlash_index: altSynthesis.backlashIndex,
        projected_revenue_impact_usd: altSynthesis.projectedRevenueImpactUsd,
        purchased_count: purchasedCount,
        evaluating_count: evaluatingCount,
        abandoned_count: abandonedCount,
        boycott_count: boycottCount,
      };
    }

    const result: ExtendedFocusGroupResult = {
      campaign_id: campaignId,
      franchise,
      creative_title: creativeTitle,
      target_cohort_query: cohortContext?.query,
      proposed_spend: priceUsd,
      target_roas: 3.4,
      reactions,
      consensus_summary: synthesis.consensusSummary,
      predicted_conversion_lift: synthesis.predictedConversionLift,
      sentiment_decay_index: 0.12,
      churn_mitigation_lift: synthesis.churnMitigationLift,
      projected_revenue_impact_usd: synthesis.projectedRevenueImpactUsd,
      backlash_index: synthesis.backlashIndex,
      wtp_curve: synthesis.wtpCurve,
      recommended_price: synthesis.recommendedPrice,
      model_used: modelUsed,
      reasoning_model_used: synthesis.reasoningModelUsed,
      latency_ms: Date.now() - started,
      alt_result: altResult,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Focus Group Route Error]:", error);
    const isSpanner = error instanceof SpannerUnavailableError;
    return NextResponse.json(
      {
        error: "Focus group pressure test failed",
        service: isSpanner ? "cloud-spanner" : "vertex-ai",
        details: error?.message || String(error),
      },
      { status: isSpanner ? 503 : 502 }
    );
  }
}

