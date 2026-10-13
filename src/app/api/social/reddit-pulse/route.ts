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

    const prompt = `Search reddit.com discussions across r/NBA2K, r/MyTEAM, and r/WWEGames for community sentiment.
Focus on:
1. NBA 2K27 Season 1 VC pricing, Cap Breakers, attribute cost progression, and Season Pass Hall of Fame value.
2. MyTEAM Galaxy Opal and Dark Matter pack odds, pack prices, and player market reactions.
3. NBA 2K26 veterans upgrading to NBA 2K27, Rebirth build progression, and 2K Sports cross-franchise sentiment.

Summarize real community threads, key player arguments, and prevailing sentiment (BULLISH, MIXED, or BACKLASH).`;

    const grounded = await groundedSearch({
      prompt,
      system: "You are an intelligence researcher analyzing live gaming community sentiment across r/NBA2K, r/MyTEAM, and r/WWEGames.",
    });

    const structuringPrompt = `You are converting live Reddit search research into structured social sentiment items.
Here is the research retrieved from live search over r/NBA2K, r/MyTEAM, and r/WWEGames:

--- RESEARCH START ---
${grounded.text}
--- RESEARCH END ---

Here are the real citation URLs found:
${JSON.stringify(grounded.citations, null, 2)}

Extract 4 to 6 discrete sentiment items covering r/NBA2K, r/MyTEAM, and r/WWEGames.
For each item, determine:
- subreddit: "r/NBA2K", "r/MyTEAM", or "r/WWEGames"
- title: concise discussion thread title or topic
- url: match one of the citation URLs above if relevant, or use the subreddit URL
- sentiment: "BULLISH" | "MIXED" | "BACKLASH"
- score: estimated upvote score / engagement intensity (e.g. 450 to 3800)
- snippet: authentic 1-2 sentence quote or summary in community lexicon (VC, badges, pack odds, etc.)

Output strict JSON format:
{
  "items": [
    {
      "subreddit": "r/NBA2K",
      "title": "...",
      "url": "...",
      "sentiment": "BACKLASH",
      "score": 1420,
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
