import { NextResponse } from "next/server";
import { errorPayload, getCreatorIncremental, liveCached } from "@/lib/v2/creatorbrand";

/**
 * GET /api/v2/creator/incremental
 * Day-30 incremental retained players per creator vs. matched non-viewers (BigQuery CEM)
 * plus an off-stream difference-in-differences check. Creator metadata from Spanner.
 * Optional: ?min_watch=20&k=3&min_treated=30 · ?fresh=1 bypasses the 15-min live-result cache.
 */
export const dynamic = "force-dynamic";

const clampInt = (v: string | null, def: number, lo: number, hi: number) => {
  const n = v === null ? def : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const opts = {
      minWatch: clampInt(url.searchParams.get("min_watch"), 20, 1, 240),
      k: clampInt(url.searchParams.get("k"), 3, 1, 10),
      minTreated: clampInt(url.searchParams.get("min_treated"), 30, 1, 10000),
    };
    const data = await liveCached(
      "creator-incremental",
      opts,
      () => getCreatorIncremental(opts),
      url.searchParams.get("fresh") === "1"
    );
    return NextResponse.json(data);
  } catch (e) {
    console.error("[v2/creator/incremental]", e);
    const { status, body } = errorPayload(e, "/api/v2/creator/incremental");
    return NextResponse.json(body, { status });
  }
}
