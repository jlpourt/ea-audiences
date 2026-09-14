import { NextResponse } from "next/server";
import { checkSpannerHealth } from "@/lib/gcp/spanner-client";

/**
 * Connectivity probe for the live graph.
 *
 * The UI polls this so the status pill reflects reality rather than a local
 * toggle the presenter set. Previously the "Live Spanner" indicator was purely
 * a client-side preference — it stayed green whether or not the database was
 * reachable, which is precisely backwards for a trust signal.
 *
 * Returns 200 when reachable and 503 when not, so callers can branch on status
 * alone without parsing the body.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkSpannerHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
