import { NextRequest, NextResponse } from "next/server";
import { cachedLive, crewErrorBody, getCrewChurn } from "@/lib/v2/crew";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v2/crew/churn?limit=25[&fresh=1]
 * Live churn exposure + hazard (Spanner), anchor dependency (BigQuery), keystones (Spanner GQL),
 * crew dynamics (Spanner), retention offer (Spanner). Live results are cached per process for
 * 15 min (`cache`, `computed_at`); failures are never cached; `fresh=1` recomputes.
 */
export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const limitRaw = Number(sp.get("limit") || 25);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.round(limitRaw))) : 25;
  const fresh = sp.get("fresh") === "1";
  const started = Date.now();
  try {
    const r = await cachedLive("crew-churn", { limit }, fresh, () => getCrewChurn(limit));
    return NextResponse.json({ ...r.value, cache: r.cache, computed_at: r.computed_at, served_ms: Date.now() - started });
  } catch (e) {
    const { status, body } = crewErrorBody(e, "GET /api/v2/crew/churn");
    return NextResponse.json(body, { status });
  }
}
