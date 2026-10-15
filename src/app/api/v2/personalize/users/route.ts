/**
 * GET /api/v2/personalize/users            -> picker list + NBA / WNBA / College presets
 * GET /api/v2/personalize/users?surprise=1 -> one random real player ("Surprise me")
 *
 * Live Spanner only. v2 ranks leanings by the concept affinity columns; v1 uses
 * archetype + telemetry signals and says so in `lean_basis` / preset `basis`.
 */
import { NextRequest, NextResponse } from "next/server";
import { GCP_CONFIG } from "@/lib/config";
import type { PersonalizeUsersResponse } from "@/lib/v2/concept";
import { PersonalizeError, listPickerUsers, randomUser } from "../engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    if (request.nextUrl.searchParams.get("surprise")) {
      const user = await randomUser(`s-${Date.now()}-${Math.random()}`);
      return NextResponse.json({ user, database: GCP_CONFIG.spannerDatabaseId, latency_ms: Date.now() - started });
    }
    const { presets, users, lean_basis, caps } = await listPickerUsers();
    const body: PersonalizeUsersResponse = {
      presets,
      users,
      database: caps.database,
      lean_basis,
      affinity_columns: [
        ...(caps.affinity.wnba ? ["wnba_affinity"] : []),
        ...(caps.affinity.college ? ["college_hoops_affinity"] : []),
        ...(caps.affinity.franchise ? ["franchise_mode_affinity"] : []),
      ],
      latency_ms: Date.now() - started,
    };
    return NextResponse.json(body);
  } catch (err) {
    const e = err instanceof PersonalizeError ? err : null;
    console.error("[personalize/users] failed:", err);
    return NextResponse.json(
      {
        error: "Failed to load picker users from the 2K identity graph",
        service: e?.service ?? "cloud-spanner",
        stage: e?.stage ?? "picker",
        instance: GCP_CONFIG.spannerInstanceId,
        database: GCP_CONFIG.spannerDatabaseId,
        details: err instanceof Error ? err.message : String(err),
      },
      { status: e?.status ?? 503 }
    );
  }
}
