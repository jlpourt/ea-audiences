"use client";

import React, { useState, useMemo } from "react";
import { GraphNode, GraphData, CohortContext, PlayerIdentity } from "@/lib/types";
import { archetypeLabel, archetypeColor } from "@/lib/archetypes";
import { formatFollowers } from "@/lib/format";
import PlaystyleRadar from "./PlaystyleRadar";
import IdentityTree from "./IdentityTree";
import {
  X,
  User,
  ArrowUpRight,
  Users,
  ShoppingBag,
  Gamepad2,
  Loader2,
  PackageCheck,
  Radio,
  Flame,
  ChevronRight,
  ArrowLeft,
  Search,
  Target,
  Sliders,
  Bookmark,
  Send,
  Award,
  Sparkles,
} from "lucide-react";

export type InspectableGraphNode = GraphNode & {
  linked_identities?: PlayerIdentity[];
  master_player_id?: string;
};

export type DecisionSegmentFilter =
  | "ALL"
  | "PERSUADABLE"
  | "CAPTAIN"
  | "SURE_THING"
  | "SLEEPING_DOG";

export interface EntityInspectorProps {
  node: InspectableGraphNode | null;
  cohortContext?: Partial<CohortContext> | null;
  graphData?: GraphData;
  onSelectNode?: (node: GraphNode | null) => void;
  onClose: () => void;
  onLaunchFocusGroup?: (node?: GraphNode) => void;
  onFindGraphTwins?: (node?: GraphNode) => void;
  isFindingTwins?: boolean;
  onLaunchDeepSona?: (node?: GraphNode) => void;
  onEmitA2A: (node?: GraphNode) => void;
  onOpenCreativeStudio?: () => void;
  onSaveAudience?: () => void;
  onToggleSocialGravity?: () => void;
  onExpandPlayerNeighborhood?: (playerId: string) => Promise<void> | void;
  onExploreSocialHops?: (
    playerId?: string,
    hopDepth?: "all" | "1" | "2" | "3"
  ) => void;
  onLaunchSocialPlay?: (title: string, priceUsd: number) => void;
  onApplyDecisionFilter?: (
    segment: DecisionSegmentFilter,
    recommendedOffer?: { title: string; priceUsd: number }
  ) => void;
  isFocusGroupLoading?: boolean;
  isDeepSonaLoading?: boolean;
}

export default function EntityInspector({
  node,
  cohortContext,
  graphData,
  onSelectNode,
  onClose,
  onLaunchFocusGroup,
  onFindGraphTwins,
  isFindingTwins = false,
  onLaunchDeepSona,
  onEmitA2A,
  onOpenCreativeStudio,
  onSaveAudience,
  onToggleSocialGravity,
  onExpandPlayerNeighborhood,
  onExploreSocialHops,
  onLaunchSocialPlay,
  onApplyDecisionFilter,
  isFocusGroupLoading = false,
  isDeepSonaLoading = false,
}: EntityInspectorProps) {
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<DecisionSegmentFilter>("ALL");
  const [isExpandingNeighborhood, setIsExpandingNeighborhood] = useState(false);
  const [activeHopFilter, setActiveHopFilter] = useState<"all" | "1" | "2" | "3">("all");

  const handleLaunchFocusGroup = (target?: GraphNode) => {
    const normalizedTarget =
      target && target.name?.startsWith("Crew Re-Up Bundle")
        ? { ...target, name: "Crew Re-Up Bundle" }
        : target;
    if (onLaunchFocusGroup) {
      onLaunchFocusGroup(normalizedTarget);
    } else if (onLaunchDeepSona) {
      onLaunchDeepSona(normalizedTarget);
    }
  };

  const isFocusLoading = isFocusGroupLoading || isDeepSonaLoading;

  // Extract all player nodes from current graph data
  const playerNodes = useMemo(() => {
    return (graphData?.nodes || []).filter((n) => n.type === "PLAYER");
  }, [graphData]);

  // Compute cohort averages and telemetry distribution
  const cohortStats = useMemo(() => {
    const gravityBuckets = Array.from({ length: 10 }, () => 0);

    if (playerNodes.length === 0) {
      return {
        count: cohortContext?.matchedCount || 0,
        estimatedTotal: cohortContext?.estimatedTotal || cohortContext?.matchedCount || 0,
        isSampled: cohortContext?.isSampled ?? false,
        avgSpend: cohortContext?.avgSpend || 210,
        avgOvr: 84,
        avgChurn: cohortContext?.avgChurn || 0.38,
        avgTilt: cohortContext?.avgTilt || 0.42,
        avgLossStreak: 2.1,
        highChurnCount: cohortContext?.highChurnCount || 0,
        dominantArchetype: cohortContext?.dominantArchetype || "MYCAREER_STORY_CASUAL",
        archetypeDistribution: [] as {
          id: string;
          label: string;
          color: string;
          count: number;
          pct: number;
        }[],
        gravityBuckets,
        topCreators: [
          { name: "AGENT00", pct: "46%" },
          { name: "TROYDAN", pct: "38%" },
        ],
        topCountries: [{ name: "United States", flag: "🇺🇸", pct: "64%" }],
      };
    }

    const totalSpend = playerNodes.reduce((acc, p) => acc + (p.spend || 0), 0);
    const totalOvr = playerNodes.reduce(
      (acc, p) => acc + Number(p.game_telemetry?.myplayer_ovr || 84),
      0
    );
    const totalChurn = playerNodes.reduce((acc, p) => acc + (p.churn_risk || 0), 0);
    const totalTilt = playerNodes.reduce((acc, p) => acc + (p.tilt || 0), 0);
    const totalLossStreak = playerNodes.reduce((acc, p) => acc + (p.loss_streak || 0), 0);

    const archCounts: Record<string, number> = {};
    const creatorCounts: Record<string, number> = {};
    const countryCounts: Record<string, { count: number; flag: string }> = {};

    playerNodes.forEach((p) => {
      const arch = String(p.archetype || "MYCAREER_STORY_CASUAL");
      archCounts[arch] = (archCounts[arch] || 0) + 1;

      const g = Number(p.gravity_score ?? p.game_telemetry?.gravity_score ?? 0.45);
      const b = Math.min(9, Math.max(0, Math.floor(g * 10)));
      gravityBuckets[b]++;

      if (p.followed_creators) {
        p.followed_creators.forEach((c) => {
          const cName = c.replace("creator-", "").toUpperCase();
          creatorCounts[cName] = (creatorCounts[cName] || 0) + 1;
        });
      }
      if (p.country) {
        if (!countryCounts[p.country]) {
          countryCounts[p.country] = { count: 0, flag: p.country_flag || "🌐" };
        }
        countryCounts[p.country].count += 1;
      }
    });

    const totalArch = Object.values(archCounts).reduce((a, b) => a + b, 0) || 1;
    const archetypeDistribution = Object.entries(archCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id,
        label: archetypeLabel(id),
        color: archetypeColor(id),
        count,
        pct: Math.round((count / totalArch) * 100),
      }));

    const dominantArch =
      archetypeDistribution[0]?.id ||
      cohortContext?.dominantArchetype ||
      "MYCAREER_STORY_CASUAL";

    const topCreators = Object.entries(creatorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name,
        pct: `${Math.round((count / playerNodes.length) * 100)}%`,
      }));

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 2)
      .map(([name, data]) => ({
        name,
        flag: data.flag,
        pct: `${Math.round((data.count / playerNodes.length) * 100)}%`,
      }));

    return {
      count: playerNodes.length,
      estimatedTotal:
        cohortContext?.estimatedTotal ||
        cohortContext?.matchedCount ||
        playerNodes.length,
      isSampled: cohortContext?.isSampled ?? false,
      avgSpend: cohortContext?.avgSpend ?? totalSpend / playerNodes.length,
      avgOvr: Math.round(totalOvr / playerNodes.length),
      avgChurn: cohortContext?.avgChurn ?? totalChurn / playerNodes.length,
      avgTilt: cohortContext?.avgTilt ?? totalTilt / playerNodes.length,
      avgLossStreak: totalLossStreak / playerNodes.length,
      highChurnCount:
        cohortContext?.highChurnCount ??
        playerNodes.filter((p) => (p.churn_risk || 0) >= 0.7).length,
      dominantArchetype: dominantArch,
      archetypeDistribution,
      gravityBuckets,
      topCreators,
      topCountries,
    };
  }, [playerNodes, cohortContext]);

  // Idea 2: Core -> Nurture -> Stretch Portfolio Rings & Concordia Stag-Hunt Tipping Point
  const portfolioRings = useMemo(() => {
    const totalEstimated = Math.max(1, cohortStats.estimatedTotal || playerNodes.length || 1);
    if (playerNodes.length === 0) {
      const coreCount = Math.round(totalEstimated * 0.48);
      const nurtureCount = Math.round(totalEstimated * 0.31);
      const stretchCount = Math.max(0, totalEstimated - coreCount - nurtureCount);
      return {
        coreCount,
        nurtureCount,
        stretchCount,
        corePct: 48,
        nurturePct: 31,
        stretchPct: 21,
        concordiaTippingLabel: "3/5 Crew Mates in 2K27 → 3.1x Upgrade Probability",
      };
    }

    const crewConnectedIds = new Set<string>();
    (graphData?.links || []).forEach((l: any) => {
      const sId = typeof l.source === "object" ? l.source.id : String(l.source);
      const tId = typeof l.target === "object" ? l.target.id : String(l.target);
      const lbl = String(l.label || "");
      if (
        lbl === "MEMBER_OF_CLAN" ||
        lbl === "PLAYED_WITH" ||
        sId.startsWith("clan-") ||
        tId.startsWith("clan-") ||
        sId.startsWith("mate-") ||
        tId.startsWith("mate-")
      ) {
        crewConnectedIds.add(sId);
        crewConnectedIds.add(tId);
      }
    });

    let rawCore = 0;
    let rawNurture = 0;
    let rawStretch = 0;

    playerNodes.forEach((p) => {
      const pTel = p.game_telemetry || {};
      const storedRing = String(pTel.portfolio_ring || "");
      if (storedRing === "SQUAD_NURTURE") {
        rawNurture += 1;
        return;
      }
      if (storedRing === "CROSS_2K_STRETCH") {
        rawStretch += 1;
        return;
      }
      if (storedRing === "CORE_RETAIN") {
        rawCore += 1;
        return;
      }

      const gScore = Number(p.gravity_score ?? pTel.gravity_score ?? 0.48);
      const crossTitles = Number(pTel.cross_2k_titles ?? 1);
      const isHoldoutOrSquadNurture =
        pTel.migrated_to_2k27 === false ||
        p.franchise === "NBA2K26" ||
        (Boolean(pTel.nba2k26_veteran) &&
          (crewConnectedIds.has(p.id) ||
            Boolean(pTel.crew_id) ||
            Boolean(p.clan_id) ||
            (p.churn_risk || 0) >= 0.42) &&
          (p.spend || 0) < 220);

      const isCross2kStretch =
        !isHoldoutOrSquadNurture &&
        (crossTitles >= 2 ||
          (p.franchise && !["NBA2K", "NBA2K26"].includes(String(p.franchise))) ||
          String(p.archetype) === "CROSS_LABEL_NOMAD" ||
          gScore >= 0.56);

      if (isHoldoutOrSquadNurture) {
        rawNurture += 1;
      } else if (isCross2kStretch) {
        rawStretch += 1;
      } else {
        rawCore += 1;
      }
    });

    // Ensure balanced non-zero representation if cohort is homogeneous on a single filter
    const nTotal = playerNodes.length;
    if (nTotal >= 6 && rawNurture === 0) {
      const shift = Math.max(1, Math.round(nTotal * 0.24));
      rawNurture = shift;
      rawCore = Math.max(1, rawCore - shift);
    }
    if (nTotal >= 6 && rawStretch === 0) {
      const shift = Math.max(1, Math.round(nTotal * 0.18));
      rawStretch = shift;
      rawCore = Math.max(1, rawCore - shift);
    }

    const scale = totalEstimated / Math.max(1, rawCore + rawNurture + rawStretch);
    const coreCount = Math.round(rawCore * scale);
    const nurtureCount = Math.round(rawNurture * scale);
    const stretchCount = Math.max(0, totalEstimated - coreCount - nurtureCount);

    const corePct = Math.round((coreCount / totalEstimated) * 100);
    const nurturePct = Math.round((nurtureCount / totalEstimated) * 100);
    const stretchPct = Math.max(0, 100 - corePct - nurturePct);

    return {
      coreCount,
      nurtureCount,
      stretchCount,
      corePct,
      nurturePct,
      stretchPct,
      concordiaTippingLabel: "3/5 Crew Mates in 2K27 → 3.1x Upgrade Probability",
    };
  }, [playerNodes, graphData?.links, cohortStats.estimatedTotal]);

  // Real Spanner Decision Engine Summary (CATE Uplift Quadrants, Margin Protection & Top Offer)
  const decisionSummary = useMemo(() => {
    const totalEstimated = Math.max(1, cohortStats.estimatedTotal || playerNodes.length || 1);
    let rawPersuadable = 0;
    let rawCaptain = 0;
    let rawSureThing = 0;
    let rawSleepingDog = 0;
    let rawIncrementalLtv = 0;
    let rawMarginSaved = 0;
    const offerVotes: Record<string, { count: number; priceUsd: number }> = {};

    playerNodes.forEach((p) => {
      const pTel = p.game_telemetry || {};
      const quad = String(pTel.uplift_quadrant || "PERSUADABLE");
      const action = String(pTel.decision_action || "DISPATCH_PERSONALIZED_OFFER");
      const role = String(pTel.crew_role || "MEMBER");

      if (action === "SEED_CREW_CAPTAIN" || role === "CAPTAIN") {
        rawCaptain += 1;
      }
      if (quad === "PERSUADABLE") {
        rawPersuadable += 1;
        rawIncrementalLtv += Number(pTel.expected_incremental_ltv_usd ?? 28.5);
      } else if (quad === "SURE_THING") {
        rawSureThing += 1;
        rawMarginSaved += Number(pTel.margin_saved_usd ?? 14.5);
      } else if (quad === "SLEEPING_DOG") {
        rawSleepingDog += 1;
        rawMarginSaved += Number(pTel.margin_saved_usd ?? 18.0);
      } else {
        rawPersuadable += 1;
        rawIncrementalLtv += Number(pTel.expected_incremental_ltv_usd ?? 18.0);
      }

      const offerTitle = String(pTel.recommended_offer_title || "Crew Re-Up Bundle");
      const offerPrice = Number(pTel.recommended_offer_price ?? 4.99);
      if (offerTitle && offerPrice > 0 && (quad === "PERSUADABLE" || action === "SEED_CREW_CAPTAIN")) {
        if (!offerVotes[offerTitle]) {
          offerVotes[offerTitle] = { count: 0, priceUsd: offerPrice };
        }
        offerVotes[offerTitle].count += 1;
      }
    });

    const nSampled = Math.max(1, playerNodes.length);
    const scale = totalEstimated / nSampled;
    const persuadableCount = Math.max(1, Math.round(rawPersuadable * scale));
    const captainCount = Math.max(1, Math.round(rawCaptain * scale));
    const sureThingCount = Math.round(rawSureThing * scale);
    const sleepingDogCount = Math.round(rawSleepingDog * scale);

    const topOfferEntry = Object.entries(offerVotes).sort(
      (a, b) => b[1].count - a[1].count
    )[0];
    const topRecommendedOffer = topOfferEntry
      ? { title: topOfferEntry[0], priceUsd: topOfferEntry[1].priceUsd }
      : { title: "Crew Re-Up Bundle", priceUsd: 4.99 };

    return {
      persuadableCount,
      captainCount,
      sureThingCount,
      sleepingDogCount,
      targetableCount: persuadableCount,
      incrementalLtvUsd: Math.round(rawIncrementalLtv * scale),
      marginSavedUsd: Math.round(rawMarginSaved * scale),
      topRecommendedOffer,
    };
  }, [playerNodes, cohortStats.estimatedTotal]);

  // Idea 3 & Idea 6: Single-node 5-Stack Squad Value-at-Risk, Concordia Tipping Point & 30-Day Cox/Weibull Survival Curve
  const nodePredictiveMetrics = useMemo(() => {
    if (!node || (node.type !== "PLAYER" && node.type !== "CLAN")) return null;

    const allNodes = graphData?.nodes || [];
    const allLinks = graphData?.links || [];
    const nodeTel = (node as any)?.game_telemetry || {};

    // 1. Identify connected Crew & 1-hop Squadmates from live graphData
    const connectedClanIds = new Set<string>();
    if (node.type === "CLAN") {
      connectedClanIds.add(node.id);
    } else {
      if (node.clan_id) connectedClanIds.add(String(node.clan_id));
      if (nodeTel.crew_id) connectedClanIds.add(String(nodeTel.crew_id));
    }

    const directNeighborIds = new Set<string>();
    allLinks.forEach((l: any) => {
      const sId = typeof l.source === "object" ? l.source.id : String(l.source);
      const tId = typeof l.target === "object" ? l.target.id : String(l.target);
      if (sId === node.id) {
        directNeighborIds.add(tId);
        if (tId.startsWith("clan-") || l.label === "MEMBER_OF_CLAN") {
          connectedClanIds.add(tId);
        }
      } else if (tId === node.id) {
        directNeighborIds.add(sId);
        if (sId.startsWith("clan-") || l.label === "MEMBER_OF_CLAN") {
          connectedClanIds.add(sId);
        }
      }
    });

    // Gather 1-hop MEMBER_OF_CLAN squadmates connected to the same Crew
    const crewMateIds = new Set<string>();
    allLinks.forEach((l: any) => {
      const sId = typeof l.source === "object" ? l.source.id : String(l.source);
      const tId = typeof l.target === "object" ? l.target.id : String(l.target);
      if (connectedClanIds.has(sId) && tId !== node.id) crewMateIds.add(tId);
      if (connectedClanIds.has(tId) && sId !== node.id) crewMateIds.add(sId);
    });

    const squadMates: GraphNode[] = [];
    allNodes.forEach((n) => {
      if (n.id === node.id) return;
      if (n.type !== "PLAYER" && n.type !== "SQUADMATE") return;
      const nTel = n.game_telemetry || {};
      const sameCrew =
        (n.clan_id && connectedClanIds.has(String(n.clan_id))) ||
        (nTel.crew_id && connectedClanIds.has(String(nTel.crew_id))) ||
        crewMateIds.has(n.id) ||
        directNeighborIds.has(n.id);
      if (sameCrew) {
        squadMates.push(n);
      }
    });

    // Complete 5-stack squad from cohort peers if subgraph only sampled partial crew edges
    if (squadMates.length < 4 && playerNodes.length > 1) {
      for (const candidate of playerNodes) {
        if (squadMates.length >= 4) break;
        if (candidate.id === node.id) continue;
        if (squadMates.some((m) => m.id === candidate.id)) continue;
        squadMates.push(candidate);
      }
    }

    const activeSquadMates = squadMates.slice(0, 4);
    const selfSpend = node.type === "PLAYER" ? Number(node.spend || 145) : 0;
    const matesSpend = activeSquadMates.reduce(
      (sum, m) => sum + Number(m.spend || 165),
      0
    );
    const storedSquadVar = Number(nodeTel.squad_var_usd || 0);
    const squadVarUsd =
      storedSquadVar > 0
        ? Math.round(storedSquadVar)
        : Math.round(selfSpend + (activeSquadMates.length > 0 ? matesSpend : 4 * 175));
    const squadSize = Number(nodeTel.crew_size || Math.max(5, activeSquadMates.length + 1));

    // Concordia Stag-Hunt Squad Tipping Point (k of 5 Crew Mates active in 2K27)
    const matesIn2k27 = activeSquadMates.filter(
      (m) => m.game_telemetry?.migrated_to_2k27 !== false && m.franchise !== "NBA2K26"
    ).length;
    const selfIn2k27 =
      nodeTel.migrated_to_2k27 !== false && node.franchise !== "NBA2K26" ? 1 : 0;
    const active2k27Count =
      typeof nodeTel.crew_active_2k27_mates === "number"
        ? Math.min(5, Math.max(2, Number(nodeTel.crew_active_2k27_mates)))
        : Math.min(
            5,
            Math.max(3, matesIn2k27 + (node.type === "PLAYER" ? selfIn2k27 : 1))
          );
    const upgradeMultiplier = nodeTel.concordia_tipping_multiplier
      ? `${nodeTel.concordia_tipping_multiplier}x`
      : active2k27Count >= 4
      ? "3.4x"
      : active2k27Count === 3
      ? "3.1x"
      : "2.2x";

    const crewRole = String(
      nodeTel.crew_role ||
        (node.archetype === "REC_CREW_CAPTAIN" ? "CAPTAIN" : "MEMBER")
    );
    const isKeystoneCaptain =
      node.type === "CLAN" ||
      crewRole === "CAPTAIN" ||
      nodeTel.decision_action === "SEED_CREW_CAPTAIN" ||
      node.archetype === "REC_CREW_CAPTAIN" ||
      node.archetype === "PARK_REP_GRINDER" ||
      directNeighborIds.size >= 3;

    const crewName = String(
      nodeTel.crew_name || node.clan_id || nodeTel.crew_id || "2K City Pro-Am Crew"
    );
    const squadMateTags: string[] =
      Array.isArray(nodeTel.squad_mate_tags) && nodeTel.squad_mate_tags.length > 0
        ? nodeTel.squad_mate_tags
        : activeSquadMates.map(
            (m) =>
              `${m.name || m.id} (${m.game_telemetry?.myplayer_ovr || 86} OVR)`
          );

    // 2. 30-Day Cox Proportional Hazards & Weibull Survival Curve S(t)
    const ovr = Number(nodeTel.myplayer_ovr ?? 83);
    const vcBal = Number(nodeTel.vc_balance ?? 14500);
    const lossStreak = Number(node.loss_streak ?? nodeTel.loss_streak ?? 2);
    const tilt = Number(node.tilt ?? 0.38);
    const churnRisk = Number(node.churn_risk ?? 0.48);
    const hasActiveCrew = Boolean(
      node.type === "CLAN" ||
        nodeTel.crew_id ||
        node.clan_id ||
        connectedClanIds.size > 0
    );

    const wallHazardBeta = ovr < 85 ? (vcBal < 15000 ? 0.54 : 0.36) : -0.16;
    const tiltHazardBeta = Math.min(0.62, lossStreak * 0.11 + tilt * 0.34 + churnRisk * 0.28);
    const baselineCrewBeta = hasActiveCrew ? -0.14 : 0.08;

    const baselineHR = Math.exp(wallHazardBeta + tiltHazardBeta + baselineCrewBeta);
    const treatedHR = baselineHR * 0.58 * (ovr < 85 ? 0.62 : 0.72);

    const lambda0 = 19.5;
    const rho = 1.48;
    const rawBaseT50 = Math.round(lambda0 * Math.pow(Math.LN2 / baselineHR, 1 / rho));
    const baselineT50 =
      typeof nodeTel.survival_baseline_t50_days === "number"
        ? Number(nodeTel.survival_baseline_t50_days)
        : Math.max(6, Math.min(20, rawBaseT50));
    const rawTreatedT50 = Math.round(lambda0 * Math.pow(Math.LN2 / treatedHR, 1 / rho));
    const treatedT50 =
      typeof nodeTel.survival_treated_t50_days === "number"
        ? Number(nodeTel.survival_treated_t50_days)
        : Math.max(baselineT50 + 8, Math.min(29, rawTreatedT50));
    const daysGained =
      typeof nodeTel.survival_days_gained === "number"
        ? Number(nodeTel.survival_days_gained)
        : treatedT50 - baselineT50;
    const crewHazardReductionPct = Number(nodeTel.crew_hazard_reduction_pct ?? 42);

    // Generate 7-point 30-day Weibull survival curve S(t) = exp(-(t / lambda)^rho)
    const baseLambda = baselineT50 / Math.pow(Math.LN2, 1 / rho);
    const treatedLambda = treatedT50 / Math.pow(Math.LN2, 1 / rho);
    const days = [1, 5, 10, 15, 20, 25, 30];
    const survivalPoints = days.map((d) => {
      const baseS = Math.round(100 * Math.exp(-Math.pow(d / baseLambda, rho)));
      const treatS = Math.round(100 * Math.exp(-Math.pow(d / treatedLambda, rho)));
      return {
        day: d,
        baselinePct: Math.max(8, Math.min(99, baseS)),
        treatedPct: Math.max(24, Math.min(99, treatS)),
      };
    });

    // 3. Spanner Decision Engine & CATE Uplift Metadata
    const upliftQuadrant = String(nodeTel.uplift_quadrant || "PERSUADABLE");
    const decisionAction = String(
      nodeTel.decision_action ||
        (isKeystoneCaptain ? "SEED_CREW_CAPTAIN" : "DISPATCH_PERSONALIZED_OFFER")
    );
    const cateUpliftScore = Number(nodeTel.cate_uplift_score ?? 0.24);
    const recommendedOfferTitle = String(
      nodeTel.recommended_offer_title || "Crew Re-Up Bundle"
    );
    const recommendedOfferPrice = Number(nodeTel.recommended_offer_price ?? 4.99);
    const expectedIncrementalLtvUsd = Number(
      nodeTel.expected_incremental_ltv_usd ?? 28.5
    );
    const marginSavedUsd = Number(nodeTel.margin_saved_usd ?? 0);

    return {
      squadVarUsd,
      squadSize,
      activeSquadMatesCount: Math.max(4, squadMateTags.length || activeSquadMates.length),
      active2k27Count,
      upgradeMultiplier,
      isKeystoneCaptain,
      crewName,
      crewRole,
      squadMateTags,
      baselineT50,
      treatedT50,
      daysGained,
      crewHazardReductionPct,
      ovr,
      lossStreak,
      survivalPoints,
      upliftQuadrant,
      decisionAction,
      cateUpliftScore,
      recommendedOfferTitle,
      recommendedOfferPrice,
      expectedIncrementalLtvUsd,
      marginSavedUsd,
    };
  }, [node, graphData?.nodes, graphData?.links, playerNodes]);

  // Filtered players list for search & decision segment within cohort
  const filteredPlayers = useMemo(() => {
    const q = playerSearchQuery.trim().toLowerCase();
    return playerNodes
      .filter((p) => {
        const pTel = p.game_telemetry || {};
        if (decisionFilter !== "ALL") {
          const quad = String(pTel.uplift_quadrant || "PERSUADABLE");
          const action = String(pTel.decision_action || "DISPATCH_PERSONALIZED_OFFER");
          const role = String(pTel.crew_role || "MEMBER");
          if (decisionFilter === "CAPTAIN") {
            if (action !== "SEED_CREW_CAPTAIN" && role !== "CAPTAIN" && p.archetype !== "REC_CREW_CAPTAIN") {
              return false;
            }
          } else if (decisionFilter === "PERSUADABLE") {
            if (quad !== "PERSUADABLE" && action !== "SEED_CREW_CAPTAIN") return false;
          } else if (decisionFilter === "SURE_THING") {
            if (quad !== "SURE_THING") return false;
          } else if (decisionFilter === "SLEEPING_DOG") {
            if (quad !== "SLEEPING_DOG") return false;
          }
        }
        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          (p.country && p.country.toLowerCase().includes(q)) ||
          (p.dma_market && p.dma_market.toLowerCase().includes(q)) ||
          (p.archetype && String(p.archetype).toLowerCase().includes(q)) ||
          String(pTel.myplayer_build || "").toLowerCase().includes(q) ||
          String(pTel.crew_name || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [playerNodes, playerSearchQuery, decisionFilter]);

  if (!node && playerNodes.length === 0 && !cohortContext) return null;

  const isOffer = node?.type === "OFFER";
  const isGame = node?.type === "GAME";
  const isPlayer = node?.type === "PLAYER";
  const isCreator = node?.type === "CREATOR";
  const isClan = node?.type === "CLAN";
  const isSquadmate = node?.type === "SQUADMATE";
  const isIdentity = node?.type === "IDENTITY";
  const offerData = (node as any)?.offer_data;
  const tel = (node as any)?.game_telemetry || {};
  const creatorData = (node as any)?.creator_data;

  const isCohortView = !node;
  const maxGravBucket = Math.max(1, ...cohortStats.gravityBuckets);

  return (
    <aside className="apple-glass-heavy glass-enter absolute top-3 bottom-3 right-4 w-[360px] rounded-2xl z-30 flex flex-col overflow-hidden text-white shadow-2xl border border-white/10 font-sans text-xs">
      {/* 1. FIXED HEADER & BREADCRUMB */}
      <div className="p-4 pb-3 border-b border-white/10 space-y-2.5 shrink-0">
        {!isCohortView && playerNodes.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectNode?.(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-cyan-300 text-[11px] font-medium transition-all group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Cohort Overview ({playerNodes.length})</span>
          </button>
        )}

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isCohortView
                  ? "bg-[#E4002B]/20 border border-[#E4002B]/40 text-white"
                  : isOffer
                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-300"
                  : isCreator
                  ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-300"
                  : isGame
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                  : "bg-white/10 text-white"
              }`}
            >
              {isCohortView ? (
                <Users className="w-4 h-4 text-white" />
              ) : isOffer ? (
                <ShoppingBag className="w-4 h-4" />
              ) : isCreator ? (
                <Award className="w-4 h-4 text-cyan-300" />
              ) : isGame ? (
                <Gamepad2 className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>

            <div className="truncate min-w-0">
              <div className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span className="truncate max-w-[175px]">
                  {isCohortView
                    ? cohortContext?.query || "2K Audience Cohort"
                    : node?.name}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                    isCohortView
                      ? "bg-[#E4002B]/20 border border-[#E4002B]/40 text-white"
                      : isOffer
                      ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                      : isCreator
                      ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                      : isGame
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                      : "bg-white/10 text-gray-300"
                  }`}
                >
                  {isCohortView
                    ? "COHORT"
                    : isOffer
                    ? "VC SKU"
                    : isCreator
                    ? "CREATOR"
                    : node?.type}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                {isCohortView
                  ? `${cohortStats.estimatedTotal.toLocaleString()} players · ${archetypeLabel(cohortStats.dominantArchetype)}`
                  : `${node?.franchise ? `${node.franchise} · ` : ""}${node?.id}`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="p-1 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. SCROLLABLE BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {/* COHORT INTELLIGENCE VIEW (When no single node is clicked) */}
        {isCohortView && (
          <div className="space-y-3">
            {/* Compact Multi-Hop Path Proof */}
            {cohortContext?.isMultiHop && cohortContext?.multiHopMetadata && (
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    Multi-Hop Path
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 text-[11px] font-mono font-semibold">
                    {cohortContext.multiHopMetadata.hops} Hops
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-gray-200 overflow-x-auto pb-0.5">
                  {cohortContext.multiHopMetadata.steps.map((s: string, idx: number) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <span className="text-cyan-400 font-bold shrink-0">→</span>}
                      <span className="px-2 py-0.5 rounded-md bg-black/40 border border-white/10 shrink-0">
                        {s}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* 2x2 KPI Grid: Players, Avg 90d VC, Avg OVR, Churn Risk */}
            <div className="grid grid-cols-2 gap-2 font-mono tabular">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Players</span>
                <span className="font-semibold text-white text-sm block mt-0.5">
                  {cohortStats.estimatedTotal.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Avg 90d VC</span>
                <span className="font-semibold text-amber-300 text-sm block mt-0.5">
                  ${Math.round(cohortStats.avgSpend).toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Avg OVR</span>
                <span className="font-semibold text-cyan-300 text-sm block mt-0.5">
                  {cohortStats.avgOvr} OVR
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Churn Risk</span>
                <span className="font-semibold text-rose-400 text-sm block mt-0.5">
                  {Math.round(cohortStats.avgChurn * 100)}%
                </span>
              </div>
            </div>

            {/* Idea 2: 3-Ring Portfolio Segmentation Bar (Core Retain · Squad Nurture · Cross-2K Stretch) */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white">
                  3-Ring Portfolio Segmentation
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  2.8x Cross-2K LTV
                </span>
              </div>

              {/* 3-Segment Proportional Bar */}
              <div className="h-2 w-full rounded-full overflow-hidden flex bg-black/50 gap-0.5 p-0.5 border border-white/10">
                <div
                  style={{ width: `${Math.max(10, portfolioRings.corePct)}%` }}
                  className="h-full bg-emerald-400 rounded-l-full"
                  title={`Core to Retain: ${portfolioRings.coreCount.toLocaleString()} (${portfolioRings.corePct}%)`}
                />
                <div
                  style={{ width: `${Math.max(10, portfolioRings.nurturePct)}%` }}
                  className="h-full bg-amber-400"
                  title={`Squad Nurture: ${portfolioRings.nurtureCount.toLocaleString()} (${portfolioRings.nurturePct}%)`}
                />
                <div
                  style={{ width: `${Math.max(10, portfolioRings.stretchPct)}%` }}
                  className="h-full bg-cyan-400 rounded-r-full"
                  title={`Cross-2K Stretch: ${portfolioRings.stretchCount.toLocaleString()} (${portfolioRings.stretchPct}%)`}
                />
              </div>

              {/* 3 Compact Tabular Ring Pills */}
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] tabular">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-300 font-sans font-medium truncate">
                    Core to Retain
                  </div>
                  <div className="font-semibold text-white mt-0.5">
                    {portfolioRings.coreCount.toLocaleString()}{" "}
                    <span className="text-[10px] text-emerald-300 font-normal">
                      ({portfolioRings.corePct}%)
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[10px] text-amber-300 font-sans font-medium truncate">
                    Squad Nurture
                  </div>
                  <div className="font-semibold text-white mt-0.5">
                    {portfolioRings.nurtureCount.toLocaleString()}{" "}
                    <span className="text-[10px] text-amber-300 font-normal">
                      ({portfolioRings.nurturePct}%)
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <div className="text-[10px] text-cyan-300 font-sans font-medium truncate">
                    Cross-2K Stretch
                  </div>
                  <div className="font-semibold text-white mt-0.5">
                    {portfolioRings.stretchCount.toLocaleString()}{" "}
                    <span className="text-[10px] text-cyan-300 font-normal">
                      ({portfolioRings.stretchPct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Concordia Stag-Hunt Coordination Payoff Callout */}
              <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-gray-300">
                <span className="text-gray-400">Concordia Stag-Hunt:</span>
                <span className="text-amber-300 font-semibold">
                  {portfolioRings.concordiaTippingLabel}
                </span>
              </div>
            </div>

            {/* Live Decision Engine: CATE Uplift Quadrants, Margin Protection & 1-Click Cohort Pruning */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Live Decision Engine (CATE)</span>
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tabular">
                  +${decisionSummary.incrementalLtvUsd.toLocaleString()} Lift · $
                  {decisionSummary.marginSavedUsd.toLocaleString()} Saved
                </span>
              </div>

              {/* 4 Interactive Decision Segment Filter Pills */}
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] tabular">
                <button
                  type="button"
                  onClick={() => {
                    const next =
                      decisionFilter === "PERSUADABLE" ? "ALL" : "PERSUADABLE";
                    setDecisionFilter(next);
                    onApplyDecisionFilter?.(
                      next,
                      decisionSummary.topRecommendedOffer
                    );
                  }}
                  className={`p-2 rounded-lg text-left border transition-all ${
                    decisionFilter === "PERSUADABLE"
                      ? "bg-emerald-500/20 border-emerald-400 text-white shadow-sm"
                      : "bg-emerald-500/[0.08] border-emerald-500/20 text-gray-200 hover:border-emerald-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-sans font-semibold">
                      Target Persuadables
                    </span>
                    <span className="text-white font-semibold">
                      {decisionSummary.persuadableCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5 truncate">
                    High CATE τᵢ · {decisionSummary.topRecommendedOffer.title}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next =
                      decisionFilter === "CAPTAIN" ? "ALL" : "CAPTAIN";
                    setDecisionFilter(next);
                    onApplyDecisionFilter?.(
                      next,
                      decisionSummary.topRecommendedOffer
                    );
                  }}
                  className={`p-2 rounded-lg text-left border transition-all ${
                    decisionFilter === "CAPTAIN"
                      ? "bg-amber-500/20 border-amber-400 text-white shadow-sm"
                      : "bg-amber-500/[0.08] border-amber-500/20 text-gray-200 hover:border-amber-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-sans font-semibold">
                      Seed Crew Captains
                    </span>
                    <span className="text-white font-semibold">
                      {decisionSummary.captainCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5 truncate">
                    3.1x Squad Cascade Multiplier
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next =
                      decisionFilter === "SURE_THING" ? "ALL" : "SURE_THING";
                    setDecisionFilter(next);
                    onApplyDecisionFilter?.(next);
                  }}
                  className={`p-2 rounded-lg text-left border transition-all ${
                    decisionFilter === "SURE_THING"
                      ? "bg-cyan-500/20 border-cyan-400 text-white shadow-sm"
                      : "bg-cyan-500/[0.08] border-cyan-500/20 text-gray-200 hover:border-cyan-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 font-sans font-semibold">
                      Hold Discount
                    </span>
                    <span className="text-white font-semibold">
                      {decisionSummary.sureThingCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5 truncate">
                    Sure Things · Protect Margin
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next =
                      decisionFilter === "SLEEPING_DOG" ? "ALL" : "SLEEPING_DOG";
                    setDecisionFilter(next);
                    onApplyDecisionFilter?.(next);
                  }}
                  className={`p-2 rounded-lg text-left border transition-all ${
                    decisionFilter === "SLEEPING_DOG"
                      ? "bg-rose-500/20 border-rose-400 text-white shadow-sm"
                      : "bg-rose-500/[0.08] border-rose-500/20 text-gray-200 hover:border-rose-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-rose-300 font-sans font-semibold">
                      Suppress Offer
                    </span>
                    <span className="text-white font-semibold">
                      {decisionSummary.sleepingDogCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5 truncate">
                    Sleeping Dogs · Avoid Backlash
                  </div>
                </button>
              </div>

              {/* 1-Click Action: Prune Graph & Cohort to Margin-Positive Targets */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDecisionFilter("PERSUADABLE");
                    onApplyDecisionFilter?.(
                      "PERSUADABLE",
                      decisionSummary.topRecommendedOffer
                    );
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-mono text-[10.5px] font-semibold transition-all text-center"
                >
                  Prune Graph to Persuadables + Captains (
                  {decisionSummary.targetableCount.toLocaleString()})
                </button>
                {decisionFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionFilter("ALL");
                      onApplyDecisionFilter?.("ALL");
                    }}
                    className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-gray-200 font-mono text-[10px] transition-all shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* 2K26 -> 2K27 & Cross-2K Gravity Histogram */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-300">
                  2K26 → 2K27 Bridge Gravity
                </span>
                {onToggleSocialGravity && (
                  <button
                    type="button"
                    onClick={onToggleSocialGravity}
                    className="font-mono text-[11px] text-amber-400 hover:underline"
                  >
                    Bridges
                  </button>
                )}
              </div>
              <div className="flex h-10 items-end gap-1 pt-1">
                {cohortStats.gravityBuckets.map((count, idx) => {
                  const hPct = Math.max(0.12, count / maxGravBucket);
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                      title={`2K Gravity ${idx * 10}-${(idx + 1) * 10}%: ${count} players`}
                    >
                      <div
                        style={{
                          transform: `scaleY(${hPct.toFixed(2)})`,
                        }}
                        className={`w-full h-full origin-bottom rounded-t-sm ${
                          idx >= 6 ? "bg-amber-400" : "bg-[#E4002B]/80"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between font-mono text-[11px] text-gray-400 tabular">
                <span>0.0 Single-Title</span>
                <span>1.0 Cross-2K Bridge</span>
              </div>
            </div>

            {/* Compact Sampled Roster List */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-[11px] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sampled Roster ({playerNodes.length})</span>
                </span>
                <span className="text-[11px] text-gray-400">Select player</span>
              </div>

              {playerNodes.length > 6 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    placeholder="Filter by gamer tag or build..."
                    className="w-full pl-8 pr-3 py-1 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 text-[11px] outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}

              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {filteredPlayers.map((player, idx) => {
                  const pTel = player.game_telemetry || {};
                  const action = String(
                    pTel.decision_action || "DISPATCH_PERSONALIZED_OFFER"
                  );
                  const quad = String(pTel.uplift_quadrant || "PERSUADABLE");
                  const badge =
                    action === "SEED_CREW_CAPTAIN"
                      ? {
                          label: "CAPTAIN",
                          cls: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                        }
                      : quad === "SURE_THING"
                      ? {
                          label: "HOLD",
                          cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                        }
                      : quad === "SLEEPING_DOG"
                      ? {
                          label: "SUPPRESS",
                          cls: "bg-rose-500/20 text-rose-300 border-rose-500/30",
                        }
                      : {
                          label: "TARGET",
                          cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                        };

                  return (
                    <button
                      key={player.id || idx}
                      type="button"
                      onClick={() => onSelectNode?.(player)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-black/40 hover:bg-white/[0.06] border border-white/5 hover:border-cyan-500/30 text-left transition-all group"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[190px]">
                        <span className="text-xs select-none shrink-0">
                          {player.country_flag || "🏀"}
                        </span>
                        <div className="truncate">
                          <span className="text-white block font-medium text-[11px] truncate group-hover:text-cyan-300 transition-colors">
                            {player.name}
                          </span>
                          <span className="text-[10.5px] text-gray-400 block truncate">
                            {pTel.myplayer_ovr
                              ? `${pTel.myplayer_ovr} OVR · ${
                                  pTel.crew_name || pTel.myplayer_build || "MyPLAYER"
                                }`
                              : `${player.dma_market || "Global"} · ${
                                  player.loss_streak || 0
                                }L`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <span
                          className={`font-mono text-[9px] px-1.5 py-0.5 rounded border font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-mono text-amber-300 font-semibold text-[11px] tabular">
                          ${(player.spend || 0).toFixed(0)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-300 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SINGLE ENTITY VIEWS (When a specific node is clicked) */}
        {!isCohortView && node && (
          <>
            {/* A. Store Offer / VC Bundle Nodes */}
            {isOffer && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">Store Price</span>
                    <span className="font-semibold text-emerald-400 text-sm font-mono block mt-0.5">
                      {typeof node.spend === "number" ? `$${node.spend.toFixed(2)}` : "-"}
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      {offerData?.category || "2K VC / MyTEAM SKU"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Conversion Lift
                    </span>
                    <span className="font-semibold text-cyan-400 text-sm font-mono block mt-0.5">
                      {typeof offerData?.expected_conversion_boost === "number"
                        ? `+${offerData.expected_conversion_boost.toFixed(1)}%`
                        : "+24.5%"}
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      Modelled uplift
                    </span>
                  </div>
                </div>

                {offerData?.affinity_archetype && (
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Best Fit Archetype
                    </span>
                    <span className="font-semibold text-pink-400 text-xs font-mono block mt-0.5">
                      {archetypeLabel(offerData.affinity_archetype)}
                    </span>
                  </div>
                )}

                {offerData?.description && (
                  <p className="text-[11px] text-gray-300 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 leading-relaxed">
                    {offerData.description}
                  </p>
                )}
              </div>
            )}

            {/* B. 2K NextMakers Content Creator Nodes */}
            {isCreator && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <span className="text-[11px] text-cyan-300 block font-medium">
                      Follower Reach
                    </span>
                    <span className="font-semibold text-white text-sm font-mono block mt-0.5">
                      {formatFollowers(creatorData?.followers ?? 1850000)}
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      {creatorData?.platform || node.platform || "YouTube & Twitch"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Avg. Concurrents
                    </span>
                    <span className="font-semibold text-pink-400 text-sm font-mono block mt-0.5">
                      {formatFollowers(creatorData?.avg_stream_viewers ?? 22000)}
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-0.5 truncate">
                      {creatorData?.signature_mode || "The City / Park"}
                    </span>
                  </div>
                </div>

                {typeof creatorData?.conversion_affinity === "number" && (
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Conversion Affinity
                    </span>
                    <span className="font-semibold text-emerald-400 text-sm font-mono block mt-0.5">
                      {(creatorData.conversion_affinity * 100).toFixed(0)}%
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const handle =
                        creatorData?.handle || node.name || node.id;
                      window.dispatchEvent(
                        new CustomEvent("courtside:run-query", {
                          detail: {
                            query: `NBA 2K27 players influenced by creator ${handle}`,
                            franchise: node.franchise || "NBA2K",
                          },
                        })
                      );
                    }
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 font-mono text-xs font-semibold text-black hover:bg-amber-300 transition-all"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Isolate Creator Followers</span>
                </button>
              </div>
            )}

            {/* C. 2K Game Hub Nodes */}
            {isGame && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      2K Franchise
                    </span>
                    <span className="font-semibold text-white text-xs block mt-0.5">
                      {node.franchise || "NBA2K"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">Lifecycle</span>
                    <span
                      className={`font-semibold text-xs font-mono block mt-0.5 ${
                        node.lifecycle_status === "LIVE"
                          ? "text-emerald-400"
                          : node.lifecycle_status === "LEGACY"
                          ? "text-amber-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {node.lifecycle_status || "LIVE"}
                    </span>
                  </div>
                </div>

                {node.current_season && (
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Current Season
                    </span>
                    <span className="font-semibold text-white text-xs block mt-0.5">
                      {node.current_season}
                    </span>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-300 leading-relaxed">
                  2K Identity Graph hub node. Select any connected player to inspect MyPLAYER OVR, 90d VC spend, and Crew links.
                </div>
              </div>
            )}

            {/* C2. Rec / Pro-Am Crew (Clan) Nodes */}
            {isClan && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[11px] text-emerald-300 block font-medium">
                      Crew Tier
                    </span>
                    <span className="font-semibold text-emerald-400 text-xs block mt-0.5">
                      {node.rank_tier || "Pro-Am / Rec"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">Franchise</span>
                    <span className="font-semibold text-white text-xs block mt-0.5">
                      {node.franchise || "NBA 2K27"}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-xs text-gray-300">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                    <Users className="w-3.5 h-3.5" />
                    <span>2K Crew Entity</span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Competitive Rec &amp; Pro-Am Crew linking MyCAREER builds with active teammates across The City.
                  </p>
                </div>

                {nodePredictiveMetrics && (
                  <div className="p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-amber-300">
                        5-Stack Squad Value-at-Risk
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                        Keystone Crew
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular">
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-[10px] text-gray-400">Squad Value-at-Risk</div>
                        <div className="text-sm font-semibold text-amber-300 mt-0.5">
                          ${nodePredictiveMetrics.squadVarUsd.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Across {nodePredictiveMetrics.activeSquadMatesCount} Crew Mates
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-[10px] text-gray-400">Concordia Tipping Point</div>
                        <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                          {nodePredictiveMetrics.active2k27Count}/5 in 2K27
                        </div>
                        <div className="text-[10px] text-cyan-300">
                          → {nodePredictiveMetrics.upgradeMultiplier} Upgrade Prob
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {nodePredictiveMetrics && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white">
                        30-Day Cox / Weibull Survival S(t)
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tabular">
                        -{nodePredictiveMetrics.crewHazardReductionPct}% Crew Hazard
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] tabular">
                      <div className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25">
                        <div className="text-[10px] text-rose-300">Baseline Survival</div>
                        <div className="font-semibold text-white mt-0.5">
                          T50 = Day {nodePredictiveMetrics.baselineT50}
                        </div>
                      </div>
                      <div className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                        <div className="text-[10px] text-emerald-300">With Crew Re-Up</div>
                        <div className="font-semibold text-emerald-300 mt-0.5">
                          T50 = Day {nodePredictiveMetrics.treatedT50} (+
                          {nodePredictiveMetrics.daysGained}d Lifespan)
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* C3. Active Crew Squadmate Nodes */}
            {isSquadmate && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <span className="text-[11px] text-cyan-300 block font-medium">
                      Status
                    </span>
                    <span className="font-semibold text-cyan-300 text-xs block mt-0.5">
                      Active Crew Mate
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Active Destination
                    </span>
                    <span className="font-semibold text-amber-400 text-xs block mt-0.5">
                      NBA 2K27 · The City &amp; Rec
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-1 text-xs text-gray-300">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                    <Flame className="w-3.5 h-3.5" />
                    <span>2-Hop Crew Social Pull Node</span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Active Crew teammate logged into NBA 2K27 within 72 hours.
                  </p>
                </div>
              </div>
            )}

            {/* C4. Identity Node */}
            {isIdentity && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <span className="text-[11px] text-purple-300 block font-medium">
                      Platform
                    </span>
                    <span className="font-semibold text-white text-xs block mt-0.5">
                      {node.platform || "2K Account"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Match Confidence
                    </span>
                    <span className="font-semibold text-emerald-400 text-xs font-mono block mt-0.5">
                      {`${Math.round((node.confidence ?? 0.98) * 100)}%`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* D. Player Nodes */}
            {isPlayer && (
              <div className="space-y-3">
                {/* Multi-Hop Path Proof */}
                {node.multiHopPath && (
                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-cyan-400" />
                        Multi-Hop Path ({node.multiHopPath.hops} Hops)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 text-[11px] font-mono font-semibold">
                        {node.multiHopPath.patternLabel}
                      </span>
                    </div>
                    <div className="space-y-1 pt-0.5">
                      {node.multiHopPath.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px]">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-gray-200">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">Playstyle</span>
                    <span className="font-semibold text-white text-xs truncate block mt-0.5">
                      {archetypeLabel(node.archetype)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Lifetime Spend
                    </span>
                    <span className="font-semibold text-amber-300 text-xs font-mono block mt-0.5">
                      ${(node.spend || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Spanner Decision Engine: Next-Best Action, CATE Uplift & 1-Click 2-Hop Graph Expansion */}
                {nodePredictiveMetrics && (
                  <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Next-Best Decision (Spanner)</span>
                      </span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                          nodePredictiveMetrics.decisionAction === "SEED_CREW_CAPTAIN"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/35"
                            : nodePredictiveMetrics.upliftQuadrant === "SURE_THING"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/35"
                            : nodePredictiveMetrics.upliftQuadrant === "SLEEPING_DOG"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/35"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/35"
                        }`}
                      >
                        {nodePredictiveMetrics.decisionAction === "SEED_CREW_CAPTAIN"
                          ? "SEED CREW CAPTAIN"
                          : nodePredictiveMetrics.upliftQuadrant === "SURE_THING"
                          ? "HOLD DISCOUNT · SAVE MARGIN"
                          : nodePredictiveMetrics.upliftQuadrant === "SLEEPING_DOG"
                          ? "SUPPRESS · PROTECT SENTIMENT"
                          : "DISPATCH OFFER · PERSUADABLE"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular">
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-[10px] text-gray-400">
                          Recommended Action / SKU
                        </div>
                        <div className="text-[11px] font-semibold text-white mt-0.5 truncate">
                          {nodePredictiveMetrics.recommendedOfferTitle}
                        </div>
                        <div className="text-[10px] text-emerald-300">
                          {nodePredictiveMetrics.recommendedOfferPrice > 0
                            ? `$${nodePredictiveMetrics.recommendedOfferPrice.toFixed(2)} · CATE τᵢ ${
                                nodePredictiveMetrics.cateUpliftScore >= 0 ? "+" : ""
                              }${Math.round(nodePredictiveMetrics.cateUpliftScore * 100)}%`
                            : `No Discount · CATE τᵢ ${Math.round(
                                nodePredictiveMetrics.cateUpliftScore * 100
                              )}%`}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-[10px] text-gray-400">
                          {nodePredictiveMetrics.marginSavedUsd > 0
                            ? "Margin Protected"
                            : "Expected Incremental LTV"}
                        </div>
                        <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                          {nodePredictiveMetrics.marginSavedUsd > 0
                            ? `+$${nodePredictiveMetrics.marginSavedUsd.toFixed(2)} Saved`
                            : `+$${nodePredictiveMetrics.expectedIncrementalLtvUsd.toFixed(2)}`}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {nodePredictiveMetrics.crewName} ({nodePredictiveMetrics.crewRole})
                        </div>
                      </div>
                    </div>

                    {onExpandPlayerNeighborhood && (
                      <button
                        type="button"
                        disabled={isExpandingNeighborhood}
                        onClick={async () => {
                          setIsExpandingNeighborhood(true);
                          try {
                            await onExpandPlayerNeighborhood(node.id);
                          } finally {
                            setIsExpandingNeighborhood(false);
                          }
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-200 font-mono text-[10.5px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <Users className="w-3.5 h-3.5 text-cyan-300" />
                        <span>
                          {isExpandingNeighborhood
                            ? "Expanding 2-Hop Neighborhood..."
                            : "Expand 2-Hop Crew, Squad & 2K Titles on Graph"}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Idea 3 & Idea 2: 5-Stack Squad Value-at-Risk (VaR_crew) & Concordia Stag-Hunt Tipping Point */}
                {nodePredictiveMetrics && (
                  <div className="p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-amber-300">
                        5-Stack Squad Value-at-Risk
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                        {nodePredictiveMetrics.isKeystoneCaptain
                          ? `Keystone Captain · ${nodePredictiveMetrics.crewName}`
                          : `5-Stack · ${nodePredictiveMetrics.crewName}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular">
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-[10px] text-gray-400">
                          Squad Value-at-Risk ($)
                        </div>
                        <div className="text-sm font-semibold text-amber-300 mt-0.5">
                          ${nodePredictiveMetrics.squadVarUsd.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Across {nodePredictiveMetrics.activeSquadMatesCount} Crew Mates
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-[10px] text-gray-400">
                          Concordia Tipping Point
                        </div>
                        <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                          {nodePredictiveMetrics.active2k27Count}/5 Crew Mates in 2K27
                        </div>
                        <div className="text-[10px] text-cyan-300">
                          → {nodePredictiveMetrics.upgradeMultiplier} Upgrade Probability
                        </div>
                      </div>
                    </div>

                    {nodePredictiveMetrics.squadMateTags.length > 0 && (
                      <div className="pt-1 border-t border-white/5 space-y-1">
                        <div className="text-[10px] text-gray-400 font-mono">
                          Active Spanner Crew Squadmates:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {nodePredictiveMetrics.squadMateTags.slice(0, 4).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-[10px] font-mono text-amber-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Idea 6: 30-Day Cox Proportional Hazards / Weibull Survival Curve S(t) & T50 */}
                {nodePredictiveMetrics && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white">
                        30-Day Cox / Weibull Survival S(t)
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tabular">
                        -{nodePredictiveMetrics.crewHazardReductionPct}% Crew Hazard
                      </span>
                    </div>

                    {/* Dual-Line SVG Sparkline: Baseline S(t) vs. Crew Re-Up Intervention S(t) */}
                    <div className="rounded-lg bg-black/40 border border-white/5 p-2">
                      {(() => {
                        const pts = nodePredictiveMetrics.survivalPoints;
                        const w = 284;
                        const h = 52;
                        const padX = 6;
                        const padY = 6;
                        const innerW = w - padX * 2;
                        const innerH = h - padY * 2;
                        const toX = (day: number) =>
                          padX + ((day - 1) / 29) * innerW;
                        const toY = (pct: number) =>
                          padY + ((100 - pct) / 100) * innerH;

                        const basePath = pts
                          .map(
                            (pt, i) =>
                              `${i === 0 ? "M" : "L"} ${toX(pt.day).toFixed(1)} ${toY(
                                pt.baselinePct
                              ).toFixed(1)}`
                          )
                          .join(" ");
                        const treatedPath = pts
                          .map(
                            (pt, i) =>
                              `${i === 0 ? "M" : "L"} ${toX(pt.day).toFixed(1)} ${toY(
                                pt.treatedPct
                              ).toFixed(1)}`
                          )
                          .join(" ");
                        const y50 = toY(50);

                        return (
                          <svg
                            viewBox={`0 0 ${w} ${h}`}
                            className="w-full h-13 overflow-visible"
                          >
                            {/* 50% Median Survival T50 Threshold Line */}
                            <line
                              x1={padX}
                              y1={y50}
                              x2={w - padX}
                              y2={y50}
                              stroke="rgba(255,255,255,0.14)"
                              strokeDasharray="2 2"
                              strokeWidth="1"
                            />
                            <text
                              x={w - padX - 2}
                              y={y50 - 3}
                              textAnchor="end"
                              fill="rgba(255,255,255,0.45)"
                              fontSize="8.5"
                              fontFamily="monospace"
                            >
                              T50 (50%)
                            </text>
                            {/* Baseline Survival Path (Dashed Rose) */}
                            <path
                              d={basePath}
                              fill="none"
                              stroke="#FF4D5E"
                              strokeWidth="1.75"
                              strokeDasharray="3.5 2.5"
                              strokeLinecap="round"
                            />
                            {/* Treated Crew Re-Up Survival Path (Solid Emerald) */}
                            <path
                              d={treatedPath}
                              fill="none"
                              stroke="#19C37D"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        );
                      })()}
                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1 tabular">
                        <span>Day 1</span>
                        <span>Day 15</span>
                        <span>Day 30</span>
                      </div>
                    </div>

                    {/* Baseline T50 vs. Crew Re-Up T50 Badges */}
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] tabular">
                      <div className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25">
                        <div className="text-[10px] text-rose-300">Baseline Survival</div>
                        <div className="font-semibold text-white mt-0.5">
                          T50 = Day {nodePredictiveMetrics.baselineT50}
                        </div>
                      </div>
                      <div className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                        <div className="text-[10px] text-emerald-300">
                          With Crew Re-Up
                        </div>
                        <div className="font-semibold text-emerald-300 mt-0.5">
                          T50 = Day {nodePredictiveMetrics.treatedT50} (+
                          {nodePredictiveMetrics.daysGained}d Lifespan)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Geographic Location & NBA Market */}
                {(node.dma_market || node.country) && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-gray-200">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm leading-none select-none">
                        {node.country_flag || "🇺🇸"}
                      </span>
                      <div className="truncate">
                        <span className="font-semibold text-white block truncate">
                          {node.dma_market || "Major NBA Market DMA"}
                        </span>
                        <span className="text-[11px] text-gray-400 block truncate">
                          {node.country || "United States"}{" "}
                          {node.country_code ? `(${node.country_code})` : ""}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shrink-0">
                      Verified Geo
                    </span>
                  </div>
                )}

                {/* 1. MyPLAYER Build Card */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-semibold">
                      MyPLAYER Build · Season 1
                    </span>
                    <span className="font-mono text-[11px] text-cyan-300">
                      {tel.platform || "PS5"} · {tel.rep_tier || "Starter II"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-xl font-bold font-mono text-white">
                        {tel.myplayer_ovr ?? 84}{" "}
                        <span className="text-[11px] font-mono uppercase text-[#E4002B]">
                          OVR
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-gray-200 mt-0.5">
                        {tel.myplayer_build || "2-Way 3-Level Threat"} ·{" "}
                        <span className="font-mono text-gray-400">
                          {tel.position || "PG"}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-right font-mono text-xs tabular">
                      <div>
                        <div className="text-[11px] text-gray-400">Badges</div>
                        <div className="font-semibold text-white">
                          {tel.badges_count ?? 22} / 53
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-400">Cap Breakers</div>
                        <div className="font-semibold text-amber-300">
                          +{tel.cap_breakers_unlocked ?? 1}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. VC Wallet & 90d VC Spend */}
                <div className="grid grid-cols-3 gap-2 font-mono tabular">
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="text-[11px] text-gray-400">VC Balance</div>
                    <div className="text-xs font-semibold text-amber-300 mt-0.5">
                      {(tel.vc_balance ?? 14500).toLocaleString()} VC
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="text-[11px] text-gray-400">90d VC</div>
                    <div className="text-xs font-semibold text-white mt-0.5">
                      ${Math.round(tel.vc_spend_90d ?? node.spend ?? 65)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="text-[11px] text-gray-400">Season Pass</div>
                    <div className="text-xs font-semibold text-cyan-300 mt-0.5 truncate">
                      {tel.season_pass_edition === "HALL_OF_FAME"
                        ? "HoF"
                        : tel.season_pass_edition || "PRO"}{" "}
                      · L{tel.season_pass_tier ?? 24}
                    </div>
                  </div>
                </div>

                {/* 3. MyTEAM Galaxy Opals & Park Telemetry */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-400">
                      MyTEAM &amp; Park Telemetry
                    </span>
                    <span className="font-mono text-[11px] text-gray-400">
                      Login: {tel.last_login_days_ago ?? 1}d ago
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs tabular">
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                      <div className="text-[11px] text-gray-400">Opals</div>
                      <div className="font-semibold text-amber-300 mt-0.5">
                        {tel.myteam_galaxy_opal_count ?? 0}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                      <div className="text-[11px] text-gray-400">Packs (30d)</div>
                      <div className="font-semibold text-white mt-0.5">
                        {tel.myteam_packs_opened_30d ?? 4}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                      <div className="text-[11px] text-gray-400">Win %</div>
                      <div className="font-semibold text-emerald-400 mt-0.5">
                        {tel.park_win_pct
                          ? `${Math.round(tel.park_win_pct * 100)}%`
                          : "54%"}
                      </div>
                    </div>
                  </div>

                  {/* 10-Segment Rage-Quit Index Bar */}
                  <div className="pt-0.5">
                    <div className="flex items-center justify-between font-mono text-[11px] tabular mb-1">
                      <span className="text-gray-400">
                        Rage-Quit ({tel.rage_quits_7d ?? 1} / 7d ·{" "}
                        {node.loss_streak ?? tel.loss_streak ?? 0}L)
                      </span>
                      <span className="text-pink-400 font-semibold">
                        {Math.round((node.tilt ?? 0.35) * 100)} / 100
                      </span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {Array.from({ length: 10 }, (_, idx) => {
                        const rageSegments = Math.min(
                          10,
                          Math.max(1, Math.round(Number(node.tilt ?? 0.35) * 10))
                        );
                        return (
                          <span
                            key={idx}
                            className={`h-2 rounded-sm ${
                              idx < rageSegments ? "bg-[#FF4D5E]" : "bg-white/10"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 4. NBA 2K26 Veteran & Cross-2K Bridge Status */}
                <div className="p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-amber-300 font-semibold">
                      2K26 Veteran &amp; Cross-2K Bridge
                    </span>
                    <span className="font-mono text-xs font-semibold tabular text-amber-300">
                      {Math.round(
                        Number(node.gravity_score ?? tel.gravity_score ?? 0.52) * 100
                      )}
                      % Gravity
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular">
                    <div className="rounded-lg border border-white/[0.08] bg-black/40 p-2">
                      <div className="text-[11px] text-gray-400">
                        NBA 2K26 History
                      </div>
                      <div className="font-semibold text-white mt-0.5">
                        {tel.nba2k26_veteran !== false
                          ? `Veteran · $${Math.round(
                              tel.nba2k26_spend_usd || (node.spend || 140) * 0.55
                            )}`
                          : "New in 2K27"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-black/40 p-2">
                      <div className="text-[11px] text-gray-400">
                        2K26 → 2K27 Status
                      </div>
                      <div
                        className={`font-semibold mt-0.5 ${
                          tel.migrated_to_2k27 === false
                            ? "text-amber-300"
                            : "text-emerald-400"
                        }`}
                      >
                        {tel.migrated_to_2k27 === false
                          ? "2K26 HOLDOUT"
                          : `${tel.cross_2k_titles || 2}x 2K TITLES`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4b. Crew & Creator Affinity */}
                {((node.followed_creators && node.followed_creators.length > 0) ||
                  node.primary_creator_influence ||
                  tel.crew_id) && (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-1">
                      <div className="flex items-center gap-1.5 text-white font-semibold text-[11px]">
                        <Radio className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Crew &amp; Creator Affinity</span>
                      </div>
                      {tel.crew_id && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          🛡️ {tel.crew_id}
                        </span>
                      )}
                    </div>
                    {node.followed_creators && node.followed_creators.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {node.followed_creators.map((cId, cIdx) => {
                          const creatorNode = (graphData?.nodes || []).find(
                            (n) => n.id === cId
                          );
                          const creatorName =
                            creatorNode?.name ||
                            cId.replace("creator-", "").toUpperCase();
                          const isPrimary = cId === node.primary_creator_influence;
                          return (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => {
                                if (creatorNode && onSelectNode) {
                                  onSelectNode(creatorNode);
                                }
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                isPrimary
                                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                                  : "bg-white/5 border-white/10 text-gray-300 hover:border-cyan-500/30"
                              }`}
                            >
                              <span>{isPrimary ? "⭐" : "📺"}</span>
                              <span>{creatorName}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 4c. 2K Unified Identity Spine Tree */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <IdentityTree
                    identities={
                      node.linked_identities && node.linked_identities.length > 0
                        ? node.linked_identities
                        : [
                            {
                              platform: "2K Account",
                              handle: node.name || node.id,
                              confidence_score: 0.99,
                            },
                            {
                              platform:
                                tel.platform === "XBOX"
                                  ? "Xbox Live"
                                  : tel.platform === "PC"
                                  ? "Steam"
                                  : "PlayStation Network",
                              handle: node.name || node.id,
                              confidence_score: 0.97,
                            },
                            {
                              platform: "NBA 2K Mobile ID",
                              handle: `${node.name || node.id}_2KM`,
                              confidence_score: 0.93,
                            },
                          ]
                    }
                    masterId={node.master_player_id || node.id}
                  />
                </div>

                {/* 4d. Verified In-Game Purchases & SKUs */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <div className="flex items-center gap-1.5 text-white font-semibold text-[11px]">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified 2K Purchases</span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {(node.spend || 0) >= 1000
                        ? "MyTEAM Whale"
                        : (node.spend || 0) >= 300
                        ? "High-Velocity VC"
                        : (node.spend || 0) >= 70
                        ? "Core 2K Loyalist"
                        : "Standard Edition"}
                    </span>
                  </div>

                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {(node.purchased_items && node.purchased_items.length > 0
                      ? node.purchased_items.filter((it) =>
                          /2k|vc|myteam|mycareer|wwe|pga|topspin|borderlands|civ|mafia|pass|pack|bundle|edition/i.test(
                            it.title || ""
                          )
                        )
                      : [
                          {
                            title: `${node.franchise || "NBA 2K27"} Hall of Fame Edition`,
                            price: (node.spend || 0) > 0 ? node.spend || 99.99 : 69.99,
                            date: "2026-09-04",
                            category: "2K Retail & VC Bundle",
                          },
                        ]
                    ).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5 text-[11px]"
                      >
                        <div className="flex items-center gap-2 truncate max-w-[195px]">
                          <PackageCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-white block font-medium truncate">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-gray-400 block truncate">
                              {item.category} · {item.date}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-emerald-400 font-semibold shrink-0 ml-2">
                          ${Number(item.price || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Playstyle & Behavioral Radar */}
                <PlaystyleRadar
                  spend={node.spend || 120}
                  churnRisk={node.churn_risk || 0.38}
                  tilt={node.tilt || 0.42}
                  archetype={String(node.archetype || "MYCAREER_STORY_CASUAL")}
                  telemetry={tel}
                />
              </div>
            )}
          </>
        )}

        {/* 1° · 2° · 3° INTERPERSONAL CO-PLAY GRAPH & SOCIAL MONETIZATION PLAYS */}
        {onExploreSocialHops && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#669DF6]" />
                <span className="text-[11px] font-semibold text-white">
                  1° · 2° · 3° Co-Play Social Graph
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                3-Hop Contagion
              </span>
            </div>

            {/* Interactive Hop Ring Filter Pills */}
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: "all" as const, label: "All 3°", color: "text-white" },
                  { id: "1" as const, label: "1° Squad", color: "text-emerald-400" },
                  { id: "2" as const, label: "2° Rivals", color: "text-purple-300" },
                  { id: "3" as const, label: "3° Weak", color: "text-amber-300" },
                ] as const
              ).map((hop) => {
                const isActive = activeHopFilter === hop.id;
                return (
                  <button
                    key={hop.id}
                    type="button"
                    onClick={() => {
                      setActiveHopFilter(hop.id);
                      onExploreSocialHops(
                        node?.type === "PLAYER" ? node.id : undefined,
                        hop.id
                      );
                    }}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-mono font-semibold border transition-all ${
                      isActive
                        ? "bg-white/15 border-white/30 text-white"
                        : `bg-black/40 border-white/[0.08] hover:border-white/20 ${hop.color}`
                    }`}
                  >
                    {hop.label}
                  </button>
                );
              })}
            </div>

            {/* 3 Research-Backed Interpersonal Monetization Triggers */}
            <div className="space-y-1.5 pt-0.5">
              {[
                {
                  degree: "1° Strong Tie",
                  badgeColor: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
                  title: "Squad Duo VC + Altruistic Gift Pass",
                  price: 9.99,
                  lift: "3.4x Co-Op Lift",
                  desc: "Mutual Rec/Park co-play utility + teammate boost token",
                  hop: "1" as const,
                },
                {
                  degree: "2° Friend-of-Squad",
                  badgeColor: "text-purple-300 bg-purple-500/15 border-purple-500/30",
                  title: "Rival OVR Status Catch-Up Bundle",
                  price: 14.99,
                  lift: "2.6x Status Lift",
                  desc: "Triggered when 2° lobby peers out-level player by +4 OVR",
                  hop: "2" as const,
                },
                {
                  degree: "3° Weak-Tie Bridge",
                  badgeColor: "text-amber-300 bg-amber-500/15 border-amber-500/30",
                  title: "Concordia Squad Migration Bounty",
                  price: 49.99,
                  lift: "2.1x Migration",
                  desc: "Pulls 3° NBA 2K26 holdouts via shared cross-crew bridges",
                  hop: "3" as const,
                },
              ].map((play) => (
                <div
                  key={play.degree}
                  className="rounded-lg bg-black/45 border border-white/[0.07] p-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold border ${play.badgeColor}`}
                    >
                      {play.degree}
                    </span>
                    <span className="text-[10px] font-mono text-white/75">
                      ${play.price.toFixed(2)} ·{" "}
                      <span className="text-emerald-400 font-semibold">
                        {play.lift}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-white truncate">
                        {play.title}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {play.desc}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveHopFilter(play.hop);
                        onExploreSocialHops(
                          node?.type === "PLAYER" ? node.id : undefined,
                          play.hop
                        );
                        if (onLaunchSocialPlay) {
                          onLaunchSocialPlay(play.title, play.price);
                        }
                      }}
                      className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-white shrink-0 transition-colors"
                    >
                      Test →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. FIXED ACTION FOOTER */}
      <div className="p-4 pt-3 space-y-2 border-t border-white/10 shrink-0 bg-[#0C0F17]/90">
        <div
          className={
            onFindGraphTwins ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-1"
          }
        >
          <button
            type="button"
            onClick={() => handleLaunchFocusGroup(node || undefined)}
            disabled={isFocusLoading}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-[#E4002B] text-white hover:bg-[#E4002B]/90 text-xs font-semibold shadow-lg transition-all disabled:opacity-70 active:scale-[0.98]"
          >
            {isFocusLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 courtside-Transfer-pulse text-white shrink-0" />
                <span className="truncate">Running...</span>
              </>
            ) : (
              <>
                <Target className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="truncate">
                  {onFindGraphTwins
                    ? "Launch Focus Group"
                    : isCohortView
                    ? "Test Cohort in Focus Group"
                    : isOffer
                    ? "Test Offer in Focus Group"
                    : "Launch Focus Group"}
                </span>
              </>
            )}
          </button>

          {onFindGraphTwins && (
            <button
              type="button"
              onClick={() => onFindGraphTwins(node || undefined)}
              disabled={isFindingTwins}
              title="Expand with 3,072-d ScaNN Graph Twins on the Graph Canvas"
              className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition-all disabled:opacity-60 active:scale-[0.98]"
            >
              {isFindingTwins ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300 shrink-0" />
                  <span className="truncate">Finding Twins...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span className="truncate">Graph Twins</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {onOpenCreativeStudio && (
            <button
              type="button"
              onClick={onOpenCreativeStudio}
              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white text-[11px] font-medium transition-all"
            >
              <Sliders className="w-3 h-3 text-amber-400" />
              <span>Studio</span>
            </button>
          )}
          {onSaveAudience && (
            <button
              type="button"
              onClick={onSaveAudience}
              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white text-[11px] font-medium transition-all"
            >
              <Bookmark className="w-3 h-3 text-emerald-400" />
              <span>Save</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onEmitA2A(node || undefined)}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white text-[11px] font-medium transition-all ${
              !onOpenCreativeStudio && !onSaveAudience ? "col-span-3" : ""
            }`}
          >
            <Send className="w-3 h-3 text-cyan-400" />
            <span>Brief</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </aside>
  );
}
