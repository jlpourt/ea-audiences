/**
 * GET /api/v2/actions/for-player?id=t2-usr-00523
 *
 * "Act on players like this": which live play audiences does this player
 * actually belong to? Checks membership in every play segment (the same
 * Spanner audiences the Act drawer uses, cached in-process) and returns the
 * matches in story priority, each with the player's own signal value.
 * An empty list is a real answer: the player is in none of today's plays.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAudience, PlayQueryError } from "@/lib/v2/plays-server";
import { PLAYS, PLAY_ORDER, type PlayId } from "@/lib/v2/plays";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Story priority: the most specific, most actionable fit first. */
const PRIORITY: { play: PlayId; segment: string }[] = [
  { play: "save_elsewhere", segment: "fading_2k" },
  { play: "gta6_window", segment: "shield" },
  { play: "gta6_window", segment: "halo" },
  { play: "gta6_window", segment: "day_one" },
  ...PLAYS.warm_intro.segments.map((s) => ({ play: "warm_intro" as PlayId, segment: s.id })),
];

export interface ForPlayerMatch {
  play: PlayId;
  segment: string;
  label: string;
  audience_count: number;
  signal: number | null;
  signal_label: string | null;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const t0 = Date.now();
  try {
    const checks = await Promise.all(
      PRIORITY.filter((p) => PLAY_ORDER.includes(p.play)).map(async ({ play, segment }) => {
        const { members, response } = await getAudience(play, segment);
        const m = members.find((x) => x.player_id === id);
        if (!m) return null;
        const seg = PLAYS[play].segments.find((s) => s.id === segment)!;
        return {
          play,
          segment,
          label: `${PLAYS[play].name} · ${seg.label}`,
          audience_count: response.count,
          signal: m.signal,
          signal_label: response.stats.signal_label,
        } satisfies ForPlayerMatch;
      }),
    );
    const matches = checks.filter(Boolean) as ForPlayerMatch[];
    return NextResponse.json({ player_id: id, matches, latency_ms: Date.now() - t0 });
  } catch (e) {
    console.error("[api/v2/actions/for-player]", e);
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
