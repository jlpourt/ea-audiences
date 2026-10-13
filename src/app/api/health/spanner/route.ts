import { NextResponse } from "next/server";
import { checkSpannerHealth, runRawGql } from "@/lib/gcp/spanner-client";
import { GCP_CONFIG } from "@/lib/config";

/**
 * Connectivity probe for the live Take-Two identity graph.
 *
 * The UI polls this so the "LIVE" pill reflects reality rather than a local
 * toggle the presenter set. Returns 200 when reachable and 503 when not, so
 * callers can branch on status alone without parsing the body.
 *
 * Two measurements: a 1-row `SELECT 1` for raw round-trip latency, and the
 * graph-aware `checkSpannerHealth()` for the player count (so the pill can
 * show "2,874 players · 38 ms").
 */
export const dynamic = "force-dynamic";

const GRAPH_NAME = process.env.SPANNER_GRAPH_NAME || "TakeTwoPlayerGraph";

export async function GET() {
  const probeStarted = Date.now();
  let probeOk = false;
  let probeError: string | undefined;
  try {
    const rows = await runRawGql("SELECT 1 AS ok");
    probeOk = rows.length === 1;
  } catch (e) {
    probeError = e instanceof Error ? e.message : String(e);
  }
  const probeLatencyMs = Date.now() - probeStarted;

  const graph = await checkSpannerHealth();
  const ok = probeOk && graph.ok;

  return NextResponse.json(
    {
      ok,
      service: "Cloud Spanner Graph",
      project: GCP_CONFIG.projectId,
      instance: GCP_CONFIG.spannerInstanceId,
      database: GCP_CONFIG.spannerDatabaseId,
      graph: GRAPH_NAME,
      probe: { ok: probeOk, latencyMs: probeLatencyMs, error: probeError },
      playerCount: graph.playerCount,
      graphLatencyMs: graph.latencyMs,
      error: ok ? undefined : graph.error || probeError || "unreachable",
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
