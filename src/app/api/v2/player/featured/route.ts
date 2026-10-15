/**
 * GET /api/v2/player/featured
 *
 * Picks the guided-storyline player: an active crew keystone (top-decile
 * crew_centrality) whose sessions fell more than 30% week over week.
 * Live Spanner only; 503 with details on failure.
 */
import { NextResponse } from "next/server";
import { getFeaturedPlayer, Player360QueryError, spannerSource } from "@/lib/v2/player360";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getFeaturedPlayer();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
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
