import { BigQuery } from "@google-cloud/bigquery";
import { GCP_CONFIG } from "../config";
import type { ActivationRecord, SavedAudience } from "../types";

let bqClient: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (!bqClient) {
    bqClient = new BigQuery({ projectId: GCP_CONFIG.projectId });
  }
  return bqClient;
}

export async function queryBigQuery<T = Record<string, any>>(
  sql: string,
  params?: Record<string, any>
): Promise<T[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: sql,
    params,
    location: "US",
  });
  return rows as T[];
}

function tableRef(tableName: "telemetry_events" | "saved_audiences" | "activation_log"): string {
  return `\`${GCP_CONFIG.projectId}.${GCP_CONFIG.bqDatasetId}.${tableName}\``;
}

/**
 * Persist a saved audience segment into BigQuery `twok_marketing_intelligence.saved_audiences`.
 */
export async function saveAudience(audience: SavedAudience): Promise<SavedAudience> {
  const client = getBigQueryClient();
  const row = {
    audience_id: String(audience.audience_id),
    name: String(audience.name).slice(0, 200),
    nl_query: String(audience.nl_query).slice(0, 1000),
    gql: String(audience.gql).slice(0, 8000),
    matched_count: Math.max(0, Math.round(Number(audience.matched_count) || 0)),
    created_at: audience.created_at || new Date().toISOString(),
    created_by: String(audience.created_by || "2K Lifecycle Growth").slice(0, 120),
    channels: Array.isArray(audience.channels) ? audience.channels.map(String) : [],
    status: String(audience.status || "SAVED"),
    franchise: audience.franchise ? String(audience.franchise) : "NBA2K",
    dominant_archetype: audience.dominant_archetype ? String(audience.dominant_archetype) : null,
    avg_spend:
      audience.avg_spend !== undefined && audience.avg_spend !== null
        ? Number(audience.avg_spend)
        : null,
  };

  await client
    .dataset(GCP_CONFIG.bqDatasetId)
    .table("saved_audiences")
    .insert([row]);

  return row;
}

/**
 * List saved audience segments from BigQuery, newest first.
 */
export async function listSavedAudiences(limit = 50): Promise<SavedAudience[]> {
  const safeLimit = Math.min(Math.max(1, Math.round(limit)), 200);
  const sql = `
    SELECT
      audience_id,
      name,
      nl_query,
      gql,
      matched_count,
      CAST(created_at AS STRING) AS created_at,
      created_by,
      channels,
      status,
      franchise,
      dominant_archetype,
      avg_spend
    FROM ${tableRef("saved_audiences")}
    ORDER BY created_at DESC
    LIMIT @limit
  `;
  const rows = await queryBigQuery<SavedAudience>(sql, { limit: safeLimit });
  return rows.map((r) => ({
    ...r,
    matched_count: Number(r.matched_count || 0),
    avg_spend: r.avg_spend !== null && r.avg_spend !== undefined ? Number(r.avg_spend) : null,
    channels: Array.isArray(r.channels) ? r.channels : [],
  }));
}

/**
 * Write an activation audit record to `twok_marketing_intelligence.activation_log`.
 */
export async function logActivation(record: ActivationRecord): Promise<ActivationRecord> {
  const client = getBigQueryClient();
  const row = {
    activation_id: String(record.activation_id),
    audience_id: String(record.audience_id),
    channel: String(record.channel),
    payload: JSON.stringify(record.payload || {}),
    published_at: record.published_at || new Date().toISOString(),
    pubsub_message_id: record.pubsub_message_id ? String(record.pubsub_message_id) : null,
  };

  await client
    .dataset(GCP_CONFIG.bqDatasetId)
    .table("activation_log")
    .insert([row]);

  return {
    ...record,
    published_at: row.published_at,
  };
}

/**
 * Read the most recent activation dispatch rows from BigQuery `activation_log`.
 */
export async function listActivations(limit = 50): Promise<ActivationRecord[]> {
  const safeLimit = Math.min(Math.max(1, Math.round(limit)), 200);
  const sql = `
    SELECT
      activation_id,
      audience_id,
      channel,
      TO_JSON_STRING(payload) AS payload_json,
      CAST(published_at AS STRING) AS published_at,
      pubsub_message_id
    FROM ${tableRef("activation_log")}
    ORDER BY published_at DESC
    LIMIT @limit
  `;
  const rows = await queryBigQuery<any>(sql, { limit: safeLimit });
  return rows.map((r) => {
    let parsedPayload: Record<string, any> = {};
    if (typeof r.payload_json === "string") {
      try {
        parsedPayload = JSON.parse(r.payload_json);
      } catch {
        parsedPayload = { raw: r.payload_json };
      }
    } else if (r.payload && typeof r.payload === "object") {
      parsedPayload = r.payload;
    }
    return {
      activation_id: String(r.activation_id),
      audience_id: String(r.audience_id),
      channel: String(r.channel),
      payload: parsedPayload,
      published_at: String(r.published_at),
      pubsub_message_id: r.pubsub_message_id ? String(r.pubsub_message_id) : null,
    };
  });
}
