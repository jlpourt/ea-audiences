import { NextRequest, NextResponse } from "next/server";
import { generateGroundedContent, generateVertexContent, parseModelJson } from "@/lib/gcp/vertex-client";

export const dynamic = "force-dynamic";

/**
 * Real community sentiment, grounded in Google Search over reddit.com.
 *
 * Why not the Reddit API: the unauthenticated `.json` endpoints are blocked by
 * Reddit's network security, the `.rss` feeds carry no scores and no comments
 * and rate-limit at roughly one request per 15-30s, and the official OAuth API
 * treats sales-demo usage as commercial use requiring a paid Enterprise
 * Agreement. Google Search grounding gives us real, citable threads with no
 * third-party credentials.
 *
 * This route NEVER falls back to invented content. If grounding is unavailable
 * it returns 503 so the UI can say so plainly.
 */

/** Real, verified-active subreddits per franchise. */
const SUBREDDITS_BY_FRANCHISE: Record<string, string[]> = {
  COD: ["r/CallOfDuty", "r/CODWarzone", "r/blackops7", "r/ModernWarfareIII"],
  WOW: ["r/wow", "r/classicwow", "r/CompetitiveWoW"],
  DIABLO4: ["r/diablo4", "r/Diablo"],
  OVERWATCH2: ["r/Overwatch", "r/Competitiveoverwatch", "r/OverwatchUniversity"],
  CANDYCRUSH: ["r/candycrush"],
};

/**
 * Current live content per franchise, as of the catalog refresh. Passed to the
 * model so its search queries target what players are actually playing now
 * rather than a retired season.
 */
const LIVE_CONTEXT_BY_FRANCHISE: Record<string, string> = {
  COD: "Call of Duty: Black Ops 7 (released Nov 2025), Warzone, the BlackCell battle pass tier ($29.99), standard battle pass (1,100 CP / $9.99), CoD Points bundles, and the upcoming Modern Warfare 4",
  WOW: "World of Warcraft: Midnight (2026) and its current season, the $14.99/mo subscription, the WoW Token, paid character boosts and transfers, and Mists of Pandaria Classic",
  DIABLO4: "Diablo IV, its current season, the Lord of Hatred expansion, the premium battle pass, and platinum cosmetic pricing",
  OVERWATCH2: "Overwatch 2, its current season, Mythic Prism pricing, the premium battle pass, and collaboration skin bundles",
  CANDYCRUSH: "Candy Crush Saga, gold bar pricing, booster bundles, the Sugar Track season pass, and level difficulty pacing",
};

const FRANCHISE_LABEL: Record<string, string> = {
  COD: "Call of Duty",
  WOW: "World of Warcraft",
  DIABLO4: "Diablo IV",
  OVERWATCH2: "Overwatch 2",
  CANDYCRUSH: "Candy Crush Saga",
};

export interface RedditTheme {
  theme: string;
  sentiment: "NEGATIVE" | "MIXED" | "POSITIVE";
  intensity: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  subreddits: string[];
  marketing_implication: string;
}

export async function POST(request: NextRequest) {
  let franchise = "COD";
  try {
    const body = await request.json().catch(() => ({}));
    franchise = String(body.franchise || "COD").toUpperCase();
    const topic: string | undefined = body.topic;
    const offerTitle: string | undefined = body.offer_title;
    const offerPrice: number | undefined =
      typeof body.price === "number" ? body.price : undefined;

    const subreddits = SUBREDDITS_BY_FRANCHISE[franchise] || SUBREDDITS_BY_FRANCHISE.COD;
    const liveContext = LIVE_CONTEXT_BY_FRANCHISE[franchise] || LIVE_CONTEXT_BY_FRANCHISE.COD;
    const label = FRANCHISE_LABEL[franchise] || franchise;

    const focus = topic
      ? `Focus specifically on: "${topic}".`
      : "Focus on monetization, pricing, and value-for-money sentiment.";

    const offerContext =
      offerTitle && offerPrice !== undefined
        ? `A marketing team is considering an offer titled "${offerTitle}" priced at $${offerPrice.toFixed(
            2
          )}. Pay attention to any discussion that would predict how players react to an offer like that.`
        : "";

    // Pass 1: grounded retrieval. Prose, because the search tool is not
    // combined with a JSON response mime type.
    const retrievalPrompt = `Search Reddit for what ${label} players are currently saying about ${liveContext}.

Look across ${subreddits.join(", ")}.

${focus}
${offerContext}

Report what you actually found in the search results. For each distinct theme of
player sentiment, state which subreddit it came from and summarise the player
position in their own framing. Do not speculate beyond the sources. If you could
not find discussion of something, say so explicitly rather than guessing.`;

    const grounded = await generateGroundedContent(retrievalPrompt);

    // Pass 2: structure the grounded prose. No new facts may be introduced.
    const structuringPrompt = `Below is a research summary of real Reddit discussion about ${label}, produced from live search results.

--- BEGIN RESEARCH ---
${grounded.text}
--- END RESEARCH ---

Convert this into structured JSON. Use ONLY information present in the research
above. Do not invent themes, quotes, subreddits, upvote counts, or usernames. If
the research does not support a field, omit the theme entirely.

Return between 3 and 5 themes, ordered by how strongly players feel about them.

Output strict JSON:
{
  "headline": "one sentence describing the overall community mood",
  "overall_sentiment": "NEGATIVE" | "MIXED" | "POSITIVE",
  "themes": [
    {
      "theme": "short label, max 6 words",
      "sentiment": "NEGATIVE" | "MIXED" | "POSITIVE",
      "intensity": "LOW" | "MEDIUM" | "HIGH",
      "summary": "2-3 sentences on what players are saying, from the research only",
      "subreddits": ["r/example"],
      "marketing_implication": "one sentence: what this means for an offer targeted at these players"
    }
  ]
}`;

    const structuredRaw = await generateVertexContent(structuringPrompt, true);
    const parsed = parseModelJson<any>(structuredRaw);

    if (!parsed || !Array.isArray(parsed.themes) || parsed.themes.length === 0) {
      // Grounding succeeded but structuring did not. Return the grounded prose
      // rather than nothing — it is still real, sourced material.
      return NextResponse.json({
        grounded: true,
        degraded: true,
        degraded_reason: "Structuring pass failed; showing raw grounded research.",
        franchise,
        franchise_label: label,
        headline: null,
        overall_sentiment: null,
        themes: [],
        raw_research: grounded.text,
        citations: grounded.citations,
        search_queries: grounded.searchQueries,
        source: "google_search_grounding",
        model_used: grounded.modelUsed,
        retrieved_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      grounded: true,
      degraded: false,
      franchise,
      franchise_label: label,
      headline: parsed.headline || null,
      overall_sentiment: parsed.overall_sentiment || null,
      themes: parsed.themes as RedditTheme[],
      raw_research: grounded.text,
      citations: grounded.citations,
      search_queries: grounded.searchQueries,
      source: "google_search_grounding",
      model_used: grounded.modelUsed,
      retrieved_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Reddit Pulse] Grounding failed:", error?.message);
    return NextResponse.json(
      {
        grounded: false,
        error: "Live community grounding is unavailable.",
        error_kind: "SOCIAL_GROUNDING_UNAVAILABLE",
        details: error?.message || String(error),
        franchise,
      },
      { status: 503 }
    );
  }
}
