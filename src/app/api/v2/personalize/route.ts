/**
 * POST /api/v2/personalize (SSE) · Section D Personalization Flow (contract §7).
 *
 * Body: { player_id: string }
 * Events (PersonalizeEvent): status, user, preference, twins, content_pairs
 * (scored:false, then scored:true with the winner), activation, done, error.
 *
 * Zero fallbacks: the user lookup runs before the stream opens so a Spanner
 * failure is a real HTTP 503/404; later failures emit an `error` event naming
 * the service and stage, then close.
 */
import { NextRequest, NextResponse } from "next/server";
import { GCP_CONFIG } from "@/lib/config";
import { MODELS } from "@/lib/models";
import { PREFERENCE_IDS, type PersonalizeEvent } from "@/lib/v2/concept";
import {
  PersonalizeError,
  fetchUser,
  fetchSignals,
  inferPreference,
  fetchTwins,
  twinSummary,
  pickContentPairs,
  scorePairsWithTwins,
  buildActivations,
  fetchAdsAudience,
} from "./engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body = await request.json().catch(() => ({}));
  const playerId = typeof body?.player_id === "string" ? body.player_id.trim().slice(0, 64) : "";
  if (!playerId) {
    return NextResponse.json({ error: "player_id is required" }, { status: 400 });
  }

  let user: Awaited<ReturnType<typeof fetchUser>>;
  try {
    user = await fetchUser(playerId);
  } catch (err) {
    const e = err instanceof PersonalizeError ? err : null;
    console.error("[personalize] user lookup failed:", err);
    return NextResponse.json(
      {
        error: "Failed to load player from the 2K identity graph",
        service: e?.service ?? "cloud-spanner",
        stage: e?.stage ?? "user",
        project: GCP_CONFIG.projectId,
        instance: GCP_CONFIG.spannerInstanceId,
        database: GCP_CONFIG.spannerDatabaseId,
        details: err instanceof Error ? err.message : String(err),
      },
      { status: e?.status ?? 503 }
    );
  }

  const signal = request.signal;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (evt: PersonalizeEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const phases: Record<string, number> = {};
      let stage = "user";
      let fast: string = MODELS.FAST.id;
      try {
        // 1 · user + graph signals; twins lookup starts in parallel.
        const t0 = Date.now();
        const twinsPromise = fetchTwins(user);
        const signals = await fetchSignals(user);
        phases.user_ms = Date.now() - started;
        send({ type: "user", user, signals, database: GCP_CONFIG.spannerDatabaseId, latency_ms: Date.now() - t0 });

        // 2 · preference
        stage = "preference";
        send({ type: "status", stage: "preference", message: "Inferring preference from graph signals" });
        const preference = await inferPreference(user, signals, signal);
        fast = preference.model;
        phases.preference_ms = preference.latency_ms;
        send({ type: "preference", preference });

        // Ads audiences for the YouTube / Google Ads closer are prefetched per preference
        // while pairs are written; the winner's preference picks which one is used.
        const audiencePromises = Object.fromEntries(
          PREFERENCE_IDS.map((p) => {
            const pr = fetchAdsAudience(user, p);
            pr.catch(() => undefined); // surfaced when awaited below
            return [p, pr];
          })
        ) as Record<(typeof PREFERENCE_IDS)[number], ReturnType<typeof fetchAdsAudience>>;

        // 3 · content pairs (copy) then synthetic-twin scores
        stage = "pairs";
        send({ type: "status", stage: "pairs", message: "Picking content pairs from the library" });
        const tw0 = Date.now();
        const twins = await twinsPromise;
        send({ type: "twins", twins: twinSummary(twins), latency_ms: Date.now() - tw0 });
        const picked = await pickContentPairs(user, preference, signal);
        phases.pairs_copy_ms = picked.latencyMs;
        send({ type: "content_pairs", scored: false, pairs: picked.pairs, latency_ms: picked.latencyMs, model: picked.model });

        send({ type: "status", stage: "pairs", message: `Scoring with ${twins.length} synthetic twins` });
        const scored = await scorePairsWithTwins(picked.pairs, twins, signal);
        phases.twin_scoring_ms = scored.latencyMs;
        send({ type: "content_pairs", scored: true, pairs: scored.pairs, latency_ms: scored.latencyMs, model: scored.model });

        // 4 · channel activations for the winner
        stage = "serve";
        send({ type: "status", stage: "serve", message: "Adapting the winner for each channel" });
        const winner = scored.pairs.find((p) => p.winner)!;
        const audience = await audiencePromises[winner.preference];
        const act = await buildActivations(user, winner, audience, signal);
        phases.activation_ms = act.latencyMs;
        send({ type: "activation", channels: act.channels, latency_ms: act.latencyMs, model: act.model });

        send({ type: "done", ok: true, latency_ms: Date.now() - started, phases, models: { fast } });
      } catch (err) {
        const e = err instanceof PersonalizeError ? err : null;
        console.error(`[personalize] ${stage} failed:`, err);
        send({
          type: "error",
          service: e?.service ?? "vertex-ai",
          stage: e?.stage ?? stage,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* client disconnected */
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
