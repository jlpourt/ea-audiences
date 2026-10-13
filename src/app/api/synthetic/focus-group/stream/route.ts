import { NextRequest, NextResponse } from "next/server";
import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { buildPersonaPrompt } from "@/lib/prompts/courtside_personas";
import { FocusGroupReaction, SwarmCrowdAgent, CreatorBroadcast } from "@/lib/types";
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
import { MODELS } from "@/lib/models";

export const dynamic = "force-dynamic";

function computeTallies(
  coreReactions: FocusGroupReaction[],
  crowdAgents: SwarmCrowdAgent[],
  round: 1 | 2
) {
  const coreStates = coreReactions.map((r) =>
    round === 1 ? r.round1_fsm_state || r.final_fsm_state : r.final_fsm_state
  );
  const crowdStates = crowdAgents.map((a) =>
    round === 1 ? a.round1_state : a.final_fsm_state
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
    campaignId = body.campaign_id || `fg-${Date.now()}`;
    franchise = body.franchise || "NBA2K";
    creativeTitle = body.creative_title || "Crew Re-Up Bundle";
    priceUsd = Number(body.price_usd ?? 4.99);
    altPriceUsd = typeof body.alt_price_usd === "number" ? body.alt_price_usd : null;
    cohortContext = body.cohort_context || null;
    swarmSize = body.swarm_size === 20 ? 20 : 100;
    enableContagion = body.enable_contagion !== false;
    counterfactualEvent =
      typeof body.counterfactual_event === "string" && body.counterfactual_event.trim()
        ? body.counterfactual_event.trim()
        : null;

    const incoming = Array.isArray(body.sampled_players) ? [...body.sampled_players] : [];
    const liveSpannerPool = await fetchLiveSpannerPersonas(100, franchise);

    // Enrich incoming graph players with Spanner Crew & Creator edges if missing
    const spannerById = new Map(liveSpannerPool.map((p) => [p.player_id, p]));
    const enrichedIncoming = incoming.map((p, idx) => {
      const sp = spannerById.get(p.player_id) || liveSpannerPool[idx % liveSpannerPool.length] || {};
      return {
        ...sp,
        ...p,
        crew_name: p.crew_name || sp.crew_name || "Bucket Getters",
        crew_tier: p.crew_tier || sp.crew_tier || "Rec",
        crew_role: p.crew_role || sp.crew_role || "MEMBER",
        creator_handle: p.creator_handle || sp.creator_handle || "@Agent00",
      };
    });

    const usedIds = new Set(enrichedIncoming.map((p) => p.player_id));
    const remainingPool = liveSpannerPool.filter((p) => !usedIds.has(p.player_id));
    const combined = [...enrichedIncoming, ...remainingPool];

    corePlayers = combined.slice(0, 20);
    crowdPlayers = swarmSize === 100 ? combined.slice(20, 100) : [];
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

      const r1ReactionsByIndex: FocusGroupReaction[] = new Array(corePlayers.length);
      let fastModelUsed = MODELS.FAST.id;
      let liteModelUsed = MODELS.LITE.id;

      try {
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

          const state = parsed.final_fsm_state;
          const reaction: FocusGroupReaction = {
            player_id: player.player_id || `persona-${index + 1}`,
            gamer_tag: player.gamer_tag || `Player_${index + 1}`,
            archetype: player.archetype || player.primary_archetype || "MYCAREER_STORY_CASUAL",
            crew_name: player.crew_name || "Bucket Getters",
            crew_tier: player.crew_tier || "Rec",
            crew_role: player.crew_role || "MEMBER",
            creator_handle: player.creator_handle || "@Agent00",
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

        await Promise.all(personaPromises);
        const r1Reactions = r1ReactionsByIndex.filter(Boolean);

        // Phase 2: Creator Megaphone Broadcasts + Round 2 Social Contagion + Tiered N=80 Crowd Swarm
        let creatorBroadcasts: CreatorBroadcast[] = [];
        let finalCoreReactions: FocusGroupReaction[] = r1Reactions;
        let crowdAgents: SwarmCrowdAgent[] = [];
        let flipsCount = 0;

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
              counterfactualEvent
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
                  }
                )
              : Promise.resolve({ crowdAgents: [] as SwarmCrowdAgent[], liteModelUsed }),
          ]);

          finalCoreReactions = r2Outcome.reactions;
          crowdAgents = swarmOutcome.crowdAgents;
          liteModelUsed = swarmOutcome.liteModelUsed;
          const crowdFlips = crowdAgents.filter((a) => a.contagion_flipped).length;
          flipsCount = r2Outcome.flipsCount + crowdFlips;

          sendEvent({
            type: "contagion_r2",
            reactions: finalCoreReactions,
            coreFlipsCount: r2Outcome.flipsCount,
            totalFlipsCount: flipsCount,
            crewCaptainSummary: r2Outcome.crewCaptainSummary,
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
            }
          );
          crowdAgents = swarmOutcome.crowdAgents;
          liteModelUsed = swarmOutcome.liteModelUsed;
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
          round1_tally: round1Tally,
          round2_tally: round2Tally,
          alt_result: altResult,
        };

        sendEvent({ type: "consensus", result: fullResult });
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
