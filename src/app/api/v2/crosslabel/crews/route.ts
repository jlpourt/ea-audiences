/**
 * GET /api/v2/crosslabel/crews?ids=clan-1,clan-2
 *
 * Take-Two hand-off for the crews picked in Section C: of their active members,
 * how many also play a Rockstar Games or Zynga title, and which titles. Live
 * Spanner (MemberOfClan + PlaysGame + Games). 400 on bad input, 503 with
 * details on Spanner failure. No cache: the selection changes per click.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/gcp/spanner-client";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface CrossLabelCrewsResponse {
  crews: number;
  members: number;
  cross_label_members: number;
  rockstar_members: number;
  zynga_members: number;
  titles: { title: string; label: string; players: number }[];
  query: string;
  latency_ms: number;
}

const H = "@{JOIN_METHOD=HASH_JOIN}";
const SQL = `WITH members AS (
  SELECT DISTINCT m.player_id FROM MemberOfClan m
  WHERE m.clan_id IN UNNEST(@ids) AND m.is_active = TRUE
),
other AS (
  SELECT pg.player_id, g.title, g.label
  FROM members mb
  JOIN${H} PlaysGame pg ON pg.player_id = mb.player_id
  JOIN${H} Games g ON g.game_id = pg.game_id
  WHERE g.label IN ('ROCKSTAR', 'ZYNGA') AND g.lifecycle_status != 'PRE_LAUNCH'
)
SELECT 'total' AS kind, NULL AS title, NULL AS label, (SELECT COUNT(*) FROM members) AS n
UNION ALL SELECT 'any', NULL, NULL, COUNT(DISTINCT player_id) FROM other
UNION ALL SELECT 'label', NULL, label, COUNT(DISTINCT player_id) FROM other GROUP BY label
UNION ALL SELECT 'title', title, ANY_VALUE(label), COUNT(DISTINCT player_id) FROM other GROUP BY title`;

const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ID_RE.test(s))
    .slice(0, 100);
  if (!ids.length) return NextResponse.json({ error: "ids: one or more crew ids required" }, { status: 400 });
  const t0 = Date.now();
  try {
    const [rows] = await getDatabase().run({ sql: SQL, params: { ids }, types: { ids: { type: "array", child: "string" } } });
    const out: CrossLabelCrewsResponse = { crews: ids.length, members: 0, cross_label_members: 0, rockstar_members: 0, zynga_members: 0, titles: [], query: SQL, latency_ms: 0 };
    for (const r of rows) {
      const j = r.toJSON() as { kind: string; title: string | null; label: string | null; n: number | string };
      const n = Number(j.n);
      if (j.kind === "total") out.members = n;
      else if (j.kind === "any") out.cross_label_members = n;
      else if (j.kind === "label" && j.label === "ROCKSTAR") out.rockstar_members = n;
      else if (j.kind === "label" && j.label === "ZYNGA") out.zynga_members = n;
      else if (j.kind === "title" && j.title) out.titles.push({ title: j.title, label: String(j.label), players: n });
    }
    out.titles.sort((a, b) => b.players - a.players);
    out.latency_ms = Date.now() - t0;
    return NextResponse.json(out);
  } catch (e) {
    console.error("[api/v2/crosslabel/crews] Spanner failure", e);
    return NextResponse.json(
      {
        error: "Spanner query failed",
        service: "cloud-spanner",
        resource: `${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}`,
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
