import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/gcp/genai-client";
import { uploadMedia } from "@/lib/gcp/storage-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const offerTitle = body.offerTitle || "Galaxy Opal Deluxe Pack";
    const audienceName = body.audienceName || "2K27 Spenders";
    const style = (body.style as "myteam-pack" | "crew-reup" | "cross-label") || "myteam-pack";

    let stylePrompt = "";
    if (style === "myteam-pack") {
      stylePrompt = `NBA 2K27 MyTEAM Galaxy Opal luxury digital trading card pack, holographic foil texture, glowing 2K crimson and VC gold metallic accents, premium basketball collectible packaging with Victor Wembanyama silhouette, dramatic arena spotlights, 8k resolution studio product render. Title: "${offerTitle}".`;
    } else if (style === "crew-reup") {
      stylePrompt = `NBA 2K27 The City blacktop basketball court under twilight sky, dramatic arena lighting, squad of ballers in authentic 2K streetwear with glowing 15,000 VC token emblem in center court, broadcast sports graphic style, cinematic depth of field. Title: "${offerTitle}".`;
    } else {
      stylePrompt = `2K Games flagship promotional key visual: NBA 2K26 to 2K27 Hall of Fame Gold & Crimson Arena blending cleanly into a championship hardwood court with spotlights, Hall of Fame trophy gold and 2K crimson lighting, premium cross-title sports broadcast aesthetic. Title: "${offerTitle}". Target: "${audienceName}".`;
    }

    const imageRes = await generateImage({
      prompt: stylePrompt,
      aspectRatio: "1:1",
    });

    const uploadRes = await uploadMedia({
      bytes: imageRes.bytes,
      mimeType: imageRes.mimeType,
      prefix: "images",
    });

    return NextResponse.json({
      url: uploadRes.url,
      modelUsed: imageRes.modelUsed,
      latencyMs: imageRes.latencyMs,
      prompt: stylePrompt,
    });
  } catch (error: any) {
    console.error("[Creative Image Error]:", error);
    return NextResponse.json(
      {
        error: "Failed to generate creative pack art",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
