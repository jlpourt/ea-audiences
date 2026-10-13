import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { GCP_CONFIG } from "@/lib/config";
import { checkMediaBucket } from "@/lib/gcp/storage-client";
import { checkActivationTopic } from "@/lib/gcp/pubsub-client";

/**
 * Existence checks for the non-model GCP services the demo proves on stage:
 * BigQuery dataset, Cloud Storage media bucket, Pub/Sub activation topic.
 * Read-only — nothing here creates resources.
 */
export const dynamic = "force-dynamic";

async function checkBigQueryDataset() {
  const started = Date.now();
  const dataset = GCP_CONFIG.bqDatasetId;
  try {
    const bq = new BigQuery({ projectId: GCP_CONFIG.projectId });
    const [exists] = await bq.dataset(dataset).exists();
    let tables: string[] = [];
    if (exists) {
      const [list] = await bq.dataset(dataset).getTables();
      tables = list.map((t) => t.id || "").filter(Boolean);
    }
    return {
      ok: exists,
      dataset,
      tables,
      latencyMs: Date.now() - started,
      error: exists ? undefined : "dataset missing",
    };
  } catch (e) {
    return {
      ok: false,
      dataset,
      tables: [] as string[],
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const started = Date.now();
  const [bigquery, storage, pubsub] = await Promise.all([
    checkBigQueryDataset(),
    checkMediaBucket(),
    checkActivationTopic(),
  ]);
  const ok = bigquery.ok && storage.ok && pubsub.ok;

  return NextResponse.json(
    {
      ok,
      project: GCP_CONFIG.projectId,
      region: GCP_CONFIG.region,
      services: {
        bigquery: { service: "BigQuery", ...bigquery },
        storage: { service: "Cloud Storage", ...storage },
        pubsub: { service: "Pub/Sub", ...pubsub },
      },
      totalLatencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
