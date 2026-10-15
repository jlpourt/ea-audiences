/**
 * POST /api/v2/personalize/serve · "Serve" button on a channel card.
 *
 * Body: ServeRequest (see src/lib/v2/concept.ts).
 *
 * - In-game / 2KTV, Console & launcher, Push / SMS, Email: publish one message
 *   on the existing Pub/Sub activation topic (`publishActivation`) and write the
 *   BigQuery `activation_log` row (`logActivation`), the same path as
 *   /api/activation/dispatch. If the player falls in the channel's 5% holdout,
 *   nothing is published; the holdout decision is logged to BigQuery.
 * - YouTube / Google Ads: stage a Customer Match-ready audience (seed + graph
 *   lookalikes, SHA-256 of the masked email) in BigQuery
 *   `twok_marketing_intelligence.v2_ads_audience_staging`, then publish the
 *   activation message. No Google Ads API call is made; the UI says "staged".
 *
 * Zero fallbacks: any Spanner / Pub/Sub / BigQuery failure returns 502/503 with
 * the service and error.
 */
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GCP_CONFIG } from "@/lib/config";
import { publishActivation, ACTIVATION_TOPIC } from "@/lib/gcp/pubsub-client";
import { logActivation, getBigQueryClient } from "@/lib/gcp/bigquery-client";
import {
  CHANNELS,
  isConceptArmId,
  isHoldout,
  type ChannelId,
  type ServeRequest,
  type ServeResponse,
} from "@/lib/v2/concept";
import { PersonalizeError, fetchUser, fetchAdsAudience } from "../engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STAGING_TABLE = "v2_ads_audience_staging";
const STAGING_SCHEMA = [
  { name: "audience_id", type: "STRING", mode: "REQUIRED" },
  { name: "player_id", type: "STRING", mode: "REQUIRED" },
  { name: "hashed_email", type: "STRING", mode: "NULLABLE" },
  { name: "preference", type: "STRING", mode: "REQUIRED" },
  { name: "source", type: "STRING", mode: "REQUIRED" },
  { name: "created_at", type: "TIMESTAMP", mode: "REQUIRED" },
  { name: "holdout", type: "BOOL", mode: "NULLABLE" },
];

let stagingReady: Promise<void> | null = null;
function ensureStagingTable(): Promise<void> {
  if (!stagingReady) {
    stagingReady = (async () => {
      const table = getBigQueryClient().dataset(GCP_CONFIG.bqDatasetId).table(STAGING_TABLE);
      const [exists] = await table.exists();
      if (!exists) {
        await getBigQueryClient()
          .dataset(GCP_CONFIG.bqDatasetId)
          .createTable(STAGING_TABLE, {
            schema: STAGING_SCHEMA,
            description: "Section D Personalization Flow: Customer Match-ready audience staging (seed + graph lookalikes).",
          });
      }
    })().catch((e) => {
      stagingReady = null;
      throw e;
    });
  }
  return stagingReady;
}

/** Customer Match normalization: trim + lowercase, then SHA-256 hex. */
function hashEmail(email: string | null): string | null {
  if (!email) return null;
  const norm = email.trim().toLowerCase();
  return norm ? createHash("sha256").update(norm).digest("hex") : null;
}

function fail(service: string, stage: string, err: unknown, status = 502) {
  console.error(`[personalize/serve] ${service} ${stage} failed:`, err);
  return NextResponse.json(
    { error: `Serve failed at ${stage}`, service, stage, details: err instanceof Error ? err.message : String(err) },
    { status }
  );
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body = (await request.json().catch(() => null)) as ServeRequest | null;
  const channel = body?.channel as ChannelId | undefined;
  if (
    !body ||
    typeof body.player_id !== "string" ||
    !body.player_id ||
    !channel ||
    !(channel in CHANNELS) ||
    !isConceptArmId(body.preference)
  ) {
    return NextResponse.json({ error: "player_id, channel and preference are required" }, { status: 400 });
  }
  const cfg = CHANNELS[channel];
  const now = new Date().toISOString();
  const audienceId = `p13n-${body.player_id}`;
  const activationId = `act-${audienceId}-${channel}-${Date.now()}`;
  const attributes: Record<string, string> = {
    flow: "v2-personalization",
    v2_channel: channel,
    preference: body.preference,
    pair_id: String(body.pair_id || ""),
    asset_id: String(body.asset_id || ""),
    creative_url: String(body.creative_url || "").slice(0, 400),
    headline: String(body.headline || "").slice(0, 200),
  };

  // ---------------- YouTube / Google Ads: stage audience ----------------
  if (cfg.audience === "lookalikes") {
    let rows: Array<Record<string, any>>;
    let seed = 0;
    let lookalikes = 0;
    let holdout = 0;
    try {
      const user = await fetchUser(body.player_id);
      const audience = await fetchAdsAudience(user, body.preference);
      rows = audience.members.map((m) => ({
        audience_id: `${audienceId}-${body.preference}`,
        player_id: m.player_id,
        hashed_email: hashEmail(m.primary_email),
        preference: body.preference,
        source: m.source,
        created_at: now,
        holdout: m.holdout,
      }));
      seed = audience.members.filter((m) => m.source === "seed").length;
      lookalikes = audience.members.filter((m) => m.source === "lookalike" && !m.holdout).length;
      holdout = audience.members.filter((m) => m.holdout).length;
    } catch (e) {
      const pe = e instanceof PersonalizeError ? e : null;
      return fail(pe?.service ?? "cloud-spanner", "ads audience", e, pe?.status ?? 503);
    }
    try {
      await ensureStagingTable();
      await getBigQueryClient().dataset(GCP_CONFIG.bqDatasetId).table(STAGING_TABLE).insert(rows);
    } catch (e) {
      return fail("bigquery", `${GCP_CONFIG.bqDatasetId}.${STAGING_TABLE} insert`, e);
    }
    let pub;
    try {
      pub = await publishActivation({
        audienceId: `${audienceId}-${body.preference}`,
        audienceName: `${body.gamer_tag} + lookalikes · ${body.preference}`,
        matchedCount: seed + lookalikes,
        channels: [cfg.dispatch],
        offerId: body.asset_id,
        approvedBy: "Courtside Operator (Personalization Flow)",
        approvedAt: now,
        attributes: { ...attributes, staging_table: `${GCP_CONFIG.bqDatasetId}.${STAGING_TABLE}`, holdout_count: String(holdout) },
      });
      await logActivation({
        activation_id: activationId,
        audience_id: `${audienceId}-${body.preference}`,
        channel: cfg.dispatch,
        payload: { ...attributes, status: "audience_staged", seed, lookalikes, holdout, topic: ACTIVATION_TOPIC },
        published_at: now,
        pubsub_message_id: pub.messageId,
      });
    } catch (e) {
      return fail("pubsub", "activation publish / log", e);
    }
    const res: ServeResponse = {
      ok: true,
      channel,
      dispatch: cfg.dispatch,
      status: "audience_staged",
      topic: pub.topic,
      message_id: pub.messageId,
      activation_id: activationId,
      published_at: pub.publishedAt,
      latency_ms: Date.now() - started,
      staged: {
        table: `${GCP_CONFIG.projectId}.${GCP_CONFIG.bqDatasetId}.${STAGING_TABLE}`,
        seed,
        lookalikes,
        holdout,
        audience_id: `${audienceId}-${body.preference}`,
      },
    };
    return NextResponse.json(res);
  }

  // ---------------- 1:1 channels ----------------
  const heldOut = isHoldout(body.player_id, channel);
  if (heldOut) {
    try {
      await logActivation({
        activation_id: activationId,
        audience_id: audienceId,
        channel: cfg.dispatch,
        payload: { ...attributes, status: "held_out", holdout: true },
        published_at: now,
        pubsub_message_id: null,
      });
    } catch (e) {
      return fail("bigquery", "activation_log insert", e);
    }
    const res: ServeResponse = {
      ok: true,
      channel,
      dispatch: cfg.dispatch,
      status: "held_out",
      topic: null,
      message_id: null,
      activation_id: activationId,
      published_at: now,
      latency_ms: Date.now() - started,
    };
    return NextResponse.json(res);
  }

  let pub;
  try {
    pub = await publishActivation({
      audienceId,
      audienceName: `${body.gamer_tag} · ${body.preference}`,
      matchedCount: 1,
      channels: [cfg.dispatch],
      offerId: body.asset_id,
      approvedBy: "Courtside Operator (Personalization Flow)",
      approvedAt: now,
      attributes,
    });
  } catch (e) {
    return fail("pubsub", "activation publish", e);
  }
  try {
    await logActivation({
      activation_id: activationId,
      audience_id: audienceId,
      channel: cfg.dispatch,
      payload: { ...attributes, status: "served", holdout: false, topic: ACTIVATION_TOPIC },
      published_at: now,
      pubsub_message_id: pub.messageId,
    });
  } catch (e) {
    return fail("bigquery", "activation_log insert", e);
  }
  const res: ServeResponse = {
    ok: true,
    channel,
    dispatch: cfg.dispatch,
    status: "served",
    topic: pub.topic,
    message_id: pub.messageId,
    activation_id: activationId,
    published_at: pub.publishedAt,
    latency_ms: Date.now() - started,
  };
  return NextResponse.json(res);
}
