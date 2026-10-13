import { NextRequest, NextResponse } from "next/server";
import { generateText, parseModelJson, groundedSearch } from "@/lib/gcp/genai-client";
import { CAMPAIGN_BRIEF_PROMPT } from "@/lib/prompts/brief_generator";
import { CampaignBrief } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const franchise = body.franchise || "NBA 2K27";
    const segment = body.segment || "MyCAREER Builds Under 85 OVR Stall Cohort";
    const creativeTitle = body.creative_title || "Crew Re-Up Bundle";
    const predictedLift = Number(body.predicted_conversion_lift || 28.5);
    const audienceSize = Number(body.audience_size || 284000);
    const priceUsd = Number(body.price_usd || 4.99);
    const focusGroupConsensus = body.focus_group_consensus || body.consensus_summary;
    let groundedInsight = body.grounded_community_insight || body.grounded_insight;
    const clientStrategicPivot = body.strategic_pivot;

    // Grounded sentiment via live 2K Intelligence Engine Search grounding
    if (!groundedInsight) {
      const searchRes = await groundedSearch({
        prompt: `What are r/NBA2K and r/MyTEAM players saying about NBA 2K27 microtransactions, VC prices, and Season 1 progression?`,
      });
      groundedInsight = searchRes.text.trim();
      if (!groundedInsight) {
        throw new Error("2K Intelligence Engine groundedSearch returned empty community insight");
      }
    }

    const prompt = `
${CAMPAIGN_BRIEF_PROMPT}

Target Franchise: ${franchise}
Target Audience Segment: "${segment}"
Proposed Campaign Proposition: "${creativeTitle}"
Proposed Price: $${priceUsd.toFixed(2)} USD
Courtside Focus Group Consensus: "${focusGroupConsensus || "High enthusiasm for squad utility, strong rejection of isolated microtransactions."}"
Predicted Conversion Lift from Focus Group: +${predictedLift}%
Addressable Audience Size: ${audienceSize.toLocaleString()}
Grounded Community Insight: "${groundedInsight}"
${clientStrategicPivot ? `Strategic Pivot: ${JSON.stringify(clientStrategicPivot)}` : ""}

Generate an executive-ready Campaign Brief in strict JSON format:
{
  "brief_id": "brief-2k-...",
  "title": "...",
  "franchise": "${franchise}",
  "target_segment": "${segment}",
  "audience_size": ${audienceSize},
  "trigger_rules": [
    "...",
    "...",
    "..."
  ],
  "focus_group_consensus": "...",
  "predicted_conversion_lift": ${predictedLift},
  "projected_roi": 3.40,
  "recommended_action": "...",
  "creative_hooks": [
    "...",
    "...",
    "..."
  ],
  "grounded_community_insight": "${groundedInsight}",
  "strategic_pivot": {
    "original_concept": "...",
    "pivot_reason": "...",
    "pivoted_concept": "..."
  }
}
`;

    const textRes = await generateText({
      role: "REASONING",
      prompt,
      system: "You are the Principal Marketing Strategist for Take-Two Interactive and 2K Publishing.",
      json: true,
    });

    const parsed = parseModelJson<any>(textRes.text);
    if (
      !parsed ||
      !parsed.title ||
      !Array.isArray(parsed.trigger_rules) ||
      !Array.isArray(parsed.creative_hooks) ||
      !parsed.recommended_action
    ) {
      throw new Error("2K Intelligence Engine campaign brief generation returned invalid or incomplete JSON payload");
    }

    const consensusText = String(parsed.focus_group_consensus || focusGroupConsensus || "");

    const brief: CampaignBrief = {
      brief_id: String(parsed.brief_id || `brief-2k-${Date.now()}`),
      title: String(parsed.title),
      franchise: String(parsed.franchise || franchise),
      target_segment: String(parsed.target_segment || segment),
      audience_size: Number(parsed.audience_size ?? audienceSize),
      trigger_rules: parsed.trigger_rules.map(String),
      focus_group_consensus: consensusText,
      predicted_conversion_lift: Number(parsed.predicted_conversion_lift ?? predictedLift),
      projected_roi: Number(parsed.projected_roi ?? 3.4),
      recommended_action: String(parsed.recommended_action),
      creative_hooks: parsed.creative_hooks.map(String),
      grounded_community_insight: String(parsed.grounded_community_insight || groundedInsight),
      strategic_pivot: parsed.strategic_pivot,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(brief);
  } catch (error: any) {
    console.error("[Campaign Brief Error]:", error);
    return NextResponse.json(
      {
        error: "Failed to generate campaign brief via 2K Intelligence Engine",
        service: "2k-intelligence-engine",
        details: error?.message || String(error),
      },
      { status: 502 }
    );
  }
}

