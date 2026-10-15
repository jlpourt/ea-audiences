import { NextResponse } from "next/server";
import { errorPayload, getCreatorHubs } from "@/lib/v2/creatorbrand";

/**
 * GET /api/v2/creator/hubs
 * Creators ranked by hub_score with live community reach + participation coefficient
 * from a Spanner Graph traversal. Optional: ?min_watch=5
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mw = Number.parseInt(url.searchParams.get("min_watch") || "5", 10);
  try {
    const data = await getCreatorHubs({ minWatch: Number.isFinite(mw) ? Math.min(240, Math.max(0, mw)) : 5 });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[v2/creator/hubs]", e);
    const { status, body } = errorPayload(e, "/api/v2/creator/hubs");
    return NextResponse.json(body, { status });
  }
}
