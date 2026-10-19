/**
 * POST /api/v2/actions/plan  { play, segment }
 *
 * Offer Designer agent: Gemini drafts three variants (A/B/C) for the live
 * audience, grounded in its real size, mix and play signal, within the play's
 * brief and Take-Two guardrails. Structured JSON output (responseSchema).
 * 502 with the model and message on Vertex AI failure; 503 on Spanner.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { getAudience, PlayQueryError } from "@/lib/v2/plays-server";
import { CHANNELS, PLAYS, STUDIO_NAME, kpiOf, type PlanResponse, type PlanVariant, type PlayId } from "@/lib/v2/plays";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const schemaFor = (channels: readonly string[]) => ({
  type: "OBJECT",
  properties: {
    variants: {
      type: "ARRAY",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", enum: ["A", "B", "C"] },
          name: { type: "STRING", description: "2-4 word variant name" },
          hook: { type: "STRING", description: "the idea in one short line" },
          offer: { type: "STRING", description: "the concrete offer or reward" },
          message: { type: "STRING", description: "the player-facing message, max 140 characters, no emoji" },
          channel: { type: "STRING", enum: [...channels] },
          reward_trigger: { type: "STRING", description: "when the reward is granted" },
          why: { type: "STRING", description: "why this should work for this audience, one sentence citing the audience facts" },
        },
        required: ["id", "name", "hook", "offer", "message", "channel", "reward_trigger", "why"],
      },
    },
    guardrails: { type: "ARRAY", items: { type: "STRING" }, minItems: 2, maxItems: 4 },
  },
  required: ["variants", "guardrails"],
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const play = body?.play as PlayId;
  const segment = String(body?.segment ?? "");
  const def = PLAYS[play];
  if (!def) return NextResponse.json({ error: `Unknown play '${play}'` }, { status: 400 });
  const seg = def.segments.find((s) => s.id === segment);
  if (!seg) return NextResponse.json({ error: `Unknown segment '${segment}'` }, { status: 400 });

  let audience;
  try {
    audience = (await getAudience(play, segment)).response;
  } catch (e) {
    return NextResponse.json({ error: "Spanner Graph audience query failed", service: "spanner", message: (e as Error).message, gql: e instanceof PlayQueryError ? e.gql : null }, { status: 503 });
  }

  const st = audience.stats;
  const facts = [
    `Audience: ${seg.who}`,
    `Size: ${audience.count.toLocaleString("en-US")} players (live Spanner Graph).`,
    `Average lifetime spend: $${st.avg_spend_usd.toFixed(0)}. Average churn risk: ${(st.avg_churn_risk * 100).toFixed(0)}%.`,
    st.signal_label && st.avg_signal != null ? `Average ${st.signal_label}: ${st.avg_signal.toFixed(2)}.` : "",
    `Top archetypes: ${st.top_archetypes.map((a) => `${a.name} ${(a.share * 100).toFixed(0)}%`).join(", ")}.`,
    `Top home titles: ${st.top_home_titles.map((t) => `${t.title} ${(t.share * 100).toFixed(0)}%`).join(", ")}.`,
  ].filter(Boolean);

  const t0 = Date.now();
  try {
    const gen = await generateText({
      role: "FAST",
      schema: schemaFor(def.channels.filter((c) => (CHANNELS as readonly string[]).includes(c))),
      temperature: 0.6,
      maxOutputTokens: 4096,
      thinkingBudget: 0,
      system:
        "You are the Offer Designer agent for Take-Two Interactive's cross-franchise marketing team (2K, Rockstar Games, Zynga). " +
        "Draft exactly three clearly different variants (A, B, C) for one audience. Be concrete and game-native. " +
        "Plain words, no emoji, no em dashes, no hype. Never invent statistics; only use the facts given. " +
        "Never name or reveal individual friends. Rewards must be realistic for the titles involved.",
      prompt: `Play: ${def.name} (${def.hook}).\nBrief: ${def.brief}\nThis audience: ${seg.label}.\nLabels involved: ${seg.labels.map((l) => STUDIO_NAME[l]).join(", ")}. The plan must be good for every label involved.\nKPI: ${kpiOf(play, segment)}\nAllowed channels: ${def.channels.join(", ")}.\n\nAudience facts:\n${facts.join("\n")}\n\nReturn three variants and 2-4 guardrails (consent, frequency, cannibalization, age) specific to this action.`,
    });
    if (gen.finishReason === "MAX_TOKENS") throw new Error(`Gemini (${gen.modelUsed}) truncated the plan (MAX_TOKENS).`);
    const parsed = parseModelJson<{ variants: PlanVariant[]; guardrails: string[] }>(gen.text);
    if (!parsed?.variants || parsed.variants.length !== 3) throw new Error(`Gemini (${gen.modelUsed}) returned an invalid plan: ${gen.text.slice(0, 300)}`);
    const variants = parsed.variants.map((v, i) => ({ ...v, id: (["A", "B", "C"] as const)[i], message: v.message.replace(/\u2014/g, ",") }));
    const out: PlanResponse = { play, segment, variants, guardrails: parsed.guardrails ?? [], kpi: kpiOf(play, segment), model_used: gen.modelUsed, latency_ms: Date.now() - t0 };
    return NextResponse.json(out);
  } catch (e) {
    console.error("[api/v2/actions/plan]", e);
    return NextResponse.json({ error: "Vertex AI plan generation failed", service: "vertex-ai", message: (e as Error).message }, { status: 502 });
  }
}
