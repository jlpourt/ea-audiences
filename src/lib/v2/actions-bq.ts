/**
 * BigQuery side of cross-franchise actions: the action log and the per-player
 * assignment manifest (treatment / control) in `take_two_portfolio`.
 * Tables are created on first use with explicit schemas. Rows are written with
 * load jobs (no streaming-buffer lag), so the balance check can read them back
 * immediately. Zero fallbacks: every error propagates.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { getBigQueryClient } from "@/lib/gcp/bigquery-client";
import { GCP_CONFIG } from "@/lib/config";

export const T2_DATASET = process.env.T2_BQ_DATASET_ID || "take_two_portfolio";
export const ACTIONS_TABLE = "t2_actions";
export const ASSIGNMENTS_TABLE = "t2_action_assignments";
const LOCATION = "US";

const F = (name: string, type: string, mode = "NULLABLE") => ({ name, type, mode });
const SCHEMAS: Record<string, ReturnType<typeof F>[]> = {
  [ACTIONS_TABLE]: [
    F("action_id", "STRING", "REQUIRED"), F("play", "STRING", "REQUIRED"), F("segment", "STRING", "REQUIRED"),
    F("variant_id", "STRING"), F("variant_name", "STRING"), F("offer", "STRING"), F("message", "STRING"), F("channel", "STRING"),
    F("reward_trigger", "STRING"), F("kpi", "STRING"), F("holdout_pct", "INT64"), F("treatment_n", "INT64"), F("control_n", "INT64"),
    F("audience_gql", "STRING"), F("spanner_database", "STRING"), F("pubsub_topic", "STRING"), F("pubsub_message_id", "STRING"),
    F("approved_by", "STRING"), F("launched_at", "TIMESTAMP", "REQUIRED"), F("readout_date", "DATE"),
  ],
  [ASSIGNMENTS_TABLE]: [
    F("action_id", "STRING", "REQUIRED"), F("player_id", "STRING", "REQUIRED"), F("arm", "STRING", "REQUIRED"),
    F("signal", "FLOAT64"), F("assigned_at", "TIMESTAMP", "REQUIRED"),
  ],
};

async function ensureTable(name: string) {
  const bq = getBigQueryClient();
  const ds = bq.dataset(T2_DATASET);
  const [dsExists] = await ds.exists();
  if (!dsExists) throw new Error(`BigQuery dataset ${GCP_CONFIG.projectId}.${T2_DATASET} does not exist. Run scripts/mirror_t2_bigquery.js first.`);
  const t = ds.table(name);
  const [exists] = await t.exists();
  if (!exists) await ds.createTable(name, { schema: { fields: SCHEMAS[name] }, location: LOCATION });
  return t;
}

export async function appendRows(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) throw new Error(`${name}: refusing to append zero rows`);
  const t = await ensureTable(name);
  const file = path.join(os.tmpdir(), `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`);
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  try {
    const [job] = await t.load(file, {
      sourceFormat: "NEWLINE_DELIMITED_JSON",
      schema: { fields: SCHEMAS[name] },
      writeDisposition: "WRITE_APPEND",
      location: LOCATION,
    });
    const errs = job.status?.errors;
    if (errs?.length) throw new Error(`${name}: BigQuery load errors ${JSON.stringify(errs.slice(0, 3))}`);
  } finally {
    fs.unlinkSync(file);
  }
}

export async function queryBQ<T = Record<string, unknown>>(query: string, params?: Record<string, unknown>): Promise<T[]> {
  const [rows] = await getBigQueryClient().query({ query, params, location: LOCATION });
  return rows as T[];
}

export const tableRef = (t: string) => `\`${GCP_CONFIG.projectId}.${T2_DATASET}.${t}\``;

export async function actionsTableExists(): Promise<boolean> {
  const [exists] = await getBigQueryClient().dataset(T2_DATASET).table(ACTIONS_TABLE).exists();
  return exists;
}
