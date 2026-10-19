/**
 * GET /api/v2/actions/audience?play=warm_intro&segment=zynga-gtao[&fresh=1]
 *
 * Live Spanner Graph audience for a cross-franchise play: size, sample
 * players, mix and the exact GQL run. 503 with the GQL on failure.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAudience, PlayQueryError } from "@/lib/v2/plays-server";
import { PLAYS, type PlayId } from "@/lib/v2/plays";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const play = req.nextUrl.searchParams.get("play") as PlayId | null;
  const segment = req.nextUrl.searchParams.get("segment") ?? (play && PLAYS[play] ? PLAYS[play].segments[0].id : "");
  if (!play || !PLAYS[play]) return NextResponse.json({ error: `Unknown play '${play}'` }, { status: 400 });
  if (!PLAYS[play].segments.some((s) => s.id === segment)) return NextResponse.json({ error: `Unknown segment '${segment}' for ${play}` }, { status: 400 });
  try {
    const { response } = await getAudience(play, segment, req.nextUrl.searchParams.get("fresh") === "1");
    return NextResponse.json(response);
  } catch (e) {
    console.error("[api/v2/actions/audience]", e);
    return NextResponse.json(
      {
        error: "Spanner Graph audience query failed",
        service: "spanner",
        resource: `projects/${GCP_CONFIG.projectId}/instances/${GCP_CONFIG.spannerInstanceId}/databases/${GCP_CONFIG.spannerDatabaseId}`,
        message: (e as Error).message,
        gql: e instanceof PlayQueryError ? e.gql : null,
      },
      { status: 503 },
    );
  }
}
