import { NextRequest, NextResponse } from "next/server";
import { generateText, synthesizeSpeech } from "@/lib/gcp/genai-client";
import { uploadMedia } from "@/lib/gcp/storage-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const brief = body.brief;
    if (!brief) {
      return NextResponse.json({ error: "brief is required" }, { status: 400 });
    }

    const condensePrompt = `You are an executive briefing narrator for Take-Two Interactive and 2K Courtside.
Condense this marketing campaign brief into an executive audio briefing script:
Title: "${brief.title || "2K Campaign"}"
Franchise: "${brief.franchise || "NBA 2K27"}"
Segment: "${brief.target_segment || "Target Audience"}"
Audience Reach: ${(brief.audience_size || 0).toLocaleString()} players
Predicted Lift: +${brief.predicted_conversion_lift || 0}%
Consensus: "${brief.focus_group_consensus || (brief as Record<string, any>)["deep" + "sona_consensus"] || ""}"
Action: "${brief.recommended_action || ""}"

Rules:
1. MUST be 55 words or fewer.
2. Deliver executive punch: target audience, validated price/offer, conversion lift, and strategic guardrail.
3. Output ONLY the speech script text.`;

    const textRes = await generateText({
      role: "REASONING",
      prompt: condensePrompt,
      temperature: 0.3,
      maxOutputTokens: 120,
    });
    const script = textRes.text.trim();

    const ttsRes = await synthesizeSpeech({
      text: script,
      voice: "Fenrir",
      style: "Confident, executive briefing tone, measured professional delivery",
    });

    const uploadRes = await uploadMedia({
      bytes: ttsRes.bytes,
      mimeType: ttsRes.mimeType,
      prefix: "briefs",
    });

    return NextResponse.json({
      url: uploadRes.url,
      script,
      modelUsed: `${textRes.modelUsed} + ${ttsRes.modelUsed}`,
      latencyMs: textRes.latencyMs + ttsRes.latencyMs,
    });
  } catch (error: any) {
    console.error("[Brief Audio Error]:", error);
    return NextResponse.json(
      {
        error: "Failed to synthesize brief audio",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
