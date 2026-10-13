import { NextResponse } from "next/server";
import { queryBigQuery } from "@/lib/gcp/bigquery-client";
import { invalidateCatalogCache } from "@/lib/gcp/catalog";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST() {
  const startedAt = Date.now();
  try {
    const datasetRef = `\`${GCP_CONFIG.projectId}.${GCP_CONFIG.bqDatasetId}`;
    await Promise.all([
      queryBigQuery(
        `DELETE FROM ${datasetRef}.saved_audiences\` WHERE audience_id NOT LIKE 'seed-%'`
      ),
      queryBigQuery(
        `DELETE FROM ${datasetRef}.activation_log\` WHERE activation_id NOT LIKE 'seed-%'`
      ),
    ]);

    invalidateCatalogCache();

    return NextResponse.json({
      status: "ok",
      reset: true,
      catalogCacheCleared: true,
      latencyMs: Date.now() - startedAt,
      resetAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[POST /api/reset] Reset state failed:", err);
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to reset demo session state",
        details: err instanceof Error ? err.message : String(err),
        projectId: GCP_CONFIG.projectId,
      },
      { status: 502 }
    );
  }
}
