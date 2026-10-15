import { NextResponse } from "next/server";
import { errorPayload, getBrandAttach } from "@/lib/v2/creatorbrand";

/**
 * GET /api/v2/brand/attach
 * Branded VC revenue, attach rate, in-crew vs out-of-crew attach, and co-play social
 * multiplier per 2K brand partner (BigQuery). Optional ?player_id= adds a Spanner Graph
 * "players like you bought" list from that player's PLAYED_WITH neighbors.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const playerId = url.searchParams.get("player_id");
  try {
    const data = await getBrandAttach({ playerId: playerId && playerId.length <= 64 ? playerId : null });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[v2/brand/attach]", e);
    const { status, body } = errorPayload(e, "/api/v2/brand/attach");
    return NextResponse.json(body, { status });
  }
}
