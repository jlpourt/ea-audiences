import { NextRequest, NextResponse } from "next/server";
import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { buildPersonaPrompt } from "@/lib/prompts/courtside_personas";
import {
  FocusGroupReaction,
  SwarmCrowdAgent,
  CreatorBroadcast,
  RedditEchoItem,
  FSMState,
} from "@/lib/types";
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
  normalizeCreatorHandle,
  ExtendedFocusGroupResult,
} from "@/lib/focus-group-eval";
import { SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { MODELS } from "@/lib/models";

export const dynamic = "force-dynamic";

function computeTallies(
  coreReactions: FocusGroupReaction[],
  crowdAgents: SwarmCrowdAgent[],
  round: 1 | 2 | 3
) {
  const coreStates = coreReactions.map((r) =>
    round === 1
      ? r.round1_fsm_state || r.final_fsm_state
      : round === 3
        ? r.round3_fsm_state || r.final_fsm_state
        : r.final_fsm_state
  );
  const crowdStates = crowdAgents.map((a) =>
    round === 1
      ? a.round1_state
      : round === 3
        ? a.round3_state || a.final_fsm_state
        : a.final_fsm_state
  );
  const all = [...coreStates, ...crowdStates];
  return {
    purchased: all.filter((s) => s === "PURCHASED").length,
    evaluating: all.filter((s) => s === "EVALUATING" || s === "ENGAGED_FREE").length,
    abandoned: all.filter((s) => s === "ABANDONED").length,
    boycott: all.filter((s) => s === "BOYCOTT").length,
  };
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  let mode: "full" | "counterfactual_branch" = "full";
  let existingResult: Partial<ExtendedFocusGroupResult> | null = null;
  let branchR2Reactions: FocusGroupReaction[] = [];
  let branchCrowdAgents: SwarmCrowdAgent[] = [];
  let corePlayers: any[] = [];
  let crowdPlayers: any[] = [];
  let campaignId = `fg-${Date.now()}`;
  let franchise = "NBA2K";
  let creativeTitle = "Crew Re-Up Bundle";
  let priceUsd = 4.99;
  let altPriceUsd: number | null = null;
  let cohortContext: any = null;
  let swarmSize = 100;
  let enableContagion = true;
  let counterfactualEvent: string | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    mode = body.mode === "counterfactual_branch" ? "counterfactual_branch" : "full";
    existingResult = body.existing_result || null;
    campaignId = body.campaign_id || existingResult?.campaign_id || `fg-${Date.now()}`;
    franchise = body.franchise || existingResult?.franchise || "NBA2K";
    creativeTitle =
      body.creative_title || existingResult?.creative_title || "Crew Re-Up Bundle";
    priceUsd = Number(body.price_usd ?? existingResult?.proposed_spend ?? 4.99);
    altPriceUsd = typeof body.alt_price_usd === "number" ? body.alt_price_usd : null;
    cohortContext = body.cohort_context || null;
    swarmSize = body.swarm_size === 20 ? 20 : 100;
    enableContagion = body.enable_contagion !== false;
    counterfactualEvent =
      typeof body.counterfactual_event === "string" && body.counterfactual_event.trim()
        ? body.counterfactual_event.trim()
        : null;

    if (mode === "counterfactual_branch") {
      if (!counterfactualEvent) {
        return NextResponse.json(
          {
            error: "counterfactual_event is required when mode === 'counterfactual_branch'",
          },
          { status: 400 }
        );
      }

      branchR2Reactions = Array.isArray(existingResult?.reactions)
        ? existingResult!.reactions
        : Array.isArray(body.r2_reactions)
          ? body.r2_reactions
          : Array.isArray(body.reactions)
            ? body.reactions
            : [];

      branchCrowdAgents = Array.isArray(existingResult?.crowd_agents)
        ? existingResult!.crowd_agents
        : Array.isArray(body.crowd_agents)
          ? body.crowd_agents
          : [];

      if (branchR2Reactions.length === 0) {
        return NextResponse.json(
          {
            error:
              "existing_result.reactions (or r2_reactions) is required when mode === 'counterfactual_branch'",
          },
          { status: 400 }
        );
      }
    } else {
      const incoming = Array.isArray(body.sampled_players) ? [...body.sampled_players] : [];
      const liveSpannerPool = await fetchLiveSpannerPersonas(100, franchise);

      // Enrich incoming graph players with Spanner Crew & Creator edges if missing
      const spannerById = new Map(liveSpannerPool.map((p) => [p.player_id, p]));
      const enrichedIncoming = incoming.map((p, idx) => {
        const sp =
          spannerById.get(p.player_id) || liveSpannerPool[idx % liveSpannerPool.length] || {};
        return {
          ...sp,
          ...p,
          crew_name: p.crew_name || sp.crew_name || "Bucket Getters",
          crew_tier: p.crew_tier || sp.crew_tier || "Rec",
          crew_role: p.crew_role || sp.crew_role || "MEMBER",
          creator_handle: normalizeCreatorHandle(
            p.creator_handle || sp.creator_handle || "@Agent00"
          ),
        };
      });

      const usedIds = new Set(enrichedIncoming.map((p) => p.player_id));
      const remainingPool = liveSpannerPool.filter((p) => !usedIds.has(p.player_id));
      const combined = [...enrichedIncoming, ...remainingPool];

      corePlayers = combined.slice(0, 20);
      crowdPlayers = swarmSize === 100 ? combined.slice(20, 100) : [];
    }
  } catch (err: any) {
    console.error("[Focus Group Stream Spanner Init Error]:", err);
    const isSpanner = err instanceof SpannerUnavailableError;
    return NextResponse.json(
      {
        error: "Failed to initialize focus group personas from 2K Identity Graph",
        service: isSpanner ? "cloud-spanner" : "vertex-ai",
        details: err?.message || String(err),
      },
      { status: isSpanner ? 503 : 502 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Fast path: God's-Eye Mid-Simulation Shock (Round 3 · What-If Rescue Branching)
      if (mode === "counterfactual_branch" && counterfactualEvent) {
        try {
          sendEvent({
            type: "status",
            phase: "round3_shock",
            message: `Round 3 · What-If Rescue Shock: ${counterfactualEvent}`,
          });

          const r3Outcome = await evaluateRound3Counterfactual(
            branchR2Reactions,
            branchCrowdAgents,
            creativeTitle,
            priceUsd,
            counterfactualEvent,
            franchise
          );

          sendEvent({
            type: "contagion_r3",
            round: 3,
            reactions: r3Outcome.reactions,
            crowdAgents: r3Outcome.crowdAgents,
            r3Tally: r3Outcome.r3Tally,
            round3_tally: r3Outcome.r3Tally,
            r3FlipsCount: r3Outcome.r3FlipsCount,
            counterfactual_event: counterfactualEvent,
          });

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

          const round1Tally =
            existingResult?.round1_tally ||
            computeTallies(r3Outcome.reactions, r3Outcome.crowdAgents, 1);
          const round2Tally =
            existingResult?.round2_tally ||
            computeTallies(r3Outcome.reactions, r3Outcome.crowdAgents, 2);

          const updatedResult: ExtendedFocusGroupResult = {
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
            round1_tally: round1Tally,
            round2_tally: round2Tally,
            round3_tally: r3Outcome.r3Tally,
            alt_result: existingResult?.alt_result,
          };

          sendEvent({ type: "consensus", result: updatedResult });
          sendEvent({ type: "complete", result: updatedResult });
          sendEvent({ type: "done", ok: true });
        } catch (err: any) {
          console.error("[Focus Group R3 Counterfactual Stream Error]:", err);
          const errorMsg =
            err?.message || "Round 3 counterfactual branch evaluation failed";
          sendEvent({ type: "error", error: errorMsg, message: errorMsg });
        } finally {
          controller.close();
        }
        return;
      }

      // Full Simulation Run (Round 1 Isolated -> Dual-Platform Creator + Reddit + Crew Round 2)
      const r1ReactionsByIndex: FocusGroupReaction[] = new Array(corePlayers.length);
      let fastModelUsed = MODELS.FAST.id;
      let liteModelUsed = MODELS.LITE.id;

      try {
        // Kick off live grounded Reddit pulse fetch in parallel with Round 1 so it adds 0ms wait time
        const redditPromise = fetchLiveRedditThreadsForContagion(creativeTitle, franchise);

        // Phase 1: Stream Round 1 individual gut reactions from the 20 Core Personas
        const personaPromises = corePlayers.map(async (player, index) => {
          const { system, prompt } = buildPersonaPrompt(
            player,
            creativeTitle,
            priceUsd,
            franchise,
            counterfactualEvent
          );
          const res = await generateText({
            role: "FAST",
            system,
            prompt,
            json: true,
            thinkingBudget: 0,
            maxOutputTokens: 512,
          });
          fastModelUsed = res.modelUsed;
          const parsed = parseModelJson<any>(res.text);
          if (!parsed) {
            throw new Error(
              `Persona evaluation returned unparseable JSON for ${player.gamer_tag || `persona-${index + 1}`}`
            );
          }

          const state = (parsed.final_fsm_state || "EVALUATING") as FSMState;
          const reaction: FocusGroupReaction = {
            player_id: player.player_id || `persona-${index + 1}`,
            gamer_tag: player.gamer_tag || `Player_${index + 1}`,
            archetype: player.archetype || player.primary_archetype || "MYCAREER_STORY_CASUAL",
            myplayer_ovr: Number(player.myplayer_ovr || 85),
            crew_name: player.crew_name || "Bucket Getters",
            crew_tier: player.crew_tier || "Rec",
            crew_role: player.crew_role || "MEMBER",
            creator_handle: normalizeCreatorHandle(player.creator_handle || "@Agent00"),
            willingness_to_pay_usd: Number(parsed.willingness_to_pay_usd),
            final_fsm_state: state,
            round1_fsm_state: state,
            round1_quote: parsed.verbatim_quote,
            round1_wtp_usd: Number(parsed.willingness_to_pay_usd),
            contagion_flipped: false,
            contagion_driver: "NONE",
            verbatim_quote: parsed.verbatim_quote,
            sentiment_score: Number(parsed.sentiment_score),
            authenticity_rating: Number(parsed.authenticity_rating ?? 0.94),
            churn_risk_score: Number(parsed.churn_risk_score ?? player.churn_risk_score ?? 0.25),
          };

          r1ReactionsByIndex[index] = reaction;
          sendEvent({ type: "verdict", round: 1, index, reaction });
          return reaction;
        });

        const [, rawRedditThreads] = await Promise.all([
          Promise.all(personaPromises),
          redditPromise,
        ]);
        const r1Reactions = r1ReactionsByIndex.filter(Boolean);

        // Phase 2: Creator Megaphone Broadcasts + Round 2 Dual-Platform Contagion + Tiered N=80 Crowd Swarm
        let creatorBroadcasts: CreatorBroadcast[] = [];
        let finalCoreReactions: FocusGroupReaction[] = r1Reactions;
        let crowdAgents: SwarmCrowdAgent[] = [];
        let flipsCount = 0;
        let enrichedRedditThreads: RedditEchoItem[] = rawRedditThreads;

        if (enableContagion) {
          creatorBroadcasts = await generateCreatorBroadcasts(
            creativeTitle,
            priceUsd,
            franchise,
            r1Reactions,
            counterfactualEvent
          );
          sendEvent({ type: "creator_broadcasts", broadcasts: creatorBroadcasts });

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
                  (batchIndex, batchAgents) => {
                    sendEvent({
                      type: "swarm_batch",
                      batchIndex,
                      agents: batchAgents,
                    });
                  },
                  rawRedditThreads
                )
              : Promise.resolve({ crowdAgents: [] as SwarmCrowdAgent[], liteModelUsed }),
          ]);

          finalCoreReactions = r2Outcome.reactions;
          crowdAgents = swarmOutcome.crowdAgents;
          liteModelUsed = swarmOutcome.liteModelUsed;
          const crowdFlips = crowdAgents.filter((a) => a.contagion_flipped).length;
          flipsCount = r2Outcome.flipsCount + crowdFlips;
          enrichedRedditThreads = computeRedditEchoMetrics(
            rawRedditThreads,
            finalCoreReactions,
            crowdAgents
          );

          sendEvent({
            type: "contagion_r2",
            reactions: finalCoreReactions,
            coreFlipsCount: r2Outcome.flipsCount,
            totalFlipsCount: flipsCount,
            crewCaptainSummary: r2Outcome.crewCaptainSummary,
            reddit_threads: enrichedRedditThreads,
          });
        } else if (swarmSize === 100 && crowdPlayers.length > 0) {
          const swarmOutcome = await evaluateCrowdSwarm80(
            crowdPlayers,
            creativeTitle,
            priceUsd,
            franchise,
            [],
            counterfactualEvent,
            (batchIndex, batchAgents) => {
              sendEvent({
                type: "swarm_batch",
                batchIndex,
                agents: batchAgents,
              });
            },
            rawRedditThreads
          );
          crowdAgents = swarmOutcome.crowdAgents;
          liteModelUsed = swarmOutcome.liteModelUsed;
          enrichedRedditThreads = computeRedditEchoMetrics(
            rawRedditThreads,
            finalCoreReactions,
            crowdAgents
          );
        }

        // Phase 3: Synthesize Consensus + Optional Offer Battle
        let altResult: ExtendedFocusGroupResult["alt_result"] | undefined = undefined;
        let synthesis: Awaited<ReturnType<typeof synthesizeConsensus>>;

        if (altPriceUsd !== null && altPriceUsd !== priceUsd) {
          const [primarySynthesis, altEvaluation] = await Promise.all([
            synthesizeConsensus(finalCoreReactions, creativeTitle, priceUsd, franchise, cohortContext, {
              crowdAgents,
              creatorBroadcasts,
              counterfactualEvent,
              flipsCount,
            }),
            evaluatePersonas(corePlayers, creativeTitle, altPriceUsd, franchise, counterfactualEvent),
          ]);
          synthesis = primarySynthesis;
          const altSynthesis = await synthesizeConsensus(
            altEvaluation.reactions,
            creativeTitle,
            altPriceUsd,
            franchise,
            cohortContext
          );

          const purchasedCount = altEvaluation.reactions.filter(
            (r) => r.final_fsm_state === "PURCHASED"
          ).length;
          const evaluatingCount = altEvaluation.reactions.filter(
            (r) => r.final_fsm_state === "EVALUATING" || r.final_fsm_state === "ENGAGED_FREE"
          ).length;
          const abandonedCount = altEvaluation.reactions.filter(
            (r) => r.final_fsm_state === "ABANDONED"
          ).length;
          const boycottCount = altEvaluation.reactions.filter(
            (r) => r.final_fsm_state === "BOYCOTT"
          ).length;

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
        } else {
          synthesis = await synthesizeConsensus(
            finalCoreReactions,
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
        }

        const round1Tally = computeTallies(finalCoreReactions, crowdAgents, 1);
        const round2Tally = computeTallies(finalCoreReactions, crowdAgents, 2);

        const fullResult: ExtendedFocusGroupResult = {
          campaign_id: campaignId,
          franchise,
          creative_title: creativeTitle,
          target_cohort_query: cohortContext?.query,
          proposed_spend: priceUsd,
          target_roas: 3.4,
          reactions: finalCoreReactions,
          consensus_summary: synthesis.consensusSummary,
          predicted_conversion_lift: synthesis.predictedConversionLift,
          sentiment_decay_index: 0.12,
          churn_mitigation_lift: synthesis.churnMitigationLift,
          projected_revenue_impact_usd: synthesis.projectedRevenueImpactUsd,
          backlash_index: synthesis.backlashIndex,
          wtp_curve: synthesis.wtpCurve,
          recommended_price: synthesis.recommendedPrice,
          model_used: fastModelUsed,
          lite_model_used: liteModelUsed,
          reasoning_model_used: synthesis.reasoningModelUsed,
          latency_ms: Date.now() - started,
          swarm_size: finalCoreReactions.length + crowdAgents.length,
          counterfactual_event: counterfactualEvent,
          creator_broadcasts: creatorBroadcasts,
          crowd_agents: crowdAgents,
          contagion_flips_count: flipsCount,
          crew_contagion_multiplier: synthesis.crewContagionMultiplier,
          contagion_summary: synthesis.contagionSummary,
          migration_curve: synthesis.migrationCurve,
          reddit_threads: enrichedRedditThreads,
          round1_tally: round1Tally,
          round2_tally: round2Tally,
          alt_result: altResult,
        };

        sendEvent({ type: "consensus", result: fullResult });
        sendEvent({ type: "complete", result: fullResult });
        sendEvent({ type: "done", ok: true });
      } catch (err: any) {
        console.error("[Focus Group Stream Error]:", err);
        const errorMsg = err?.message || "Focus group evaluation stream failed";
        sendEvent({ type: "error", error: errorMsg, message: errorMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
