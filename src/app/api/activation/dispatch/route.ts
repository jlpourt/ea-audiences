import { NextRequest, NextResponse } from "next/server";
import { publishActivation, ACTIVATION_TOPIC, ActivationChannel } from "@/lib/gcp/pubsub-client";
import { logActivation } from "@/lib/gcp/bigquery-client";
import { ActivationRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_CHANNELS: readonly ActivationChannel[] = [
  "2K_ACCOUNT_EMAIL",
  "IN_GAME_INBOX",
  "PUSH_2K_MOBILE",
  "ROCKSTAR_NEWSWIRE",
  "ZYNGA_CROSS_PROMO",
  "PAID_SOCIAL",
  "CTV_ARENA_SPOT",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audienceId, audienceName, matchedCount, channels, offerId, nlQuery } = body;

    // Validate inputs
    if (!audienceId || typeof audienceId !== "string") {
      return NextResponse.json({ error: "Missing or invalid audienceId" }, { status: 400 });
    }
    if (!audienceName || typeof audienceName !== "string") {
      return NextResponse.json({ error: "Missing or invalid audienceName" }, { status: 400 });
    }
    const count = Number(matchedCount);
    if (!Number.isFinite(count) || count < 0) {
      return NextResponse.json({ error: "matchedCount must be a non-negative number" }, { status: 400 });
    }
    if (!Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json({ error: "channels must be a non-empty array" }, { status: 400 });
    }

    // Filter/validate channels
    const targetChannels: ActivationChannel[] = channels.filter((c) =>
      VALID_CHANNELS.includes(c as ActivationChannel)
    ) as ActivationChannel[];

    if (targetChannels.length === 0) {
      return NextResponse.json({ error: "No recognized channels provided" }, { status: 400 });
    }

    // Publish to live Cloud Pub/Sub
    const pubsubResult = await publishActivation({
      audienceId,
      audienceName,
      matchedCount: count,
      channels: targetChannels,
      offerId: offerId ? String(offerId) : undefined,
      nlQuery: nlQuery ? String(nlQuery) : undefined,
      approvedBy: "Courtside Operator (HITL Sign-Off)",
      approvedAt: new Date().toISOString(),
    });

    // Write one BigQuery activation_log row per channel
    const logResults: Array<{
      channel: string;
      activationId: string;
      messageId: string;
      publishedAt: string;
    }> = [];

    const now = new Date().toISOString();
    for (const channel of targetChannels) {
      const activationId = `act-${audienceId}-${channel.toLowerCase().replace(/_/g, "-")}-${Date.now()}`;
      const record: ActivationRecord = {
        activation_id: activationId,
        audience_id: audienceId,
        channel,
        payload: {
          audienceName,
          matchedCount: count,
          offerId: offerId || null,
          nlQuery: nlQuery || null,
          pubsubMessageId: pubsubResult.messageId,
          topic: ACTIVATION_TOPIC,
          dispatchedAt: now,
        },
        published_at: now,
        pubsub_message_id: pubsubResult.messageId,
      };

      await logActivation(record);

      logResults.push({
        channel,
        activationId,
        messageId: pubsubResult.messageId,
        publishedAt: now,
      });
    }

    return NextResponse.json({
      ok: true,
      topic: ACTIVATION_TOPIC,
      messageId: pubsubResult.messageId,
      publishedAt: pubsubResult.publishedAt,
      results: logResults,
    });
  } catch (error: any) {
    console.error("[activation-dispatch] Dispatch error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to dispatch activation" },
      { status: 500 }
    );
  }
}
