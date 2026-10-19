/**
 * GET /api/v2/actions  -> the playbook: launched cross-franchise actions from
 * BigQuery take_two_portfolio.t2_actions (newest first). Before the first
 * launch the table does not exist yet and the playbook is genuinely empty.
 */
import { NextResponse } from "next/server";
import { ACTIONS_TABLE, T2_DATASET, actionsTableExists, queryBQ, tableRef } from "@/lib/v2/actions-bq";
import { GCP_CONFIG } from "@/lib/config";
import type { PlaybookEntry } from "@/lib/v2/plays";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (!(await actionsTableExists())) return NextResponse.json({ actions: [], dataset: `${GCP_CONFIG.projectId}.${T2_DATASET}` });
    const rows = await queryBQ<Record<string, any>>(
      `SELECT action_id, play, segment, variant_name, channel, launched_at, readout_date, treatment_n, control_n, kpi, pubsub_message_id
       FROM ${tableRef(ACTIONS_TABLE)} ORDER BY launched_at DESC LIMIT 25`,
    );
    const actions: PlaybookEntry[] = rows.map((r) => ({
      action_id: r.action_id,
      play: r.play,
      segment: r.segment,
      variant_name: r.variant_name,
      channel: r.channel,
      launched_at: r.launched_at?.value ?? String(r.launched_at),
      readout_date: r.readout_date?.value ?? String(r.readout_date),
      treatment_n: Number(r.treatment_n),
      control_n: Number(r.control_n),
      kpi: r.kpi,
      pubsub_message_id: r.pubsub_message_id,
    }));
    return NextResponse.json({ actions, dataset: `${GCP_CONFIG.projectId}.${T2_DATASET}` });
  } catch (e) {
    console.error("[api/v2/actions]", e);
    return NextResponse.json({ error: "BigQuery playbook read failed", service: "bigquery", message: (e as Error).message }, { status: 502 });
  }
}
