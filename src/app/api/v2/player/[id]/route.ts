/**
 * GET /api/v2/player/[id]?hops=1|2
 *
 * Player 360 + social graph for one player, live from Spanner Graph
 * (`TakeTwoPlayerGraph` in the database named by SPANNER_DATABASE_ID).
 * Zero fallbacks: Spanner errors return 503 with the failing query.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getPlayer360,
  Player360QueryError,
  PlayerNotFoundError,
  spannerSource,
} from "@/lib/v2/player360";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id ?? "");
  if (id === "featured") {
    // Static segment wins in Next, but guard anyway.
    return NextResponse.json({ error: "Use /api/v2/player/featured" }, { status: 400 });
  }
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
  }
  const hopsParam = req.nextUrl.searchParams.get("hops");
  const hops: 1 | 2 = hopsParam === "1" ? 1 : 2;

  try {
    const data = await getPlayer360(id, hops);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof PlayerNotFoundError) {
      return NextResponse.json({ error: e.message, source: spannerSource() }, { status: 404 });
    }
    console.error("[api/v2/player] Spanner failure", e);
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
