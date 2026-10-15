import { NextResponse } from "next/server";
import { errorPayload, getCreatorHubs, liveCached } from "@/lib/v2/creatorbrand";

/**
 * GET /api/v2/creator/hubs
 * Creators ranked by hub_score with live community reach + participation coefficient
 * from a Spanner Graph traversal. Optional: ?min_watch=5 · ?fresh=1 bypasses the 15-min live-result cache.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mw = Number.parseInt(url.searchParams.get("min_watch") || "5", 10);
  try {
    const opts = { minWatch: Number.isFinite(mw) ? Math.min(240, Math.max(0, mw)) : 5 };
    const data = await liveCached("creator-hubs", opts, () => getCreatorHubs(opts), url.searchParams.get("fresh") === "1");
    return NextResponse.json(data);
  } catch (e) {
    console.error("[v2/creator/hubs]", e);
    const { status, body } = errorPayload(e, "/api/v2/creator/hubs");
    return NextResponse.json(body, { status });
  }
}
