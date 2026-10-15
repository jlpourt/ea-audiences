import { NextRequest, NextResponse } from "next/server";
import { crewErrorBody, getCrewTimeline } from "@/lib/v2/crew";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v2/crew/[id]/timeline
 * Crew lineage (SPLIT_FROM, up to 3 levels each way) + weekly JOIN/LEAVE/KICK/SPLIT
 * counts from CrewMembershipEvents. Answers "crews are dynamic: they split and re-form".
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id || "").trim();
  if (!id || id.length > 128) {
    return NextResponse.json({ error: "Invalid crew id" }, { status: 400 });
  }
  try {
    const data = await getCrewTimeline(id);
    return NextResponse.json(data);
  } catch (e) {
    const { status, body } = crewErrorBody(e, "GET /api/v2/crew/[id]/timeline");
    return NextResponse.json(body, { status });
  }
}
