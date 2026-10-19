/**
 * GET /api/v2/crosslabel/creators
 *
 * Take-Two layer for Ashmita's Creator section: how far 2K creator audiences
 * reach into Rockstar Games and Zynga titles. Live Spanner over the graph's
 * FOLLOWS_CREATOR and PLAYS_GAME edges: per creator, followers and the share
 * of them who also play a Rockstar or Zynga title. Cached in-process for an
 * hour (static demo snapshot). 503 with details on Spanner failure.
 */
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/gcp/spanner-client";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface CrossLabelCreatorsResponse {
  followers: number;
  also_rockstar: number;
  also_zynga: number;
  creators: { creator_id: string; handle: string; followers: number; also_rockstar: number; also_zynga: number; cross_share: number }[];
  query: string;
  latency_ms: number;
}

const H = "@{JOIN_METHOD=HASH_JOIN}";
const SQL = `WITH other AS (
  SELECT pg.player_id,
         LOGICAL_OR(g.label = 'ROCKSTAR') AS rockstar,
         LOGICAL_OR(g.label = 'ZYNGA') AS zynga
  FROM PlaysGame pg JOIN${H} Games g ON g.game_id = pg.game_id
  WHERE g.label IN ('ROCKSTAR', 'ZYNGA')
  GROUP BY pg.player_id
)
SELECT c.creator_id, c.handle,
       COUNT(DISTINCT fc.player_id) AS followers,
       COUNT(DISTINCT IF(o.rockstar, fc.player_id, NULL)) AS also_rockstar,
       COUNT(DISTINCT IF(o.zynga, fc.player_id, NULL)) AS also_zynga
FROM FollowsCreator fc
JOIN${H} Creators c ON c.creator_id = fc.creator_id
LEFT JOIN${H} other o ON o.player_id = fc.player_id
GROUP BY c.creator_id, c.handle
ORDER BY followers DESC`;

const TTL = 60 * 60 * 1000;
const g = globalThis as unknown as { __xlCreators?: { db: string; at: number; value: CrossLabelCreatorsResponse } };

export async function GET() {
  const hit = g.__xlCreators;
  if (hit && hit.db === GCP_CONFIG.spannerDatabaseId && Date.now() - hit.at < TTL) return NextResponse.json(hit.value);
  const t0 = Date.now();
  try {
    const [rows] = await getDatabase().run({ sql: SQL });
    const creators = rows.map((r) => {
      const j = r.toJSON() as Record<string, unknown>;
      const f = Number(j.followers);
      const ar = Number(j.also_rockstar);
      const az = Number(j.also_zynga);
      return { creator_id: String(j.creator_id), handle: String(j.handle), followers: f, also_rockstar: ar, also_zynga: az, cross_share: f ? Math.max(ar, az) / f : 0 };
    });
    // Distinct followers overall (a player can follow several creators).
    const [tot] = await getDatabase().run({
      sql: `SELECT COUNT(DISTINCT fc.player_id) AS followers,
                   COUNT(DISTINCT IF(g.label = 'ROCKSTAR', fc.player_id, NULL)) AS also_rockstar,
                   COUNT(DISTINCT IF(g.label = 'ZYNGA', fc.player_id, NULL)) AS also_zynga
            FROM FollowsCreator fc
            LEFT JOIN${H} PlaysGame pg ON pg.player_id = fc.player_id
            LEFT JOIN${H} Games g ON g.game_id = pg.game_id`,
    });
    const t = tot[0].toJSON() as Record<string, unknown>;
    const value: CrossLabelCreatorsResponse = {
      followers: Number(t.followers),
      also_rockstar: Number(t.also_rockstar),
      also_zynga: Number(t.also_zynga),
      creators,
      query: SQL,
      latency_ms: Date.now() - t0,
    };
    g.__xlCreators = { db: GCP_CONFIG.spannerDatabaseId, at: Date.now(), value };
    return NextResponse.json(value);
  } catch (e) {
    console.error("[api/v2/crosslabel/creators]", e);
    return NextResponse.json(
      {
        error: "Spanner query failed",
        service: "spanner",
        resource: `projects/${GCP_CONFIG.projectId}/instances/${GCP_CONFIG.spannerInstanceId}/databases/${GCP_CONFIG.spannerDatabaseId}`,
        message: (e as Error).message,
      },
      { status: 503 },
    );
  }
}
