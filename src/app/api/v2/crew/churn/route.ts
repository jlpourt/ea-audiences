import { NextRequest, NextResponse } from "next/server";
import { crewErrorBody, getCrewChurn } from "@/lib/v2/crew";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v2/crew/churn?limit=25
 * Live churn exposure (Spanner GQL), anchor dependency (BigQuery diff-in-diff),
 * keystones (Spanner GQL), crew dynamics (Spanner), retention offer (Spanner).
 */
export async function GET(request: NextRequest) {
  const limitRaw = Number(new URL(request.url).searchParams.get("limit") || 25);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.round(limitRaw))) : 25;
  try {
    const data = await getCrewChurn(limit);
    return NextResponse.json(data);
  } catch (e) {
    const { status, body } = crewErrorBody(e, "GET /api/v2/crew/churn");
    return NextResponse.json(body, { status });
  }
}
