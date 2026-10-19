/**
 * Segmentation lens rules shared by the graph canvas, the cohort inspector and
 * the decision-segment filter, so every surface buckets a player the same way.
 * Studio-aware: spend thresholds are relative to each studio's players in view
 * and NBA-only signals (MyPLAYER OVR) are never invented for other studios.
 */
import type { GraphNode, SegmentationLens } from "@/lib/types";
import { archetypeStudio } from "@/lib/archetypes";
import {
  STUDIOS,
  NBA_FRANCHISES,
  studioForFranchise,
  studioForLabel,
  studioForPlayerId,
  type Studio,
} from "@/lib/studios";

export interface LensClassification {
  bucketId: string;
  label: string;
  actionTag: string;
  color: string;
  anchor?: { x: number; y: number };
  targetRadius?: number;
}

/** Studio of any node: explicit `studio`, else `label`, else franchise / id prefix / archetype. */
export function nodeStudio(node: Partial<GraphNode>): Studio {
  if (node.studio) return node.studio;
  if (node.label) return studioForLabel(node.label);
  if (node.franchise) return studioForFranchise(String(node.franchise));
  return studioForPlayerId(node.id) || archetypeStudio(node.archetype ? String(node.archetype) : null);
}

/**
 * Spend thresholds are relative to each studio's own players on the canvas:
 * a $40 Zynga spender is a top spender, a $40 NBA 2K player is not.
 */
export interface LensContext {
  spendP50: Record<Studio, number>;
  spendP80: Record<Studio, number>;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[pos];
}

export function buildLensContext(nodes: GraphNode[]): LensContext {
  const spends: Record<Studio, number[]> = { "2K": [], ROCKSTAR: [], ZYNGA: [] };
  for (const n of nodes) {
    if (n.type !== "PLAYER") continue;
    spends[nodeStudio(n)].push(Number(n.spend || 0));
  }
  const spendP50 = {} as Record<Studio, number>;
  const spendP80 = {} as Record<Studio, number>;
  for (const s of STUDIOS) {
    const sorted = spends[s].sort((a, b) => a - b);
    spendP50[s] = quantile(sorted, 0.5);
    spendP80[s] = quantile(sorted, 0.8);
  }
  return { spendP50, spendP80 };
}

/** Distinct studios a player has PLAYS_GAME edges into. */
function studiosPlayed(node: GraphNode): Set<Studio> {
  const set = new Set<Studio>([nodeStudio(node)]);
  for (const f of node.franchises_played || []) set.add(studioForFranchise(f));
  return set;
}

const HIGH_SPEND_ARCHETYPES = new Set(["MYTEAM_PACK_WHALE", "SHARK_CARD_SPENDER"]);

export function classifyNodeForLens(
  node: GraphNode,
  keystoneCaptainIds: Set<string>,
  lens: SegmentationLens,
  ctx?: LensContext
): LensClassification | null {
  if (node.type !== "PLAYER" || lens === "FRANCHISE" || lens === "ARCHETYPE") return null;

  const spend = Number(node.spend || 0);
  const churn = Number(node.churn_risk || 0);
  const tilt = Number(node.tilt || 0);
  const lossStreak = Number(node.loss_streak || 0);
  const archetype = String(node.archetype || "");
  const studio = nodeStudio(node);
  const tel = node.game_telemetry || {};
  const isNba = NBA_FRANCHISES.has(String(node.franchise || ""));
  // MyPLAYER OVR exists only for NBA 2K players; never invent one for others.
  const ovr =
    isNba && tel.myplayer_ovr !== undefined && tel.myplayer_ovr !== null
      ? Number(tel.myplayer_ovr)
      : null;
  const lastLoginDays = Number(tel.last_login_days_ago || 0);
  const p50 = ctx?.spendP50[studio] ?? 0;
  const p80 = ctx?.spendP80[studio] ?? Number.POSITIVE_INFINITY;
  const isCrewLeader =
    node.crew_role === "CAPTAIN" ||
    node.crew_role === "CO_CAPTAIN" ||
    tel.crew_role === "CAPTAIN" ||
    archetype === "REC_CREW_CAPTAIN";

  if (lens === "CATE_UPLIFT") {
    if (keystoneCaptainIds.has(node.id) || isCrewLeader) {
      return {
        bucketId: "SEED_CREW_CAPTAIN",
        label: "Keystone Captains",
        actionTag: "Seed",
        color: "#F5B400",
        anchor: { x: -240, y: -150 },
      };
    }
    if (tilt >= 0.58 || lossStreak >= 3 || archetype === "RAGE_QUIT_TILT_RISK") {
      return {
        bucketId: "SLEEPING_DOG",
        label: "Sleeping Dogs",
        actionTag: "Suppress",
        color: "#FF4D5E",
        anchor: { x: 240, y: 150 },
      };
    }
    if (
      (spend > 0 && spend >= p80) ||
      HIGH_SPEND_ARCHETYPES.has(archetype) ||
      tel.season_pass_edition === "HALL_OF_FAME"
    ) {
      return {
        bucketId: "SURE_THING_D2C",
        label: "Sure Things",
        actionTag: "Hold discount",
        color: "#38BDF8",
        anchor: { x: 240, y: -150 },
      };
    }
    return {
      bucketId: "PERSUADABLE",
      label: "Persuadables",
      actionTag: "Target",
      color: "#19C37D",
      anchor: { x: -240, y: 150 },
    };
  }

  if (lens === "PORTFOLIO_RINGS") {
    if (
      studiosPlayed(node).size >= 2 ||
      archetype === "CROSS_LABEL_NOMAD" ||
      tel.migrated_to_2k27 === false
    ) {
      return {
        bucketId: "RING_3_STRETCH",
        label: "Ring 3 · Stretch",
        actionTag: "Cross-studio",
        color: "#A855F7",
        targetRadius: 335,
      };
    }
    if (
      (ovr !== null && ovr < 85) ||
      keystoneCaptainIds.has(node.id) ||
      Boolean(node.clan_id) ||
      spend < p50
    ) {
      return {
        bucketId: "RING_2_NURTURE",
        label: "Ring 2 · Nurture",
        actionTag: "Crew & low spend",
        color: "#F5B400",
        targetRadius: 220,
      };
    }
    return {
      bucketId: "RING_1_CORE",
      label: "Ring 1 · Core",
      actionTag: "Retain",
      color: "#19C37D",
      targetRadius: 105,
    };
  }

  if (lens === "TRAJECTORY") {
    if (spend > 0 && spend >= p80 && (churn >= 0.42 || lastLoginDays >= 4)) {
      return {
        bucketId: "WHALE_VELOCITY_DECAY",
        label: "Whale Decay",
        actionTag: "Guard spend",
        color: "#38BDF8",
        anchor: { x: 240, y: -150 },
      };
    }
    if (lossStreak >= 2 || tilt >= 0.52 || churn >= 0.6) {
      return {
        bucketId: "REACTIVE_TILT_META",
        label: "Reactive Tilt",
        actionTag: "Rescue",
        color: "#FF4D5E",
        anchor: { x: 240, y: 150 },
      };
    }
    // NBA 2K: MyPLAYER stuck below 85 OVR. Everyone else: no session in 7+ days.
    if (ovr !== null ? ovr < 85 : lastLoginDays >= 7) {
      return {
        bucketId: "BADGE_WALL_STALL",
        label: "Progress Stall",
        actionTag: isNba ? "Boost OVR" : "Re-engage",
        color: "#F5B400",
        anchor: { x: -240, y: 150 },
      };
    }
    return {
      bucketId: "GOLDEN_PATH",
      label: "Golden Path",
      actionTag: "Healthy",
      color: "#19C37D",
      anchor: { x: -240, y: -150 },
    };
  }

  return null;
}


/**
 * Keystone captains: real crew captains (MEMBER_OF_CLAN role), Rec crew
 * captain / Park grinder archetypes, or players with 3+ social edges on canvas.
 */
export function computeKeystoneCaptains(
  nodes: GraphNode[],
  links: Array<{ source: any; target: any; label?: string; isMultiHopBridge?: boolean }>
): Set<string> {
  const socialDegree = new Map<string, number>();
  for (const l of links || []) {
    const sId = typeof l.source === "object" ? l.source.id : String(l.source);
    const tId = typeof l.target === "object" ? l.target.id : String(l.target);
    const lbl = String(l.label || "");
    if (
      lbl.startsWith("MEMBER_OF_CLAN") ||
      lbl.startsWith("PLAYED_WITH") ||
      lbl.startsWith("FRIENDS_WITH") ||
      lbl.startsWith("INVITED") ||
      Boolean(l.isMultiHopBridge)
    ) {
      socialDegree.set(sId, (socialDegree.get(sId) || 0) + 1);
      socialDegree.set(tId, (socialDegree.get(tId) || 0) + 1);
    }
  }
  const captains = new Set<string>();
  for (const n of nodes || []) {
    if (n.type !== "PLAYER") continue;
    const arch = String(n.archetype || "");
    if (
      arch === "REC_CREW_CAPTAIN" ||
      arch === "PARK_REP_GRINDER" ||
      n.crew_role === "CAPTAIN" ||
      (socialDegree.get(n.id) || 0) >= 3
    ) {
      captains.add(n.id);
    }
  }
  return captains;
}
