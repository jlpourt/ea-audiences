import { NextRequest, NextResponse } from "next/server";
import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { buildPersonaPrompt } from "@/lib/prompts/courtside_personas";
import { FocusGroupReaction } from "@/lib/types";
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
  let sampledPlayers: any[] = [];
  let campaignId = `fg-${Date.now()}`;
  let franchise = "NBA2K";
  let creativeTitle = "Crew Re-Up Bundle";
  let priceUsd = 4.99;
  let altPriceUsd: number | null = null;
  let cohortContext: any = null;

  try {
    const body = await request.json().catch(() => ({}));
    campaignId = body.campaign_id || `fg-${Date.now()}`;
    franchise = body.franchise || "NBA2K";
    creativeTitle = body.creative_title || "Crew Re-Up Bundle";
    priceUsd = Number(body.price_usd ?? 4.99);
    altPriceUsd = typeof body.alt_price_usd === "number" ? body.alt_price_usd : null;
    cohortContext = body.cohort_context || null;

    sampledPlayers = Array.isArray(body.sampled_players) ? [...body.sampled_players] : [];
    if (sampledPlayers.length < 20) {
      const needed = 20 - sampledPlayers.length;
      const liveSpannerPersonas = await fetchLiveSpannerPersonas(needed, franchise);
      sampledPlayers = [...sampledPlayers, ...liveSpannerPersonas];
    }
    sampledPlayers = sampledPlayers.slice(0, 20);
  } catch (err: any) {
    console.error("[Focus Group Stream Spanner Init Error]:", err);
    const isSpanner = err instanceof SpannerUnavailableError;
    return NextResponse.json(
      {
        error: "Failed to initialize focus group personas from Cloud Spanner",
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

      const reactionsByIndex: FocusGroupReaction[] = new Array(sampledPlayers.length);
      let fastModelUsed = "gemini-3.5-flash";

      try {
        // Stream each persona verdict live as it resolves from Vertex AI
        const personaPromises = sampledPlayers.map(async (player, index) => {
          const { system, prompt } = buildPersonaPrompt(player, creativeTitle, priceUsd, franchise);
          const res = await generateText({
            role: "FAST",
            system,
            prompt,
            json: true,
          });
          fastModelUsed = res.modelUsed;
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

          reactionsByIndex[index] = reaction;
          sendEvent({ type: "verdict", index, reaction });
          return reaction;
        });

        await Promise.all(personaPromises);
        const reactions = reactionsByIndex.filter(Boolean);

        // Synthesize primary consensus (and optional Offer Battle alt_price_usd evaluation) against Vertex AI
        let altResult: ExtendedFocusGroupResult["alt_result"] | undefined = undefined;
        let synthesis: Awaited<ReturnType<typeof synthesizeConsensus>>;

        if (altPriceUsd !== null && altPriceUsd !== priceUsd) {
          const [primarySynthesis, altEvaluation] = await Promise.all([
            synthesizeConsensus(reactions, creativeTitle, priceUsd, franchise, cohortContext),
            evaluatePersonas(sampledPlayers, creativeTitle, altPriceUsd, franchise),
          ]);
          synthesis = primarySynthesis;
          const altSynthesis = await synthesizeConsensus(
            altEvaluation.reactions,
            creativeTitle,
            altPriceUsd,
            franchise,
            cohortContext
          );

          const purchasedCount = altEvaluation.reactions.filter((r) => r.final_fsm_state === "PURCHASED").length;
          const evaluatingCount = altEvaluation.reactions.filter(
            (r) => r.final_fsm_state === "EVALUATING" || r.final_fsm_state === "ENGAGED_FREE"
          ).length;
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
        } else {
          synthesis = await synthesizeConsensus(reactions, creativeTitle, priceUsd, franchise, cohortContext);
        }

        const fullResult: ExtendedFocusGroupResult = {
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
          model_used: fastModelUsed,
          reasoning_model_used: synthesis.reasoningModelUsed,
          latency_ms: Date.now() - started,
          alt_result: altResult,
        };

        sendEvent({ type: "consensus", result: fullResult });
        sendEvent({ type: "done", ok: true });
      } catch (err: any) {
        console.error("[Focus Group Stream Error]:", err);
        const errorMsg = err?.message || "Vertex AI focus group stream failed";
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

