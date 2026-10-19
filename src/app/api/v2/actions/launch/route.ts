/**
 * POST /api/v2/actions/launch  { play, segment, variant: PlanVariant, holdout_pct?: 10-50, approved_by? }
 *
 * Human-approved launch of a cross-franchise play:
 *  1. Re-reads the live Spanner Graph audience (same GQL as the Audience step).
 *  2. Randomizes every player into treatment / control (holdout) with a
 *     deterministic hash of action_id + player_id.
 *  3. Writes the assignment manifest + the action row to BigQuery
 *     (take_two_portfolio.t2_action_assignments / t2_actions).
 *  4. Publishes the activation to Cloud Pub/Sub (treatment only; the manifest
 *     table is referenced in the message attributes).
 *  5. Reads the manifest back from BigQuery joined to t2_players for a
 *     pre-launch balance check (treatment vs. control on spend, churn risk,
 *     minutes played).
 * The KPI readout happens at the readout date; nothing is estimated here.
 */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAudience } from "@/lib/v2/plays-server";
import { PLAYS, CHANNELS, kpiOf, type LaunchResponse, type PlanVariant, type PlayId } from "@/lib/v2/plays";
import { publishActivation, ACTIVATION_TOPIC } from "@/lib/gcp/pubsub-client";
import { ACTIONS_TABLE, ASSIGNMENTS_TABLE, T2_DATASET, appendRows, queryBQ, tableRef } from "@/lib/v2/actions-bq";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const play = body?.play as PlayId;
  const segment = String(body?.segment ?? "");
  const variant = body?.variant as PlanVariant | undefined;
  const holdout = Math.max(10, Math.min(50, Math.round(Number(body?.holdout_pct) || 20)));
  const approvedBy = String(body?.approved_by ?? "Jamie (Take-Two command center)").slice(0, 120);
  const def = PLAYS[play];
  const seg = def?.segments.find((s) => s.id === segment);
  if (!def || !seg) return NextResponse.json({ error: "Unknown play or segment" }, { status: 400 });
  if (!variant || !variant.id || !(CHANNELS as readonly string[]).includes(variant.channel)) {
    return NextResponse.json({ error: "A plan variant with a valid channel is required" }, { status: 400 });
  }

  let stage = "spanner audience";
  try {
    const { members, response } = await getAudience(play, segment);
    if (!members.length) return NextResponse.json({ error: "The audience is empty; nothing to launch." }, { status: 409 });

    const actionId = `act-${play.replace(/_/g, "-")}-${Date.now().toString(36)}`;
    const assignedAt = new Date().toISOString();
    const rows = members.map((m) => {
      const h = parseInt(crypto.createHash("sha256").update(`${actionId}|${m.player_id}`).digest("hex").slice(0, 8), 16) % 100;
      return { action_id: actionId, player_id: m.player_id, arm: h < holdout ? "control" : "treatment", signal: m.signal, assigned_at: assignedAt };
    });
    const treatment = rows.filter((r) => r.arm === "treatment").length;
    const control = rows.length - treatment;

    stage = "bigquery assignments";
    await appendRows(ASSIGNMENTS_TABLE, rows);

    stage = "pubsub";
    const pub = await publishActivation({
      audienceId: actionId,
      audienceName: `${def.name} · ${seg.label}`,
      matchedCount: treatment,
      channels: [variant.channel],
      approvedBy,
      approvedAt: assignedAt,
      attributes: {
        play,
        segment,
        variant: variant.id,
        holdout_pct: String(holdout),
        manifest: `${GCP_CONFIG.projectId}.${T2_DATASET}.${ASSIGNMENTS_TABLE}`,
      },
    });

    const readout = new Date(Date.now() + def.readoutDays * 86400000).toISOString().slice(0, 10);
    stage = "bigquery action log";
    await appendRows(ACTIONS_TABLE, [
      {
        action_id: actionId, play, segment, variant_id: variant.id, variant_name: variant.name, offer: variant.offer,
        message: variant.message, channel: variant.channel, reward_trigger: variant.reward_trigger, kpi: kpiOf(play, segment),
        holdout_pct: holdout, treatment_n: treatment, control_n: control, audience_gql: response.gql,
        spanner_database: GCP_CONFIG.spannerDatabaseId, pubsub_topic: pub.topic, pubsub_message_id: pub.messageId,
        approved_by: approvedBy, launched_at: assignedAt, readout_date: readout,
      },
    ]);

    stage = "bigquery balance check";
    const balance = await queryBQ<{ arm: "treatment" | "control"; n: number; avg_spend_usd: number; avg_churn_risk: number; avg_session_min_7d: number }>(
      `SELECT a.arm, COUNT(*) AS n, AVG(p.lifetime_spend_usd) AS avg_spend_usd, AVG(p.churn_risk_score) AS avg_churn_risk,
              AVG(p.session_min_7d) AS avg_session_min_7d
       FROM ${tableRef(ASSIGNMENTS_TABLE)} a JOIN ${tableRef("t2_players")} p USING (player_id)
       WHERE a.action_id = @action_id
       GROUP BY a.arm ORDER BY a.arm DESC`,
      { action_id: actionId },
    );

    const out: LaunchResponse = {
      action_id: actionId,
      play,
      segment,
      variant,
      treatment_n: treatment,
      control_n: control,
      holdout_pct: holdout,
      balance: balance.map((b) => ({ arm: b.arm, n: Number(b.n), avg_spend_usd: Number(b.avg_spend_usd), avg_churn_risk: Number(b.avg_churn_risk), avg_session_min_7d: Number(b.avg_session_min_7d) })),
      pubsub: { topic: pub.topic ?? ACTIVATION_TOPIC, message_id: pub.messageId },
      bigquery: { dataset: `${GCP_CONFIG.projectId}.${T2_DATASET}`, actions_table: ACTIONS_TABLE, assignments_table: ASSIGNMENTS_TABLE },
      readout_date: readout,
      kpi: kpiOf(play, segment),
      latency_ms: Date.now() - t0,
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error("[api/v2/actions/launch]", stage, e);
    const service = stage.startsWith("bigquery") ? "bigquery" : stage === "pubsub" ? "pubsub" : "spanner";
    return NextResponse.json({ error: `Launch failed at ${stage}`, service, stage, message: (e as Error).message }, { status: 502 });
  }
}
