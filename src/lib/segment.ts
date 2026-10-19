/**
 * Segment analytics computed from PLAYER nodes that were read from Spanner
 * (Players + PLAYS_GAME). Pure functions: no defaults are invented; metrics
 * that do not apply to a player (e.g. MyPLAYER OVR for a Zynga player) are
 * excluded from the denominator rather than counted as zero.
 */
import type { GraphNode } from "@/lib/types";
import {
  STUDIOS,
  NBA_FRANCHISES,
  franchiseName,
  studioForFranchise,
  studioForLabel,
  studioForPlayerId,
  type Studio,
} from "@/lib/studios";
import { archetypeStudio } from "@/lib/archetypes";

export function playerStudio(p: GraphNode): Studio {
  if (p.studio) return p.studio;
  if (p.label) return studioForLabel(p.label);
  if (p.franchise) return studioForFranchise(String(p.franchise));
  return studioForPlayerId(p.id) || archetypeStudio(p.archetype ? String(p.archetype) : null);
}

export interface SegmentSummary {
  count: number;
  avgSpend: number;
  avgChurn: number;
  avgTilt: number;
  highChurnCount: number;
  dominantArchetype: string;
  studioMix: Array<{ studio: Studio; players: number; pct: number; spend: number }>;
  /** Spend per title from PLAYS_GAME.spend_usd (only when title_spend is present). */
  titleSpend: Array<{ franchise: string; name: string; studio: Studio; spend: number; players: number }>;
  hasTitleSpend: boolean;
  /** Players who play titles from 2+ studios. */
  crossStudioPlayers: number;
  /** Average MyPLAYER OVR over NBA 2K players that have one (null if none). */
  avgOvr: number | null;
  ovrPlayers: number;
  wishlistedGta6: number;
}

export function summarizePlayers(players: GraphNode[]): SegmentSummary {
  const n = players.length;
  const byStudio = new Map<Studio, { players: number; spend: number }>();
  const archCounts = new Map<string, number>();
  const titleAgg = new Map<string, { spend: number; players: number }>();
  let spend = 0;
  let churn = 0;
  let tilt = 0;
  let highChurn = 0;
  let cross = 0;
  let ovrSum = 0;
  let ovrN = 0;
  let wish6 = 0;
  let hasTitleSpend = false;

  for (const p of players) {
    const s = playerStudio(p);
    const cur = byStudio.get(s) || { players: 0, spend: 0 };
    cur.players += 1;
    cur.spend += Number(p.spend || 0);
    byStudio.set(s, cur);
    spend += Number(p.spend || 0);
    churn += Number(p.churn_risk || 0);
    tilt += Number(p.tilt || 0);
    if (Number(p.churn_risk || 0) >= 0.7) highChurn += 1;
    const a = String(p.archetype || "");
    if (a) archCounts.set(a, (archCounts.get(a) || 0) + 1);

    const studios = new Set<Studio>([s]);
    for (const f of p.franchises_played || []) studios.add(studioForFranchise(f));
    if (studios.size >= 2) cross += 1;

    if (p.title_spend) {
      hasTitleSpend = true;
      for (const [f, v] of Object.entries(p.title_spend)) {
        const t = titleAgg.get(f) || { spend: 0, players: 0 };
        t.spend += Number(v || 0);
        t.players += 1;
        titleAgg.set(f, t);
      }
    }
    if (NBA_FRANCHISES.has(String(p.franchise || ""))) {
      const ovr = p.game_telemetry?.myplayer_ovr;
      if (ovr !== null && ovr !== undefined) {
        ovrSum += Number(ovr);
        ovrN += 1;
      }
    }
    if ((p.wishlisted || []).includes("GTA6") || p.game_telemetry?.gta6_wishlisted === true) {
      wish6 += 1;
    }
  }

  const dominantArchetype =
    Array.from(archCounts.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] || "";

  return {
    count: n,
    avgSpend: n ? spend / n : 0,
    avgChurn: n ? churn / n : 0,
    avgTilt: n ? tilt / n : 0,
    highChurnCount: highChurn,
    dominantArchetype,
    studioMix: STUDIOS.filter((s) => byStudio.has(s)).map((s) => ({
      studio: s,
      players: byStudio.get(s)!.players,
      pct: n ? Math.round((byStudio.get(s)!.players / n) * 100) : 0,
      spend: byStudio.get(s)!.spend,
    })),
    titleSpend: Array.from(titleAgg.entries())
      .map(([f, v]) => ({
        franchise: f,
        name: franchiseName(f),
        studio: studioForFranchise(f),
        spend: v.spend,
        players: v.players,
      }))
      .sort((x, y) => y.spend - x.spend),
    hasTitleSpend,
    crossStudioPlayers: cross,
    avgOvr: ovrN ? ovrSum / ovrN : null,
    ovrPlayers: ovrN,
    wishlistedGta6: wish6,
  };
}
