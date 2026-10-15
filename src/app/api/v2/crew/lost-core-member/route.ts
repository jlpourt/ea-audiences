import { NextRequest, NextResponse } from "next/server";
import { cachedLive, crewErrorBody, getLostCoreMembers } from "@/lib/v2/crew";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v2/crew/lost-core-member?days=7[&fresh=1]
 * Section C: ONE BigQuery statement that reads live Spanner via EXTERNAL_QUERY and joins
 * BigQuery session + bookings history. Missing connection / tables -> 503 with the exact
 * BigQuery error. Live results cached per process for 15 min; failures never cached.
 */
export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const daysRaw = Number(sp.get("days") || 7);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, Math.round(daysRaw))) : 7;
  const fresh = sp.get("fresh") === "1";
  const started = Date.now();
  try {
    const r = await cachedLive("crew-lost-core-member", { days }, fresh, () => getLostCoreMembers(days));
    return NextResponse.json({ ...r.value, cache: r.cache, computed_at: r.computed_at, served_ms: Date.now() - started });
  } catch (e) {
    const { status, body } = crewErrorBody(e, "GET /api/v2/crew/lost-core-member");
    return NextResponse.json(body, { status });
  }
}
