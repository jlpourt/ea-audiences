import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveAudience } from "@/lib/gcp/bigquery-client";
import type { SavedAudience } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const nlQuery = String(body?.nl_query || body?.nlQuery || "").trim();
    const gql = String(body?.gql || "").trim();

    if (!name || !nlQuery) {
      return NextResponse.json(
        { error: "Audience name and natural language query are required." },
        { status: 400 }
      );
    }

    const record: SavedAudience = {
      audience_id: String(body?.audience_id || `aud-${randomUUID().slice(0, 8)}`),
      name: name.slice(0, 160),
      nl_query: nlQuery.slice(0, 1000),
      gql: gql || "GRAPH TakeTwoPlayerGraph MATCH (p:Player) RETURN p.player_id",
      matched_count: Math.max(0, Math.round(Number(body?.matched_count ?? body?.matchedCount ?? 0))),
      created_at: new Date().toISOString(),
      created_by: String(body?.created_by || "2K Lifecycle Growth"),
      channels: Array.isArray(body?.channels) ? body.channels.map(String) : ["IN_GAME_INBOX"],
      status: String(body?.status || "SAVED"),
      franchise: body?.franchise ? String(body.franchise) : "NBA2K",
      dominant_archetype: body?.dominant_archetype ? String(body.dominant_archetype) : null,
      avg_spend:
        body?.avg_spend !== undefined && body?.avg_spend !== null
          ? Number(body.avg_spend)
          : null,
    };

    const saved = await saveAudience(record);
    return NextResponse.json({
      ok: true,
      dataset: "twok_marketing_intelligence.saved_audiences",
      audience: saved,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
