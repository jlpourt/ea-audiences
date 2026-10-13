import { NextRequest, NextResponse } from "next/server";
import { checkSpannerHealth } from "@/lib/gcp/spanner-client";
import { queryBigQuery } from "@/lib/gcp/bigquery-client";
import { checkMediaBucket } from "@/lib/gcp/storage-client";
import { checkActivationTopic } from "@/lib/gcp/pubsub-client";
import { generateText } from "@/lib/gcp/genai-client";
import { MODELS } from "@/lib/models";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const deep = req.nextUrl.searchParams.get("deep") === "1";

  try {
    const bqStart = Date.now();
    const [spannerStatus, bqRows, storageStatus, pubsubStatus] = await Promise.all([
      checkSpannerHealth(),
      queryBigQuery<{ total: number }>(
        `SELECT COUNT(*) AS total FROM \`${GCP_CONFIG.projectId}.${GCP_CONFIG.bqDatasetId}.saved_audiences\``
      ),
      checkMediaBucket(),
      checkActivationTopic(),
    ]);
    const bqLatencyMs = Date.now() - bqStart;

    let modelProbes: Record<string, { ok: boolean; latencyMs: number; modelUsed?: string }> | undefined;
    if (deep) {
      const fastStart = Date.now();
      const liteStart = Date.now();
      const [fastRes, liteRes] = await Promise.all([
        generateText({
          role: "FAST",
          prompt: "Reply OK",
          temperature: 0,
          maxOutputTokens: 8,
        }),
        generateText({
          role: "LITE",
          prompt: "Reply OK",
          temperature: 0,
          maxOutputTokens: 8,
        }),
      ]);
      modelProbes = {
        [MODELS.FAST.id]: {
          ok: Boolean(fastRes.text),
          latencyMs: Date.now() - fastStart,
          modelUsed: fastRes.modelUsed,
        },
        [MODELS.LITE.id]: {
          ok: Boolean(liteRes.text),
          latencyMs: Date.now() - liteStart,
          modelUsed: liteRes.modelUsed,
        },
      };
    }

    const savedAudiencesCount = Number(bqRows[0]?.total ?? 0);
    const playerCount = spannerStatus.playerCount ?? 0;
    const allHealthy =
      spannerStatus.ok &&
      playerCount > 0 &&
      storageStatus.ok &&
      pubsubStatus.ok &&
      (!modelProbes || Object.values(modelProbes).every((m) => m.ok));

    return NextResponse.json(
      {
        status: allHealthy ? "ok" : "degraded",
        projectId: GCP_CONFIG.projectId,
        totalLatencyMs: Date.now() - startedAt,
        checks: {
          identityGraph: {
            ok: spannerStatus.ok,
            playerCount,
            latencyMs: spannerStatus.latencyMs,
          },
          warehouseStore: {
            ok: true,
            savedAudiencesCount,
            latencyMs: bqLatencyMs,
          },
          mediaStorage: {
            ok: storageStatus.ok,
            bucket: storageStatus.bucket,
          },
          activationBus: {
            ok: pubsubStatus.ok,
            topic: pubsubStatus.topic,
          },
          ...(modelProbes ? { models: modelProbes } : {}),
        },
        checkedAt: new Date().toISOString(),
      },
      { status: allHealthy ? 200 : 503 }
    );
  } catch (err) {
    console.error("[GET /api/health] Live health check failed:", err);
    return NextResponse.json(
      {
        status: "error",
        error: "2K Intelligence Engine health probe failed",
        details: err instanceof Error ? err.message : String(err),
        projectId: GCP_CONFIG.projectId,
        totalLatencyMs: Date.now() - startedAt,
      },
      { status: 503 }
    );
  }
}
