import { NextRequest, NextResponse } from "next/server";
import { generateText, synthesizeSpeech, type TTSVoice } from "@/lib/gcp/genai-client";
import { uploadMedia } from "@/lib/gcp/storage-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const offerTitle = body.offerTitle || "Crew Re-Up Bundle";
    const audienceName = body.audienceName || "2K Ballers";
    let script = body.script;
    const voice: TTSVoice = (body.voice as TTSVoice) || "Charon";

    let textModelUsed = "";
    if (!script || typeof script !== "string" || !script.trim()) {
      const scriptPrompt = `Write a high-energy NBA arena PA announcer voiceover script promoting the in-game offer "${offerTitle}" to ${audienceName}.
Rules:
1. MUST be 28 words or fewer.
2. MUST explicitly mention NBA 2K27 Season 1 ending October 16.
3. Use intense basketball announcer cadence ("Listen up, ballers! Season 1 ends October 16...").
4. Output ONLY the announcer script text without quotes or explanations.`;

      const scriptRes = await generateText({
        role: "LITE",
        prompt: scriptPrompt,
        temperature: 0.7,
        maxOutputTokens: 60,
      });
      script = scriptRes.text.trim();
      textModelUsed = scriptRes.modelUsed;
    }

    const ttsRes = await synthesizeSpeech({
      text: script,
      voice,
      style: "NBA arena PA announcer, booming, energetic, hype public address cadence",
    });

    const uploadRes = await uploadMedia({
      bytes: ttsRes.bytes,
      mimeType: ttsRes.mimeType,
      prefix: "audio",
    });

    return NextResponse.json({
      url: uploadRes.url,
      script,
      modelUsed: textModelUsed ? `${textModelUsed} + ${ttsRes.modelUsed}` : ttsRes.modelUsed,
      latencyMs: ttsRes.latencyMs,
    });
  } catch (error: any) {
    console.error("[Creative Voice Error]:", error);
    return NextResponse.json(
      {
        error: "Failed to generate arena announcer VO",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
