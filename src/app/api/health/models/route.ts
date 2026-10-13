import { NextResponse } from "next/server";
import { probeTextModel, type ModelProbe } from "@/lib/gcp/genai-client";
import { MODELS, type ModelRole } from "@/lib/models";

/**
 * Live probe of the three text tiers (REASONING / FAST / LITE).
 *
 * Runs in parallel with a 15s total budget so a stalled model cannot hang the
 * status surface. Each entry reports the exact id + location that answered,
 * which is what the model badges in the UI are promising.
 */
export const dynamic = "force-dynamic";

const TEXT_ROLES: ModelRole[] = ["REASONING", "FAST", "LITE"];
const TOTAL_BUDGET_MS = 15_000;
const PER_MODEL_BUDGET_MS = 12_000;

export async function GET() {
  const started = Date.now();

  const budget = new Promise<ModelProbe[]>((resolve) =>
    setTimeout(
      () =>
        resolve(
          TEXT_ROLES.map((role) => ({
            role,
            id: MODELS[role].id,
            location: MODELS[role].location,
            ok: false,
            latencyMs: TOTAL_BUDGET_MS,
            error: "health budget exceeded",
          }))
        ),
      TOTAL_BUDGET_MS
    )
  );

  const probes = Promise.all(TEXT_ROLES.map((role) => probeTextModel(role, PER_MODEL_BUDGET_MS)));
  const models = await Promise.race([probes, budget]);
  const ok = models.every((m) => m.ok);

  return NextResponse.json(
    {
      ok,
      service: "2K Intelligence Models",
      models,
      registry: Object.fromEntries(
        (Object.keys(MODELS) as ModelRole[]).map((role) => [
          role,
          { id: MODELS[role].id, location: MODELS[role].location },
        ])
      ),
      totalLatencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
