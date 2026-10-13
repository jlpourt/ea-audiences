import { NextRequest, NextResponse } from "next/server";
import {
  evaluatePersonas,
  generateCreatorBroadcasts,
  evaluateContagionRound2,
  evaluateCrowdSwarm80,
  evaluateRound3Counterfactual,
  synthesizeConsensus,
  fetchLiveSpannerPersonas,
  fetchLiveRedditThreadsForContagion,
  computeRedditEchoMetrics,
  ExtendedFocusGroupResult,
} from "@/lib/focus-group-eval";
import { SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { MODELS } from "@/lib/models";
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
    const mode = body.mode === "counterfactual_branch" ? "counterfactual_branch" : "full";
    const existingResult: Partial<ExtendedFocusGroupResult> | null =
      body.existing_result || null;
    const campaignId =
      body.campaign_id || existingResult?.campaign_id || `fg-${Date.now()}`;
    const franchise = body.franchise || existingResult?.franchise || "NBA2K";
    const creativeTitle =
      body.creative_title || existingResult?.creative_title || "Crew Re-Up Bundle";
    const priceUsd = Number(body.price_usd ?? existingResult?.proposed_spend ?? 4.99);
    const altPriceUsd = typeof body.alt_price_usd === "number" ? body.alt_price_usd : null;
    const cohortContext = body.cohort_context || null;
    const swarmSize = body.swarm_size === 20 ? 20 : 100;
    const counterfactualEvent =
      typeof body.counterfactual_event === "string" && body.counterfactual_event.trim()
        ? body.counterfactual_event.trim()
        : null;

    if (mode === "counterfactual_branch" && counterfactualEvent) {
      const inputReactions = Array.isArray(existingResult?.reactions)
        ? existingResult!.reactions
        : Array.isArray(body.r2_reactions)
          ? body.r2_reactions
          : [];
      const inputCrowd = Array.isArray(existingResult?.crowd_agents)
        ? existingResult!.crowd_agents
        : Array.isArray(body.crowd_agents)
          ? body.crowd_agents
          : [];

      const r3Outcome = await evaluateRound3Counterfactual(
        inputReactions,
        inputCrowd,
        creativeTitle,
        priceUsd,
        counterfactualEvent,
        franchise
      );

      const r2Flips =
        typeof existingResult?.contagion_flips_count === "number"
          ? existingResult.contagion_flips_count
          : r3Outcome.reactions.filter((r) => r.contagion_flipped).length +
            r3Outcome.crowdAgents.filter((a) => a.contagion_flipped).length;

      const synthesis = await synthesizeConsensus(
        r3Outcome.reactions,
        creativeTitle,
        priceUsd,
        franchise,
        cohortContext,
        {
          crowdAgents: r3Outcome.crowdAgents,
          creatorBroadcasts: existingResult?.creator_broadcasts || [],
          counterfactualEvent,
          flipsCount: r2Flips + r3Outcome.r3FlipsCount,
        }
      );

      const r1States = [
        ...r3Outcome.reactions.map((r) => r.round1_fsm_state || r.final_fsm_state),
        ...r3Outcome.crowdAgents.map((a) => a.round1_state),
      ];
      const r2States = [
        ...r3Outcome.reactions.map((r) => r.final_fsm_state),
        ...r3Outcome.crowdAgents.map((a) => a.final_fsm_state),
      ];

      const updated: ExtendedFocusGroupResult = {
        campaign_id: campaignId,
        franchise,
        creative_title: creativeTitle,
        target_cohort_query:
          cohortContext?.query || existingResult?.target_cohort_query,
        proposed_spend: priceUsd,
        target_roas: existingResult?.target_roas ?? 3.4,
        reactions: r3Outcome.reactions,
        consensus_summary: synthesis.consensusSummary,
        predicted_conversion_lift: synthesis.predictedConversionLift,
        sentiment_decay_index: existingResult?.sentiment_decay_index ?? 0.12,
        churn_mitigation_lift: synthesis.churnMitigationLift,
        projected_revenue_impact_usd: synthesis.projectedRevenueImpactUsd,
        backlash_index: synthesis.backlashIndex,
        wtp_curve: synthesis.wtpCurve,
        recommended_price: synthesis.recommendedPrice,
        model_used: r3Outcome.fastModelUsed,
        lite_model_used: r3Outcome.liteModelUsed,
        reasoning_model_used: synthesis.reasoningModelUsed,
        latency_ms: Date.now() - started,
        swarm_size: r3Outcome.reactions.length + r3Outcome.crowdAgents.length,
        counterfactual_event: counterfactualEvent,
        creator_broadcasts: existingResult?.creator_broadcasts || [],
        crowd_agents: r3Outcome.crowdAgents,
        contagion_flips_count: r2Flips,
        round3_flips_count: r3Outcome.r3FlipsCount,
        crew_contagion_multiplier: synthesis.crewContagionMultiplier,
        contagion_summary: synthesis.contagionSummary,
        migration_curve: synthesis.migrationCurve,
        reddit_threads: existingResult?.reddit_threads,
        round1_tally: existingResult?.round1_tally || {
          purchased: r1States.filter((s) => s === "PURCHASED").length,
          evaluating: r1States.filter((s) => s === "EVALUATING" || s === "ENGAGED_FREE").length,
          abandoned: r1States.filter((s) => s === "ABANDONED").length,
          boycott: r1States.filter((s) => s === "BOYCOTT").length,
        },
        round2_tally: existingResult?.round2_tally || {
          purchased: r2States.filter((s) => s === "PURCHASED").length,
          evaluating: r2States.filter((s) => s === "EVALUATING" || s === "ENGAGED_FREE").length,
          abandoned: r2States.filter((s) => s === "ABANDONED").length,
          boycott: r2States.filter((s) => s === "BOYCOTT").length,
        },
        round3_tally: r3Outcome.r3Tally,
        alt_result: existingResult?.alt_result,
      };

      return NextResponse.json(updated);
    }

    const livePool = await fetchLiveSpannerPersonas(100, franchise);
    let sampledPlayers: any[] = Array.isArray(body.sampled_players) ? [...body.sampled_players] : [];
    const usedIds = new Set(sampledPlayers.map((p) => p.player_id));
    sampledPlayers = [
      ...sampledPlayers,
      ...livePool.filter((p) => !usedIds.has(p.player_id)),
    ];

    const corePlayers = sampledPlayers.slice(0, 20);
    const crowdPlayers = swarmSize === 100 ? sampledPlayers.slice(20, 100) : [];

    // Round 1 + Live Reddit Threads in parallel
    const [{ reactions: r1Reactions, modelUsed }, rawRedditThreads] = await Promise.all([
      evaluatePersonas(
        corePlayers,
        creativeTitle,
        priceUsd,
        franchise,
        counterfactualEvent
      ),
      fetchLiveRedditThreadsForContagion(creativeTitle, franchise),
    ]);

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
        counterfactualEvent,
        rawRedditThreads
      ),
      swarmSize === 100 && crowdPlayers.length > 0
        ? evaluateCrowdSwarm80(
            crowdPlayers,
            creativeTitle,
            priceUsd,
            franchise,
            creatorBroadcasts,
            counterfactualEvent,
            undefined,
            rawRedditThreads
          )
        : Promise.resolve({
            crowdAgents: [] as SwarmCrowdAgent[],
            liteModelUsed: MODELS.LITE.id,
          }),
    ]);

    const reactions = r2Outcome.reactions;
    const crowdAgents = swarmOutcome.crowdAgents;
    const flipsCount =
      r2Outcome.flipsCount + crowdAgents.filter((a) => a.contagion_flipped).length;
    const enrichedRedditThreads = computeRedditEchoMetrics(
      rawRedditThreads,
      reactions,
      crowdAgents
    );

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
      reddit_threads: enrichedRedditThreads,
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
