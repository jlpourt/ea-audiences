/**
 * POST /api/v2/concept-test (SSE)
 *
 * Section D · 3-arm concept test: NBA (MyNBA / MyCAREER core) vs. WNBA (The W
 * franchise mode featuring Caitlin Clark) vs. College basketball mode.
 *
 * Body: { swarm_size?: 20 | 100 | 1000, seed?: string }
 * Events: status, cohort, persona_verdict, creator_stances, arm_aggregate,
 *         social_shift, synthesis, done, error  (see ConceptStreamEvent).
 *
 * Zero fallbacks: Spanner hydration failure returns HTTP 503 before the stream
 * opens; any Vertex AI failure mid-stream emits an `error` event naming the
 * service and phase, then closes.
 */
import { NextRequest, NextResponse } from "next/server";
import { MODELS } from "@/lib/models";
import { GCP_CONFIG } from "@/lib/config";
import {
  CONCEPT_SCALES,
  computeArmAggregates,
  type ConceptScale,
  type ConceptStreamEvent,
  type ConceptVerdict,
  type ConceptShift,
  type ConceptCreatorStance,
} from "@/lib/v2/concept";
import {
  ConceptEngineError,
  hydrateConceptCohort,
  evaluateCorePersona,
  evaluateCrowdBatch,
  fetchCohortCreators,
  generateCreatorStances,
  buildCrewPulse,
  socialRoundCore,
  socialRoundCrowdBatch,
  synthesizeConcept,
  mapWithConcurrency,
} from "./engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const CROWD_BATCH = 25;
const SOCIAL_BATCH = 50;
const LITE_CONCURRENCY = 8;

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body = await request.json().catch(() => ({}));
  const rawScale = Number(body?.swarm_size);
  const scale: ConceptScale = (CONCEPT_SCALES as readonly number[]).includes(rawScale)
    ? (rawScale as ConceptScale)
    : 20;
  const seed =
    typeof body?.seed === "string" && body.seed.trim() ? body.seed.trim().slice(0, 64) : `ct-${Date.now()}`;

  // Phase 0: hydrate the live cohort BEFORE opening the stream so a Spanner
  // failure is a real HTTP 503 with diagnostics.
  let hydrated: Awaited<ReturnType<typeof hydrateConceptCohort>>;
  try {
    hydrated = await hydrateConceptCohort(scale, seed);
  } catch (err) {
    const e = err instanceof ConceptEngineError ? err : null;
    console.error("[concept-test] hydration failed:", err);
    return NextResponse.json(
      {
        error: "Failed to hydrate concept-test personas from the 2K identity graph",
        service: e?.service ?? "cloud-spanner",
        project: GCP_CONFIG.projectId,
        instance: GCP_CONFIG.spannerInstanceId,
        database: GCP_CONFIG.spannerDatabaseId,
        phase: e?.phase ?? "cohort hydration",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }

  const { personas, summary } = hydrated;
  const signal = request.signal;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (evt: ConceptStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const phases: Record<string, number> = { hydrate_ms: summary.latency_ms };
      const models = { fast: MODELS.FAST.id, lite: MODELS.LITE.id, synthesis: MODELS.REASONING.id };
      let phase = "round1";

      try {
        send({
          type: "cohort",
          cohort: summary,
          personas: personas.map((p) => ({
            player_id: p.player_id,
            gamer_tag: p.gamer_tag,
            archetype: p.archetype,
            tier: p.tier,
          })),
        });

        // Phase 1: round-1 reactions. Core (FAST, individual) and crowd (LITE
        // batches) run concurrently and stream as they land.
        send({ type: "status", phase: "round1", message: `Reactions · ${summary.core} core + ${summary.crowd} crowd` });
        const coreP = personas.filter((p) => p.tier === "core");
        const crowdP = personas.filter((p) => p.tier === "crowd");
        const coreVerdicts: ConceptVerdict[] = new Array(coreP.length);
        const crowdVerdicts: ConceptVerdict[] = [];
        const r1Start = Date.now();

        const corePromise = Promise.all(
          coreP.map(async (p, i) => {
            const v = await evaluateCorePersona(p, i, signal);
            coreVerdicts[i] = v;
            models.fast = v.model || models.fast;
            send({ type: "persona_verdict", round: 1, verdicts: [v], latency_ms: v.latency_ms ?? 0, model: v.model ?? models.fast });
          })
        ).then(() => {
          phases.core_ms = Date.now() - r1Start;
        });

        const crowdBatches: (typeof crowdP)[] = [];
        for (let i = 0; i < crowdP.length; i += CROWD_BATCH) crowdBatches.push(crowdP.slice(i, i + CROWD_BATCH));
        const crowdPromise = mapWithConcurrency(crowdBatches, LITE_CONCURRENCY, async (batch, bi) => {
          const out = await evaluateCrowdBatch(batch, bi, signal);
          crowdVerdicts.push(...out.verdicts);
          models.lite = out.model;
          send({ type: "persona_verdict", round: 1, verdicts: out.verdicts, batch_index: bi, latency_ms: out.latencyMs, model: out.model });
        }).then(() => {
          phases.crowd_ms = Date.now() - r1Start;
        });

        // Creator stances only need the core pulse; start them once core lands.
        const creatorsPromise = corePromise.then(async () => {
          phase = "creator_stances";
          const creators = await fetchCohortCreators(personas.map((p) => p.player_id));
          const out = await generateCreatorStances(creators, coreVerdicts, signal);
          phases.creators_ms = out.latencyMs;
          send({ type: "creator_stances", creators: out.stances, latency_ms: out.latencyMs, model: out.model });
          return out.stances;
        });

        const [, , stances] = (await Promise.all([corePromise, crowdPromise, creatorsPromise])) as [
          void,
          void,
          ConceptCreatorStance[],
        ];
        phases.round1_ms = Date.now() - r1Start;

        let all: ConceptVerdict[] = [...coreVerdicts, ...crowdVerdicts];
        const round1Agg = computeArmAggregates(all, false);
        send({ type: "arm_aggregate", round: 1, aggregates: round1Agg, n: all.length });

        // Phase 2: social round (Crew pulse + Creator stances).
        phase = "social";
        send({ type: "status", phase: "social", message: "Social shift · Crew + Creator" });
        const socialStart = Date.now();
        const pulse = buildCrewPulse(all, personas);
        const allShifts: ConceptShift[] = [];

        const coreSocial = socialRoundCore(coreVerdicts, personas, pulse, stances, signal).then((out) => {
          allShifts.push(...out.shifts);
          send({ type: "social_shift", shifts: out.shifts, evaluated: out.updated.length, latency_ms: out.latencyMs, model: out.model });
          return out.updated;
        });
        const socialBatches: ConceptVerdict[][] = [];
        for (let i = 0; i < crowdVerdicts.length; i += SOCIAL_BATCH) socialBatches.push(crowdVerdicts.slice(i, i + SOCIAL_BATCH));
        const crowdSocial = mapWithConcurrency(socialBatches, LITE_CONCURRENCY, async (batch, bi) => {
          const out = await socialRoundCrowdBatch(batch, bi, pulse, stances, signal);
          allShifts.push(...out.shifts);
          send({ type: "social_shift", shifts: out.shifts, evaluated: out.updated.length, batch_index: bi, latency_ms: out.latencyMs, model: out.model });
          return out.updated;
        });
        const [coreFinal, crowdFinalBatches] = await Promise.all([coreSocial, crowdSocial]);
        all = [...coreFinal, ...crowdFinalBatches.flat()];
        phases.social_ms = Date.now() - socialStart;

        const finalAgg = computeArmAggregates(all, true);
        send({ type: "arm_aggregate", round: 2, aggregates: finalAgg, n: all.length });

        // Phase 3: synthesis.
        phase = "synthesis";
        send({ type: "status", phase: "synthesis", message: "Verdict · Gemini synthesis" });
        const synthesis = await synthesizeConcept(round1Agg, finalAgg, all, stances, allShifts.length, summary, signal);
        phases.synthesis_ms = synthesis.latency_ms;
        models.synthesis = synthesis.model;
        send({ type: "synthesis", synthesis });

        send({
          type: "done",
          ok: true,
          latency_ms: Date.now() - started,
          phases,
          models,
          n: all.length,
          shifts: allShifts.length,
        });
      } catch (err) {
        const e = err instanceof ConceptEngineError ? err : null;
        console.error(`[concept-test] ${phase} failed:`, err);
        send({
          type: "error",
          service: e?.service ?? "vertex-ai",
          phase: e?.phase ?? phase,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by client disconnect */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
