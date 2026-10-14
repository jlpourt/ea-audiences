import { NextRequest, NextResponse } from "next/server";
import { groundedSearch, generateText, parseModelJson } from "@/lib/gcp/genai-client";

export const dynamic = "force-dynamic";

interface RedditPulseItem {
  subreddit: string;
  title: string;
  url: string;
  sentiment: "BULLISH" | "MIXED" | "BACKLASH";
  score: number;
  snippet: string;
  flair?: string;
  comment_count?: number;
}

interface RedditPulseResponse {
  items: RedditPulseItem[];
  model_used: string;
  citations: Array<{ title: string; uri: string; domain: string }>;
  generated_at: string;
  cached?: boolean;
}

// 10-minute in-memory cache
interface CacheEntry {
  expiresAt: number;
  data: RedditPulseResponse;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const topic = body.topic || "NBA 2K27 Season 1 VC pricing, MyTEAM Galaxy Opal pack odds, NBA 2K26 to 2K27 upgrade sentiment";
    const cacheKey = typeof topic === "string" ? topic.slice(0, 80).toLowerCase() : "default";

    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
      });
    }

    const prompt = `Search reddit.com discussions across r/NBA2K (multiple distinct threads), r/MyTEAM, r/NBA2kTeamUp, r/WWEGames, r/pga2k, and r/Borderlands for community sentiment around "${topic}".
Focus on:
1. r/NBA2K (pull at least 4 distinct thread topics):
   - MyPLAYER VC build costs, the 60-to-85 OVR Build Cliff (~190K VC), and Rebirth build tax.
   - Cap Breakers, badge regression/progression, green window patches, and Pro-Tuned builds.
   - Random Rec matchmaking vs 5-stack Crew squads, Purple Plate lobbies, and Park Rep rewards.
   - Season Pass Pro/Hall of Fame value and NBA 2K26 veterans upgrading to NBA 2K27.
2. r/MyTEAM: Galaxy Opal & Dark Matter pack odds, 20-Box VC pricing, and Auction House / Player Market liquidity.
3. r/NBA2kTeamUp: 5-stack Rec/Pro-Am Crew LFG recruiting, Crew Rep multipliers, and OVR gatekeeping (85+ OVR requirement).
4. r/WWEGames, r/pga2k, and r/Borderlands: Take-Two / 2K cross-franchise community sentiment (WWE 2K26 MyFACTION / Universe, PGA TOUR 2K Clubhouse Pass, Borderlands 4 loot/endgame).

Summarize real community threads, key player arguments, and prevailing sentiment (BULLISH, MIXED, or BACKLASH).`;

    const grounded = await groundedSearch({
      prompt,
      system:
        "You are an intelligence researcher analyzing live gaming community sentiment across r/NBA2K, r/MyTEAM, r/NBA2kTeamUp, r/WWEGames, r/pga2k, and r/Borderlands.",
    });

    const structuringPrompt = `You are converting live Reddit search research into structured social sentiment items.
Here is the research retrieved from live search over r/NBA2K, r/MyTEAM, r/NBA2kTeamUp, r/WWEGames, r/pga2k, and r/Borderlands:

--- RESEARCH START ---
${grounded.text}
--- RESEARCH END ---

Here are the real citation URLs found:
${JSON.stringify(grounded.citations, null, 2)}

Extract 8 to 10 discrete sentiment items covering:
- 4 distinct threads from "r/NBA2K" (covering VC/Build Cliff, Cap Breakers/Badges, Random Rec vs 5-Stack Crew, and Rebirth/Season Pass)
- 1 to 2 threads from "r/MyTEAM"
- 1 thread from "r/NBA2kTeamUp"
- 2 threads across "r/WWEGames", "r/pga2k", or "r/Borderlands"

For each item, determine:
- subreddit: "r/NBA2K" | "r/MyTEAM" | "r/NBA2kTeamUp" | "r/WWEGames" | "r/pga2k" | "r/Borderlands"
- title: concise, authentic Reddit discussion thread title
- url: match one of the citation URLs above if relevant, or use the subreddit URL
- sentiment: "BULLISH" | "MIXED" | "BACKLASH"
- score: estimated upvote score / engagement intensity (e.g. 240 to 4200)
- comment_count: estimated comment count (e.g. 65 to 940)
- flair: short subreddit flair (e.g. "MyCAREER / Builds", "Rec / Park", "MyTEAM Packs", "LFG / 5-Stack", "MyFACTION", "Clubhouse")
- snippet: authentic 1-2 sentence quote or summary in community lexicon (VC, badges, 85 OVR gate, Cap Breakers, pack odds, etc.)

Output strict JSON format:
{
  "items": [
    {
      "subreddit": "r/NBA2K",
      "title": "...",
      "url": "...",
      "sentiment": "BACKLASH",
      "score": 1420,
      "comment_count": 384,
      "flair": "MyCAREER / Builds",
      "snippet": "..."
    }
  ]
}`;

    const structured = await generateText({
      role: "LITE",
      prompt: structuringPrompt,
      json: true,
    });

    const parsed = parseModelJson<{ items?: RedditPulseItem[] }>(structured.text);
    const items = Array.isArray(parsed?.items) ? parsed!.items : [];

    const responseData: RedditPulseResponse = {
      items,
      model_used: `${grounded.modelUsed} + ${structured.modelUsed}`,
      citations: grounded.citations,
      generated_at: new Date().toISOString(),
    };

    cache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      data: responseData,
    });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("[Reddit Pulse Error]:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch live grounded Reddit pulse",
        details: error?.message || String(error),
      },
      { status: 503 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
