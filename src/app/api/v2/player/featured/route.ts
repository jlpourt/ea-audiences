/**
 * GET /api/v2/player/featured
 *
 * Picks the guided-storyline player: an active crew keystone (top-decile
 * crew_centrality) whose sessions fell more than 30% week over week.
 * Live Spanner only; 503 with details on failure.
 */
import { NextResponse } from "next/server";
import { getFeaturedPlayer, getPlayer360, Player360QueryError, spannerSource } from "@/lib/v2/player360";
import { liveCached, warmLive } from "@/lib/v2/live-cache";

const TTL_MS = 60 * 60 * 1000;
const db = () => process.env.SPANNER_DATABASE_ID || "default";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { value: data, cached } = await liveCached(`featured|${db()}`, TTL_MS, getFeaturedPlayer);
    // Start the featured player's 2-hop graph now so "See one player" lands on a warm
    // (or already in-flight) live query instead of starting it after this returns.
    warmLive(`player360|${db()}|${data.player_id}|2`, TTL_MS, () => getPlayer360(data.player_id, 2));
    return NextResponse.json({ ...data, cache: cached ? "hit" : "miss" }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("[api/v2/player/featured] Spanner failure", e);
    const isQuery = e instanceof Player360QueryError;
    return NextResponse.json(
      {
        error: "Spanner Graph query failed",
        message: e?.message ?? String(e),
        failed_query: isQuery ? e.label : null,
        gql: isQuery ? e.gql : null,
        source: spannerSource(),
      },
      { status: 503 },
    );
  }
}
