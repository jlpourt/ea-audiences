import { NextRequest, NextResponse } from "next/server";
import { generateMusic } from "@/lib/gcp/genai-client";
import { uploadMedia } from "@/lib/gcp/storage-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mood = body.mood || "arena-hype";

    let prompt = "";
    if (mood === "trap-bass") {
      prompt = "Heavy 808 trap beat with crisp basketball squeaks, energetic synth brass, and 140 BPM modern hip hop rhythm suitable for NBA 2K27 arena intros.";
    } else if (mood === "vice-city-synth") {
      prompt = "80s retro synthwave groove with pulsing bassline, lush analog pads, and sun-soaked Miami Vice aesthetic blending Take-Two cross-label energy.";
    } else if (mood === "cinematic-orchestral") {
      prompt = "Dramatic NBA playoff orchestral fanfare with driving timpani drums, victorious brass swells, and cinematic sports trailer intensity.";
    } else {
      // arena-hype default
      prompt = "High-energy NBA arena stadium hype bed with booming sub-bass, syncopated snare rolls, crowd chants, and driving four-on-the-floor beat.";
    }

    const musicRes = await generateMusic({
      prompt,
    });

    const uploadRes = await uploadMedia({
      bytes: musicRes.bytes,
      mimeType: musicRes.mimeType,
      prefix: "music",
    });

    return NextResponse.json({
      url: uploadRes.url,
      modelUsed: musicRes.modelUsed,
      latencyMs: musicRes.latencyMs,
      prompt,
    });
  } catch (error: any) {
    console.error("[Creative Music Error]:", error);
    return NextResponse.json(
      {
        error: "Failed to generate arena hype bed",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
