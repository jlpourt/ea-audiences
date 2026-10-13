import { NextRequest, NextResponse } from "next/server";
import {
  evaluatePersonas,
  generateCreatorBroadcasts,
  evaluateContagionRound2,
  evaluateCrowdSwarm80,
  synthesizeConsensus,
  fetchLiveSpannerPersonas,
  ExtendedFocusGroupResult,
} from "@/lib/focus-group-eval";
import { SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { SwarmCrowdAgent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 20);
    const franchise = searchParams.get("franchise") || "NBA2K";
    const personas = await fetchLiveSpannerPersonas(limit, franchise);
    return NextResponse.json({ ok: true, personas });
  } catch (error: any) {
    const isSpanner = error instanceof SpannerUnavailableError;
    return NextResponse.json(
      {
        error: "Failed to load live personas",
        service: isSpanner ? "cloud-spanner" : "vertex-ai",
        details: error?.message || String(error),
      },
      { status: isSpanner ? 503 : 502 }
    );
  }
}

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
    const swarmSize = body.swarm_size === 20 ? 20 : 100;
    const counterfactualEvent =
      typeof body.counterfactual_event === "string" && body.counterfactual_event.trim()
        ? body.counterfactual_event.trim()
        : null;

    const livePool = await fetchLiveSpannerPersonas(100, franchise);
    let sampledPlayers: any[] = Array.isArray(body.sampled_players) ? [...body.sampled_players] : [];
    const usedIds = new Set(sampledPlayers.map((p) => p.player_id));
    sampledPlayers = [
      ...sampledPlayers,
      ...livePool.filter((p) => !usedIds.has(p.player_id)),
    ];

    const corePlayers = sampledPlayers.slice(0, 20);
    const crowdPlayers = swarmSize === 100 ? sampledPlayers.slice(20, 100) : [];

    // Round 1 + Creator Broadcasts + Round 2 Contagion
    const { reactions: r1Reactions, modelUsed } = await evaluatePersonas(
      corePlayers,
      creativeTitle,
      priceUsd,
      franchise,
      counterfactualEvent
    );
    const creatorBroadcasts = await generateCreatorBroadcasts(
      creativeTitle,
      priceUsd,
      franchise,
      r1Reactions,
      counterfactualEvent
    );

    const [r2Outcome, swarmOutcome] = await Promise.all([
      evaluateContagionRound2(
        corePlayers,
        r1Reactions,
        creativeTitle,
        priceUsd,
        franchise,
        creatorBroadcasts,
        counterfactualEvent
      ),
      swarmSize === 100 && crowdPlayers.length > 0
        ? evaluateCrowdSwarm80(
            crowdPlayers,
            creativeTitle,
            priceUsd,
            franchise,
            creatorBroadcasts,
            counterfactualEvent
          )
        : Promise.resolve({
            crowdAgents: [] as SwarmCrowdAgent[],
            liteModelUsed: "gemini-3.5-flash-lite",
          }),
    ]);

    const reactions = r2Outcome.reactions;
    const crowdAgents = swarmOutcome.crowdAgents;
    const flipsCount =
      r2Outcome.flipsCount + crowdAgents.filter((a) => a.contagion_flipped).length;

    const synthesis = await synthesizeConsensus(
      reactions,
      creativeTitle,
      priceUsd,
      franchise,
      cohortContext,
      {
        crowdAgents,
        creatorBroadcasts,
        counterfactualEvent,
        flipsCount,
      }
    );

    let altResult: ExtendedFocusGroupResult["alt_result"] | undefined = undefined;
    if (altPriceUsd !== null && altPriceUsd !== priceUsd) {
      const altEvaluation = await evaluatePersonas(
        corePlayers,
        creativeTitle,
        altPriceUsd,
        franchise,
        counterfactualEvent
      );
      const altSynthesis = await synthesizeConsensus(
        altEvaluation.reactions,
        creativeTitle,
        altPriceUsd,
        franchise,
        cohortContext
      );

      altResult = {
        price_usd: altPriceUsd,
        reactions: altEvaluation.reactions,
        consensus_summary: altSynthesis.consensusSummary,
        predicted_conversion_lift: altSynthesis.predictedConversionLift,
        backlash_index: altSynthesis.backlashIndex,
        projected_revenue_impact_usd: altSynthesis.projectedRevenueImpactUsd,
        purchased_count: altEvaluation.reactions.filter((r) => r.final_fsm_state === "PURCHASED").length,
        evaluating_count: altEvaluation.reactions.filter(
          (r) => r.final_fsm_state === "EVALUATING" || r.final_fsm_state === "ENGAGED_FREE"
        ).length,
        abandoned_count: altEvaluation.reactions.filter((r) => r.final_fsm_state === "ABANDONED").length,
        boycott_count: altEvaluation.reactions.filter((r) => r.final_fsm_state === "BOYCOTT").length,
      };
    }

    const r1States = [
      ...reactions.map((r) => r.round1_fsm_state || r.final_fsm_state),
      ...crowdAgents.map((a) => a.round1_state),
    ];
    const r2States = [
      ...reactions.map((r) => r.final_fsm_state),
      ...crowdAgents.map((a) => a.final_fsm_state),
    ];

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
      lite_model_used: swarmOutcome.liteModelUsed,
      reasoning_model_used: synthesis.reasoningModelUsed,
      latency_ms: Date.now() - started,
      swarm_size: reactions.length + crowdAgents.length,
      counterfactual_event: counterfactualEvent,
      creator_broadcasts: creatorBroadcasts,
      crowd_agents: crowdAgents,
      contagion_flips_count: flipsCount,
      crew_contagion_multiplier: synthesis.crewContagionMultiplier,
      contagion_summary: synthesis.contagionSummary,
      migration_curve: synthesis.migrationCurve,
      round1_tally: {
        purchased: r1States.filter((s) => s === "PURCHASED").length,
        evaluating: r1States.filter((s) => s === "EVALUATING" || s === "ENGAGED_FREE").length,
        abandoned: r1States.filter((s) => s === "ABANDONED").length,
        boycott: r1States.filter((s) => s === "BOYCOTT").length,
      },
      round2_tally: {
        purchased: r2States.filter((s) => s === "PURCHASED").length,
        evaluating: r2States.filter((s) => s === "EVALUATING" || s === "ENGAGED_FREE").length,
        abandoned: r2States.filter((s) => s === "ABANDONED").length,
        boycott: r2States.filter((s) => s === "BOYCOTT").length,
      },
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
