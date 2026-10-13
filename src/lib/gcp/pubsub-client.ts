/**
 * Cloud Pub/Sub — activation event bus.
 *
 * When a marketer holds-to-approve an audience, the dispatcher publishes one
 * event per activation to `twok-courtside-activations`. The A2A feed in the
 * UI shows the topic name and the returned `messageId` so the room can see a
 * real Pub/Sub publish, not a toast.
 *
 * Topic + a pull subscription are created lazily on first publish so a fresh
 * project works without a setup step. Payloads are validated to a flat,
 * size-capped shape — no player objects, no PII beyond gamer tags.
 */
import { PubSub, type Topic } from "@google-cloud/pubsub";
import { GCP_CONFIG } from "../config";

export const ACTIVATION_TOPIC = GCP_CONFIG.pubsubTopic || "twok-courtside-activations";
export const ACTIVATION_SUBSCRIPTION =
  process.env.PUBSUB_ACTIVATION_SUBSCRIPTION || `${ACTIVATION_TOPIC}-sub`;

const MAX_PAYLOAD_BYTES = 64 * 1024;

export type ActivationChannel =
  | "2K_ACCOUNT_EMAIL"
  | "IN_GAME_INBOX"
  | "PUSH_2K_MOBILE"
  | "ROCKSTAR_NEWSWIRE"
  | "ZYNGA_CROSS_PROMO"
  | "PAID_SOCIAL"
  | "CTV_ARENA_SPOT";

export interface ActivationPayload {
  audienceId: string;
  audienceName: string;
  nlQuery?: string;
  matchedCount: number;
  channels: ActivationChannel[];
  offerId?: string;
  approvedBy?: string;
  approvedAt?: string;
  /** Free-form but small — e.g. { play: "season-2-cliff" }. */
  attributes?: Record<string, string>;
}

export interface PublishResult {
  messageId: string;
  topic: string;
  publishedAt: string;
  bytes: number;
}

let pubsub: PubSub | null = null;
let ensured: Promise<Topic> | null = null;

export function getPubSub(): PubSub {
  if (!pubsub) pubsub = new PubSub({ projectId: GCP_CONFIG.projectId });
  return pubsub;
}

/** Create topic + subscription if missing. Memoized per process. */
export function ensureActivationTopic(): Promise<Topic> {
  if (!ensured) {
    ensured = (async () => {
      const client = getPubSub();
      const topic = client.topic(ACTIVATION_TOPIC);
      const [topicExists] = await topic.exists();
      if (!topicExists) await client.createTopic(ACTIVATION_TOPIC);

      const sub = topic.subscription(ACTIVATION_SUBSCRIPTION);
      const [subExists] = await sub.exists();
      if (!subExists) {
        await topic.createSubscription(ACTIVATION_SUBSCRIPTION, {
          ackDeadlineSeconds: 30,
          messageRetentionDuration: { seconds: 24 * 60 * 60 },
        });
      }
      return topic;
    })().catch((e) => {
      ensured = null; // let the next call retry instead of caching the failure
      throw e;
    });
  }
  return ensured;
}

function validatePayload(p: ActivationPayload): void {
  if (!p || typeof p !== "object") throw new Error("Activation payload must be an object.");
  if (typeof p.audienceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(p.audienceId)) {
    throw new Error("Invalid audienceId.");
  }
  if (typeof p.audienceName !== "string" || p.audienceName.length === 0 || p.audienceName.length > 200) {
    throw new Error("Invalid audienceName.");
  }
  if (!Number.isFinite(p.matchedCount) || p.matchedCount < 0) {
    throw new Error("Invalid matchedCount.");
  }
  if (!Array.isArray(p.channels) || p.channels.length === 0 || p.channels.length > 12) {
    throw new Error("channels must be a non-empty array.");
  }
}

export async function publishActivation(payload: ActivationPayload): Promise<PublishResult> {
  validatePayload(payload);
  const topic = await ensureActivationTopic();

  const publishedAt = new Date().toISOString();
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      publishedAt,
      source: "twok-courtside",
      project: GCP_CONFIG.projectId,
    })
  );
  if (body.byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error("Activation payload exceeds 64KB.");
  }

  const messageId = await topic.publishMessage({
    data: body,
    attributes: {
      audienceId: payload.audienceId,
      channelCount: String(payload.channels.length),
      ...(payload.attributes || {}),
    },
  });

  return { messageId, topic: ACTIVATION_TOPIC, publishedAt, bytes: body.byteLength };
}

/** Existence probe used by `/api/health/services`. Does not create anything. */
export async function checkActivationTopic(): Promise<{
  ok: boolean;
  topic: string;
  subscription: string;
  subscriptionExists?: boolean;
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    const topic = getPubSub().topic(ACTIVATION_TOPIC);
    const [exists] = await topic.exists();
    let subscriptionExists: boolean | undefined;
    if (exists) {
      [subscriptionExists] = await topic.subscription(ACTIVATION_SUBSCRIPTION).exists();
    }
    return {
      ok: exists,
      topic: ACTIVATION_TOPIC,
      subscription: ACTIVATION_SUBSCRIPTION,
      subscriptionExists,
      latencyMs: Date.now() - started,
      error: exists ? undefined : "topic missing",
    };
  } catch (e) {
    return {
      ok: false,
      topic: ACTIVATION_TOPIC,
      subscription: ACTIVATION_SUBSCRIPTION,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
