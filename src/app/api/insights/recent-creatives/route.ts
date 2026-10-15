/**
 * GET /api/insights/recent-creatives?limit=8
 *
 * Lists the most recently generated creative images in the live Cloud Storage
 * media bucket (prefix `images/`), newest first. Objects are public-read, so
 * the Home strip renders them with a plain <img>. An empty bucket returns an
 * empty list (the UI shows an empty state); a Storage failure returns 502.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMediaBucketName, getStorage, publicUrlFor } from "@/lib/gcp/storage-client";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface RecentCreative {
  name: string;
  url: string;
  updated: string;
  size: number;
  content_type: string;
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET(req: NextRequest) {
  const started = Date.now();
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const limit = Math.min(Math.max(1, Number.isFinite(raw) ? Math.round(raw) : 8), 24);
  const bucket = getMediaBucketName();
  try {
    const [files] = await getStorage().bucket(bucket).getFiles({ prefix: "images/", maxResults: 1000 });
    const items: RecentCreative[] = files
      .filter((f) => IMAGE_TYPES.has(String(f.metadata.contentType ?? "")))
      .map((f) => ({
        name: f.name,
        url: publicUrlFor(f.name),
        updated: String(f.metadata.updated ?? f.metadata.timeCreated ?? ""),
        size: Number(f.metadata.size ?? 0),
        content_type: String(f.metadata.contentType),
      }))
      .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated))
      .slice(0, limit);
    return NextResponse.json(
      { bucket, prefix: "images/", items, latency_ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[recent-creatives] failed", e);
    return NextResponse.json(
      {
        error: "Listing recent creatives failed",
        service: "cloud-storage",
        project: GCP_CONFIG.projectId,
        resource: `gs://${bucket}/images/`,
        message: (e as Error).message,
      },
      { status: 502 },
    );
  }
}
