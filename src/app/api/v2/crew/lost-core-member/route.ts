import { NextRequest, NextResponse } from "next/server";
import { crewErrorBody, getLostCoreMembers } from "@/lib/v2/crew";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v2/crew/lost-core-member?days=7
 * Section C: ONE BigQuery statement that reads live Spanner membership via
 * EXTERNAL_QUERY and joins BigQuery session + bookings history.
 * Missing connection / tables -> 503 with the exact BigQuery error.
 */
export async function GET(request: NextRequest) {
  const daysRaw = Number(new URL(request.url).searchParams.get("days") || 7);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, Math.round(daysRaw))) : 7;
  try {
    const data = await getLostCoreMembers(days);
    return NextResponse.json(data);
  } catch (e) {
    const { status, body } = crewErrorBody(e, "GET /api/v2/crew/lost-core-member");
    return NextResponse.json(body, { status });
  }
}
