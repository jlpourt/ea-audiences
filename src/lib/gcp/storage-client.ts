/**
 * Cloud Storage — public media bucket for generated creative.
 *
 * Every generated image / voice-over / music bed is written here and served
 * from `https://storage.googleapis.com/<bucket>/<prefix>/<uuid>.<ext>` so the
 * Creative Studio can render it with a plain `<img>` / `<audio>` tag and the
 * URL survives the demo session.
 *
 * Security: object names are server-generated UUIDs only. The `prefix` is
 * allow-listed to a fixed set of folders so no caller can turn a user string
 * into a path. The bucket itself is uniform-access + `allUsers:objectViewer`
 * (read-only); writes always go through ADC on the server.
 */
import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { GCP_CONFIG } from "../config";

export type MediaPrefix = "images" | "audio" | "music" | "briefs" | "smoke";

const ALLOWED_PREFIXES: ReadonlySet<MediaPrefix> = new Set([
  "images",
  "audio",
  "music",
  "briefs",
  "smoke",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "application/json": "json",
};

let storage: Storage | null = null;

export function getStorage(): Storage {
  if (!storage) {
    storage = new Storage({ projectId: GCP_CONFIG.projectId });
  }
  return storage;
}

export function getMediaBucketName(): string {
  return GCP_CONFIG.gcsBucketName;
}

export function publicUrlFor(objectName: string): string {
  return `https://storage.googleapis.com/${getMediaBucketName()}/${objectName}`;
}

/**
 * Create the media bucket if it is missing: us-central1, uniform bucket-level
 * access, and public read for `allUsers`. Idempotent.
 */
export async function ensureMediaBucket(): Promise<{ created: boolean; name: string }> {
  const name = getMediaBucketName();
  const bucket = getStorage().bucket(name);
  const [exists] = await bucket.exists();
  if (exists) return { created: false, name };

  await getStorage().createBucket(name, {
    location: GCP_CONFIG.region,
    storageClass: "STANDARD",
    iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
  });
  try {
    const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
    policy.bindings.push({
      role: "roles/storage.objectViewer",
      members: ["allUsers"],
    });
    await bucket.iam.setPolicy(policy);
  } catch {
    // Public IAM may be restricted by org policy; signed URL or proxy still works
  }
  return { created: true, name };
}

export interface UploadMediaInput {
  bytes: Buffer | Uint8Array;
  mimeType: string;
  prefix: MediaPrefix;
  /** Optional, metadata only — never used in the object name. */
  metadata?: Record<string, string>;
}

export interface UploadMediaResult {
  url: string;
  gsUri: string;
  bucket: string;
  objectName: string;
  bytes: number;
  mimeType: string;
}

export async function uploadMedia(input: UploadMediaInput): Promise<UploadMediaResult> {
  if (!ALLOWED_PREFIXES.has(input.prefix)) {
    throw new Error(`Unsupported media prefix: ${input.prefix}`);
  }
  const ext = EXTENSION_BY_MIME[input.mimeType];
  if (!ext) {
    throw new Error(`Unsupported media mime type: ${input.mimeType}`);
  }
  if (!input.bytes || input.bytes.byteLength === 0) {
    throw new Error("Refusing to upload an empty media object.");
  }

  const bucketName = getMediaBucketName();
  const objectName = `${input.prefix}/${randomUUID()}.${ext}`;
  const file = getStorage().bucket(bucketName).file(objectName);

  await file.save(Buffer.from(input.bytes), {
    contentType: input.mimeType,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: input.metadata,
    },
  });

  return {
    url: publicUrlFor(objectName),
    gsUri: `gs://${bucketName}/${objectName}`,
    bucket: bucketName,
    objectName,
    bytes: input.bytes.byteLength,
    mimeType: input.mimeType,
  };
}

/** Existence probe used by `/api/health/services`. */
export async function checkMediaBucket(): Promise<{
  ok: boolean;
  bucket: string;
  location?: string;
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  const bucket = getMediaBucketName();
  try {
    const [meta] = await getStorage().bucket(bucket).getMetadata();
    return {
      ok: true,
      bucket,
      location: String(meta.location || "").toLowerCase(),
      latencyMs: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      bucket,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
