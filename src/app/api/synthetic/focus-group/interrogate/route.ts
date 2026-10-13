import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gcp/genai-client";
import { COURTSIDE_PERSONA_PROMPTS } from "@/lib/prompts/courtside_personas";
import { ArchetypeId } from "@/lib/archetypes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const persona = body.persona;
    const question = body.question;
    const offerTitle = body.offer_title || "Proposed Offer";
    const priceUsd = Number(body.price_usd ?? 4.99);

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const archetypeId = (persona?.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL";
    const def = COURTSIDE_PERSONA_PROMPTS[archetypeId] || COURTSIDE_PERSONA_PROMPTS.MYCAREER_STORY_CASUAL;
    const gamerTag = persona?.gamer_tag || def.gamer_tag;

    const system = `${def.systemPrompt}

You are in a live interrogation session with 2K's VP of Growth Marketing and Live Services Analytics team.
Your gamer tag is "${gamerTag}".
The proposed offer is: "${offerTitle}" at $${priceUsd.toFixed(2)}.

Answer the marketer's question directly, staying in character as an authentic 2K / Take-Two player.
Give a crisp, punchy 2-3 sentence answer in real gamer voice (VC, Cap Breakers, The City, Park, Rec, MyTEAM, Season Pass, GTA VI).
Never use corporate marketing jargon. Never reference outside franchises or competitor games.`;

    const prompt = `The marketing team asks you:
"${question}"

Give your crisp 2-3 sentence in-character response:`;

    const res = await generateText({
      role: "REASONING",
      system,
      prompt,
      temperature: 0.7,
      maxOutputTokens: 250,
    });

    return NextResponse.json({
      answer: res.text.trim(),
      gamer_tag: gamerTag,
      model_used: res.modelUsed,
      latency_ms: res.latencyMs,
    });
  } catch (error: any) {
    console.error("[Interrogate Error]:", error);
    return NextResponse.json(
      {
        error: "Persona interrogation failed",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
