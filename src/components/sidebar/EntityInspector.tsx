"use client";

import React, { useState, useMemo } from "react";
import { GraphNode, GraphData, CohortContext, PlayerIdentity } from "@/lib/types";
import { archetypeLabel, archetypeColor } from "@/lib/archetypes";
import { summarizePlayers, playerStudio } from "@/lib/segment";
import { buildLensContext, classifyNodeForLens, computeKeystoneCaptains } from "@/lib/lens";
import { STUDIO_COLORS, STUDIO_NAMES, NBA_FRANCHISES, franchiseName } from "@/lib/studios";
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
    // Graph Twins seeds are drawn for context but are not part of the twin cohort.
    return (graphData?.nodes || []).filter(
      (n) => n.type === "PLAYER" && !n.game_telemetry?.twin_seed
    );
  }, [graphData]);

  // Segment analytics from the PLAYER nodes on the canvas (Spanner Players +
  // PLAYS_GAME). Server-side cohort aggregates (NL query) take precedence for
  // spend / churn because they cover every matched player, not only the drawn sample.
  const lensCtx = useMemo(() => buildLensContext(playerNodes), [playerNodes]);
  const keystoneIds = useMemo(
    () => computeKeystoneCaptains(graphData?.nodes || [], graphData?.links || []),
    [graphData]
  );
  const segment = useMemo(() => summarizePlayers(playerNodes), [playerNodes]);

  const cohortStats = useMemo(() => {
    const gravityBuckets = Array.from({ length: 10 }, () => 0);
    let gravityPlayers = 0;
    const creatorCounts: Record<string, number> = {};
    const countryCounts: Record<string, { count: number; flag: string }> = {};

    playerNodes.forEach((p) => {
      const gRaw = p.gravity_score ?? p.game_telemetry?.gravity_score;
      if (typeof gRaw === "number") {
        const b = Math.min(9, Math.max(0, Math.floor(gRaw * 10)));
        gravityBuckets[b]++;
        gravityPlayers++;
      }
      (p.followed_creators || []).forEach((c) => {
        const cName = c.replace("creator-", "").toUpperCase();
        creatorCounts[cName] = (creatorCounts[cName] || 0) + 1;
      });
      if (p.country) {
        if (!countryCounts[p.country]) {
          countryCounts[p.country] = { count: 0, flag: p.country_flag || "" };
        }
        countryCounts[p.country].count += 1;
      }
    });

    const archCounts: Record<string, number> = {};
    playerNodes.forEach((p) => {
      const arch = String(p.archetype || "");
      if (arch) archCounts[arch] = (archCounts[arch] || 0) + 1;
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

    const n = playerNodes.length;
    return {
      count: n,
      estimatedTotal: cohortContext?.estimatedTotal || cohortContext?.matchedCount || n,
      isSampled: cohortContext?.isSampled ?? false,
      avgSpend: cohortContext?.avgSpend ?? segment.avgSpend,
      avgOvr: segment.avgOvr,
      ovrPlayers: segment.ovrPlayers,
      avgChurn: cohortContext?.avgChurn ?? segment.avgChurn,
      avgTilt: cohortContext?.avgTilt ?? segment.avgTilt,
      highChurnCount: cohortContext?.highChurnCount ?? segment.highChurnCount,
      dominantArchetype:
        archetypeDistribution[0]?.id || cohortContext?.dominantArchetype || "",
      archetypeDistribution,
      gravityBuckets,
      gravityPlayers,
      topCreators: Object.entries(creatorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, pct: `${Math.round((count / Math.max(1, n)) * 100)}%` })),
      topCountries: Object.entries(countryCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 2)
        .map(([name, data]) => ({
          name,
          flag: data.flag,
          pct: `${Math.round((data.count / Math.max(1, n)) * 100)}%`,
        })),
    };
  }, [playerNodes, cohortContext, segment]);

  // 3-ring portfolio: same rules as the canvas lens (src/lib/lens.ts), scaled
  // from the drawn sample to the matched audience.
  const portfolioRings = useMemo(() => {
    let rawCore = 0;
    let rawNurture = 0;
    let rawStretch = 0;
    playerNodes.forEach((p) => {
      const cls = classifyNodeForLens(p, keystoneIds, "PORTFOLIO_RINGS", lensCtx);
      if (cls?.bucketId === "RING_3_STRETCH") rawStretch += 1;
      else if (cls?.bucketId === "RING_2_NURTURE") rawNurture += 1;
      else rawCore += 1;
    });
    const sampled = Math.max(1, rawCore + rawNurture + rawStretch);
    const totalEstimated = Math.max(playerNodes.length, cohortStats.estimatedTotal || 0);
    const scale = playerNodes.length ? totalEstimated / sampled : 0;
    const coreCount = Math.round(rawCore * scale);
    const nurtureCount = Math.round(rawNurture * scale);
    const stretchCount = Math.max(0, Math.round(rawStretch * scale));
    const corePct = Math.round((rawCore / sampled) * 100);
    const nurturePct = Math.round((rawNurture / sampled) * 100);
    const stretchPct = playerNodes.length ? Math.max(0, 100 - corePct - nurturePct) : 0;
    return { coreCount, nurtureCount, stretchCount, corePct, nurturePct, stretchPct };
  }, [playerNodes, keystoneIds, lensCtx, cohortStats.estimatedTotal]);

  // Decision segments: same CATE lens rules as the canvas. Dollar lift uses
  // only values stored on the player rows (2K telemetry); nothing is imputed.
  const decisionSummary = useMemo(() => {
    const totalEstimated = Math.max(playerNodes.length, cohortStats.estimatedTotal || 0);
    let rawPersuadable = 0;
    let rawCaptain = 0;
    let rawSureThing = 0;
    let rawSleepingDog = 0;
    let rawIncrementalLtv = 0;
    let rawMarginSaved = 0;
    let valuedPlayers = 0;
    const offerVotes: Record<string, { count: number; priceUsd: number }> = {};

    playerNodes.forEach((p) => {
      const pTel = p.game_telemetry || {};
      const cls = classifyNodeForLens(p, keystoneIds, "CATE_UPLIFT", lensCtx);
      if (cls?.bucketId === "SEED_CREW_CAPTAIN") rawCaptain += 1;
      else if (cls?.bucketId === "SURE_THING_D2C") rawSureThing += 1;
      else if (cls?.bucketId === "SLEEPING_DOG") rawSleepingDog += 1;
      else rawPersuadable += 1;

      if (typeof pTel.expected_incremental_ltv_usd === "number" || typeof pTel.margin_saved_usd === "number") {
        valuedPlayers += 1;
        if (cls?.bucketId === "PERSUADABLE" || cls?.bucketId === "SEED_CREW_CAPTAIN") {
          rawIncrementalLtv += Number(pTel.expected_incremental_ltv_usd || 0);
        } else {
          rawMarginSaved += Number(pTel.margin_saved_usd || 0);
        }
      }
      const offerTitle = pTel.recommended_offer_title;
      const offerPrice = Number(pTel.recommended_offer_price || 0);
      if (
        offerTitle &&
        offerPrice > 0 &&
        (cls?.bucketId === "PERSUADABLE" || cls?.bucketId === "SEED_CREW_CAPTAIN")
      ) {
        if (!offerVotes[offerTitle]) offerVotes[offerTitle] = { count: 0, priceUsd: offerPrice };
        offerVotes[offerTitle].count += 1;
      }
    });

    const scale = playerNodes.length ? totalEstimated / playerNodes.length : 0;
    const topOfferEntry = Object.entries(offerVotes).sort((a, b) => b[1].count - a[1].count)[0];
    return {
      persuadableCount: Math.round(rawPersuadable * scale),
      captainCount: Math.round(rawCaptain * scale),
      sureThingCount: Math.round(rawSureThing * scale),
      sleepingDogCount: Math.round(rawSleepingDog * scale),
      targetableCount: Math.round((rawPersuadable + rawCaptain) * scale),
      incrementalLtvUsd: Math.round(rawIncrementalLtv * scale),
      marginSavedUsd: Math.round(rawMarginSaved * scale),
      hasStoredValue: valuedPlayers > 0,
      topRecommendedOffer: topOfferEntry
        ? { title: topOfferEntry[0], priceUsd: topOfferEntry[1].priceUsd }
        : undefined,
    };
  }, [playerNodes, keystoneIds, lensCtx, cohortStats.estimatedTotal]);

  // Single-node stored metrics (crew, decision engine, survival). Every field
  // is read from the player's Spanner row or the live graph; when a value is
  // not stored it stays null and the panel that needs it is hidden.
  const nodePredictiveMetrics = useMemo(() => {
    if (!node || (node.type !== "PLAYER" && node.type !== "CLAN")) return null;

    const allNodes = graphData?.nodes || [];
    const allLinks = graphData?.links || [];
    const nodeTel = (node as any)?.game_telemetry || {};
    const numOrNull = (v: any): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;

    // Real crew mates on the canvas: nodes joined to the same crew by MEMBER_OF_CLAN.
    const crewIds = new Set<string>();
    if (node.type === "CLAN") crewIds.add(node.id);
    if (node.clan_id) crewIds.add(String(node.clan_id));
    if (nodeTel.crew_id) crewIds.add(String(nodeTel.crew_id));
    const idOf = (v: any) => (typeof v === "object" && v ? v.id : String(v));
    const mateIds = new Set<string>();
    allLinks.forEach((l: any) => {
      if (!String(l.label || "").startsWith("MEMBER_OF_CLAN")) return;
      const s = idOf(l.source);
      const t = idOf(l.target);
      if (crewIds.has(t) && s !== node.id) mateIds.add(s);
      if (crewIds.has(s) && t !== node.id) mateIds.add(t);
    });
    const crewMates = allNodes.filter(
      (n) => mateIds.has(n.id) && (n.type === "PLAYER" || n.type === "SQUADMATE")
    );

    const squadMateTags: string[] =
      Array.isArray(nodeTel.squad_mate_tags) && nodeTel.squad_mate_tags.length > 0
        ? nodeTel.squad_mate_tags
        : crewMates.slice(0, 4).map((m) =>
            typeof m.game_telemetry?.myplayer_ovr === "number"
              ? `${m.name} (${m.game_telemetry.myplayer_ovr} OVR)`
              : String(m.name)
          );

    const crewRole: string | null =
      node.crew_role || (typeof nodeTel.crew_role === "string" ? nodeTel.crew_role : null);
    const crewName: string | null =
      (typeof nodeTel.crew_name === "string" && nodeTel.crew_name) ||
      (node.type === "CLAN" ? node.name : null) ||
      (crewIds.size ? (allNodes.find((n) => crewIds.has(n.id))?.name ?? null) : null);

    const baselineT50 = numOrNull(nodeTel.survival_baseline_t50_days);
    const treatedT50 = numOrNull(nodeTel.survival_treated_t50_days);
    const storedDaysGained = numOrNull(nodeTel.survival_days_gained);

    return {
      // Crew / 5-stack (stored on 2K telemetry)
      squadVarUsd: numOrNull(nodeTel.squad_var_usd),
      squadSize: numOrNull(nodeTel.crew_size),
      active2k27Count: numOrNull(nodeTel.crew_active_2k27_mates),
      upgradeMultiplier: numOrNull(nodeTel.concordia_tipping_multiplier),
      isKeystoneCaptain:
        node.type === "CLAN" || crewRole === "CAPTAIN" || keystoneIds.has(node.id),
      crewName,
      crewRole,
      squadMateTags,
      crewMatesOnCanvas: crewMates.length,
      // Survival (stored only; no model is run in the browser)
      baselineT50,
      treatedT50,
      daysGained:
        storedDaysGained ?? (baselineT50 !== null && treatedT50 !== null ? treatedT50 - baselineT50 : null),
      crewHazardReductionPct: numOrNull(nodeTel.crew_hazard_reduction_pct),
      // Decision engine (stored only)
      upliftQuadrant: typeof nodeTel.uplift_quadrant === "string" ? nodeTel.uplift_quadrant : null,
      decisionAction: typeof nodeTel.decision_action === "string" ? nodeTel.decision_action : null,
      cateUpliftScore: numOrNull(nodeTel.cate_uplift_score),
      recommendedOfferTitle:
        typeof nodeTel.recommended_offer_title === "string" ? nodeTel.recommended_offer_title : null,
      recommendedOfferPrice: numOrNull(nodeTel.recommended_offer_price),
      expectedIncrementalLtvUsd: numOrNull(nodeTel.expected_incremental_ltv_usd),
      marginSavedUsd: numOrNull(nodeTel.margin_saved_usd),
    };
  }, [node, graphData?.nodes, graphData?.links, keystoneIds]);

  // Filtered players list for search & decision segment within cohort
  const filteredPlayers = useMemo(() => {
    const q = playerSearchQuery.trim().toLowerCase();
    return playerNodes
      .filter((p) => {
        const pTel = p.game_telemetry || {};
        if (decisionFilter !== "ALL") {
          const bucket = classifyNodeForLens(p, keystoneIds, "CATE_UPLIFT", lensCtx)?.bucketId;
          if (decisionFilter === "CAPTAIN" && bucket !== "SEED_CREW_CAPTAIN") return false;
          if (decisionFilter === "PERSUADABLE" && bucket !== "PERSUADABLE" && bucket !== "SEED_CREW_CAPTAIN") return false;
          if (decisionFilter === "SURE_THING" && bucket !== "SURE_THING_D2C") return false;
          if (decisionFilter === "SLEEPING_DOG" && bucket !== "SLEEPING_DOG") return false;
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
  }, [playerNodes, playerSearchQuery, decisionFilter, keystoneIds, lensCtx]);

  if (!node && playerNodes.length === 0 && !cohortContext) return null;

  const isOffer = node?.type === "OFFER";
  const isGame = node?.type === "GAME";
  const isPlayer = node?.type === "PLAYER";
  // Studio of the selected node. NBA 2K-only telemetry panels (MyPLAYER, VC,
  // MyTEAM, 2K26 bridge, crew 5-stack / survival models) render only for 2K.
  const selectedStudio = node ? playerStudio(node) : null;
  const is2KEntity = selectedStudio === "2K";
  const isCreator = node?.type === "CREATOR";
  const isClan = node?.type === "CLAN";
  const isSquadmate = node?.type === "SQUADMATE";
  const isIdentity = node?.type === "IDENTITY";
  const offerData = (node as any)?.offer_data;
  const tel = (node as any)?.game_telemetry || {};
  const creatorData = (node as any)?.creator_data;

  const isCohortView = !node;

  // ---- Stored-only single-node panels (hidden when the data is not stored) ----
  const npm = nodePredictiveMetrics;
  const hasCrewStored =
    !!npm && (npm.squadVarUsd !== null || npm.active2k27Count !== null || npm.squadMateTags.length > 0);
  const crewStoredBlock = npm && hasCrewStored ? (
    <div className="p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-amber-300">Crew value at risk</span>
        {npm.crewName && (
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 truncate max-w-[170px]">
            {npm.isKeystoneCaptain ? "Captain · " : ""}
            {npm.crewName}
          </span>
        )}
      </div>
      {(npm.squadVarUsd !== null || npm.active2k27Count !== null) && (
        <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular">
          {npm.squadVarUsd !== null && (
            <div className="p-2 rounded-lg bg-black/40 border border-white/10">
              <div className="text-[10px] text-gray-400">Squad value at risk (stored)</div>
              <div className="text-sm font-semibold text-amber-300 mt-0.5">
                ${Math.round(npm.squadVarUsd).toLocaleString()}
              </div>
              {npm.squadSize !== null && (
                <div className="text-[10px] text-gray-400">Crew size {npm.squadSize}</div>
              )}
            </div>
          )}
          {npm.active2k27Count !== null && (
            <div className="p-2 rounded-lg bg-black/40 border border-white/10">
              <div className="text-[10px] text-gray-400">Crew mates on NBA 2K27</div>
              <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                {npm.active2k27Count}
                {npm.squadSize !== null ? ` of ${npm.squadSize}` : ""}
              </div>
              {npm.upgradeMultiplier !== null && (
                <div className="text-[10px] text-cyan-300">
                  {npm.upgradeMultiplier}x stored upgrade multiplier
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {npm.squadMateTags.length > 0 && (
        <div className="pt-1 border-t border-white/5 space-y-1">
          <div className="text-[10px] text-gray-400 font-mono">Crew mates</div>
          <div className="flex flex-wrap gap-1">
            {npm.squadMateTags.slice(0, 4).map((tag, idx) => (
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
  ) : null;

  const survivalStoredBlock =
    npm && npm.baselineT50 !== null && npm.treatedT50 !== null ? (
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white">Median survival (stored model output)</span>
          {npm.crewHazardReductionPct !== null && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tabular">
              -{npm.crewHazardReductionPct}% crew hazard
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] tabular">
          <div className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25">
            <div className="text-[10px] text-rose-300">Baseline</div>
            <div className="font-semibold text-white mt-0.5">T50 = day {npm.baselineT50}</div>
          </div>
          <div className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
            <div className="text-[10px] text-emerald-300">With crew re-up</div>
            <div className="font-semibold text-emerald-300 mt-0.5">
              T50 = day {npm.treatedT50}
              {npm.daysGained !== null ? ` (+${npm.daysGained}d)` : ""}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  const decisionStoredBlock =
    npm && npm.upliftQuadrant ? (
      <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span>Next-best decision (stored)</span>
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-emerald-500/20 text-emerald-300 border-emerald-500/35">
            {(npm.decisionAction || npm.upliftQuadrant).replace(/_/g, " ")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular">
          {npm.recommendedOfferTitle && (
            <div className="p-2 rounded-lg bg-black/40 border border-white/10">
              <div className="text-[10px] text-gray-400">Recommended offer</div>
              <div className="text-[11px] font-semibold text-white mt-0.5 truncate">
                {npm.recommendedOfferTitle}
              </div>
              <div className="text-[10px] text-emerald-300">
                {npm.recommendedOfferPrice !== null ? `$${npm.recommendedOfferPrice.toFixed(2)}` : ""}
                {npm.cateUpliftScore !== null
                  ? `${npm.recommendedOfferPrice !== null ? " · " : ""}CATE ${npm.cateUpliftScore >= 0 ? "+" : ""}${Math.round(npm.cateUpliftScore * 100)}%`
                  : ""}
              </div>
            </div>
          )}
          {(npm.marginSavedUsd !== null || npm.expectedIncrementalLtvUsd !== null) && (
            <div className="p-2 rounded-lg bg-black/40 border border-white/10">
              <div className="text-[10px] text-gray-400">
                {npm.marginSavedUsd !== null && npm.marginSavedUsd > 0 ? "Margin protected" : "Expected incremental LTV"}
              </div>
              <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                {npm.marginSavedUsd !== null && npm.marginSavedUsd > 0
                  ? `+$${npm.marginSavedUsd.toFixed(2)}`
                  : npm.expectedIncrementalLtvUsd !== null
                  ? `+$${npm.expectedIncrementalLtvUsd.toFixed(2)}`
                  : ""}
              </div>
              <div className="text-[10px] text-gray-400">Quadrant: {npm.upliftQuadrant.replace(/_/g, " ")}</div>
            </div>
          )}
        </div>
      </div>
    ) : null;

  const expandButton =
    node && node.type === "PLAYER" && onExpandPlayerNeighborhood ? (
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
          {isExpandingNeighborhood ? "Expanding neighborhood..." : "Expand crew, identities & titles on graph"}
        </span>
      </button>
    ) : null;

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
                    ? cohortContext?.query || "Audience cohort"
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
                <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono text-gray-200 pb-0.5">
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

            {/* 2x2 KPI grid. Spend is lifetime USD across every Take-Two title;
                MyPLAYER OVR only exists for NBA 2K players, so other studios get a
                cross-studio metric instead of a fabricated OVR. */}
            <div className="grid grid-cols-2 gap-2 font-mono tabular" data-testid="segment-kpis" data-player-ids={playerNodes.map((n) => n.id).join(",")}>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Players</span>
                <span className="font-semibold text-white text-sm block mt-0.5">
                  {cohortStats.estimatedTotal.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Avg lifetime spend</span>
                <span className="font-semibold text-amber-300 text-sm block mt-0.5">
                  ${Math.round(cohortStats.avgSpend).toLocaleString()}
                </span>
              </div>
              {cohortStats.avgOvr !== null && cohortStats.ovrPlayers === playerNodes.length ? (
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[11px] text-gray-400 block">Avg MyPLAYER OVR</span>
                  <span className="font-semibold text-cyan-300 text-sm block mt-0.5">
                    {Math.round(cohortStats.avgOvr)} OVR
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[11px] text-gray-400 block">Play 2+ studios</span>
                  <span className="font-semibold text-cyan-300 text-sm block mt-0.5">
                    {playerNodes.length
                      ? `${Math.round((segment.crossStudioPlayers / playerNodes.length) * 100)}%`
                      : "n/a"}
                  </span>
                </div>
              )}
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Avg churn risk</span>
                <span className="font-semibold text-rose-400 text-sm block mt-0.5">
                  {Math.round(cohortStats.avgChurn * 100)}%
                </span>
              </div>
            </div>

            {/* Studio mix + per-title spend (PLAYS_GAME.spend_usd) */}
            {segment.studioMix.length > 0 && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2" data-testid="segment-studio-mix">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white">Studio mix</span>
                  <span className="font-mono text-[10px] text-gray-400">
                    {cohortStats.isSampled ? `sample of ${playerNodes.length.toLocaleString()}` : `${playerNodes.length.toLocaleString()} players`}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-black/50 gap-0.5">
                  {segment.studioMix.map((m) => (
                    <div
                      key={m.studio}
                      style={{ width: `${Math.max(2, m.pct)}%`, backgroundColor: STUDIO_COLORS[m.studio] }}
                      className="h-full"
                      title={`${STUDIO_NAMES[m.studio]}: ${m.players} (${m.pct}%)`}
                    />
                  ))}
                </div>
                <div className="space-y-0.5 font-mono text-[11px] tabular">
                  {segment.studioMix.map((m) => (
                    <div key={m.studio} className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 font-sans text-gray-200">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STUDIO_COLORS[m.studio] }} />
                        {STUDIO_NAMES[m.studio]}
                      </span>
                      <span className="text-gray-300">
                        {m.players.toLocaleString()} · {m.pct}% · avg ${Math.round(m.spend / Math.max(1, m.players)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                {segment.hasTitleSpend && segment.titleSpend.length > 0 && (
                  <div className="pt-1.5 border-t border-white/5 space-y-0.5">
                    <div className="text-[10px] text-gray-400">Spend by title (PLAYS_GAME.spend_usd)</div>
                    {segment.titleSpend.slice(0, 6).map((t) => (
                      <div key={t.franchise} className="flex items-center justify-between font-mono text-[11px] tabular">
                        <span className="inline-flex items-center gap-1.5 font-sans text-gray-200 truncate">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STUDIO_COLORS[t.studio] }} />
                          {t.name}
                        </span>
                        <span className="text-gray-300">
                          ${Math.round(t.spend).toLocaleString()} · {t.players} players
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {segment.wishlistedGta6 > 0 && (
                  <div className="pt-1 border-t border-white/5 flex items-center justify-between font-mono text-[11px] text-gray-300">
                    <span className="font-sans text-gray-400">Wishlisted GTA VI</span>
                    <span>
                      {segment.wishlistedGta6.toLocaleString()} ({Math.round((segment.wishlistedGta6 / Math.max(1, playerNodes.length)) * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Idea 2: 3-Ring Portfolio Segmentation Bar (Core Retain · Squad Nurture · Cross-2K Stretch) */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white">
                  3-Ring Portfolio Segmentation
                </span>
                <span className="font-mono text-[10px] text-gray-400">
                  {cohortStats.isSampled
                    ? `est. from sample of ${playerNodes.length.toLocaleString()}`
                    : "3-ring lens rules"}
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
                  title={`Cross-studio stretch: ${portfolioRings.stretchCount.toLocaleString()} (${portfolioRings.stretchPct}%)`}
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
                    Cross-studio
                  </div>
                  <div className="font-semibold text-white mt-0.5">
                    {portfolioRings.stretchCount.toLocaleString()}{" "}
                    <span className="text-[10px] text-cyan-300 font-normal">
                      ({portfolioRings.stretchPct}%)
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Live Decision Engine: CATE Uplift Quadrants, Margin Protection & 1-Click Cohort Pruning */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Decision segments (CATE lens)</span>
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tabular">
                  {decisionSummary.hasStoredValue
                    ? `+$${decisionSummary.incrementalLtvUsd.toLocaleString()} lift · $${decisionSummary.marginSavedUsd.toLocaleString()} saved`
                    : "No stored uplift $ for these players"}
                </span>
              </div>

              {cohortStats.isSampled && (
                <div className="font-mono text-[10px] text-gray-400">
                  Counts are estimated from the {playerNodes.length.toLocaleString()} players drawn, scaled to{" "}
                  {cohortStats.estimatedTotal.toLocaleString()} matched.
                </div>
              )}
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
                    {decisionSummary.topRecommendedOffer
                      ? `Top offer · ${decisionSummary.topRecommendedOffer.title}`
                      : "No stored offer for these players"}
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
                    Crew captains &amp; social hubs
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

            {/* 2K cross-title gravity histogram (stored on 2K player telemetry only) */}
            {cohortStats.gravityPlayers > 0 && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-300">
                  2K cross-title gravity ({cohortStats.gravityPlayers} 2K players)
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
            )}

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
                  const bucket = classifyNodeForLens(player, keystoneIds, "CATE_UPLIFT", lensCtx)?.bucketId;
                  const badge =
                    bucket === "SEED_CREW_CAPTAIN"
                      ? {
                          label: "CAPTAIN",
                          cls: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                        }
                      : bucket === "SURE_THING_D2C"
                      ? {
                          label: "HOLD",
                          cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                        }
                      : bucket === "SLEEPING_DOG"
                      ? {
                          label: "SUPPRESS",
                          cls: "bg-rose-500/20 text-rose-300 border-rose-500/30",
                        }
                      : {
                          label: "TARGET",
                          cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                        };
                  const rowStudio = playerStudio(player);

                  return (
                    <button
                      key={player.id || idx}
                      type="button"
                      onClick={() => onSelectNode?.(player)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-black/40 hover:bg-white/[0.06] border border-white/5 hover:border-cyan-500/30 text-left transition-all group"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[190px]">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: STUDIO_COLORS[rowStudio] }}
                          title={STUDIO_NAMES[rowStudio]}
                        />
                        <div className="truncate">
                          <span className="text-white block font-medium text-[11px] truncate group-hover:text-cyan-300 transition-colors">
                            {player.name}
                          </span>
                          <span className="text-[10.5px] text-gray-400 block truncate">
                            {pTel.myplayer_ovr
                              ? `${pTel.myplayer_ovr} OVR · ${
                                  pTel.crew_name || pTel.myplayer_build || ""
                                }`
                              : `${franchiseName(String(player.franchise || ""))} · ${archetypeLabel(player.archetype)}`}
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
                      {offerData?.category || offerData?.offer_type || ""}
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
                      {typeof creatorData?.followers === "number" ? formatFollowers(creatorData.followers) : "n/a"}
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      {creatorData?.platform || node.platform || "n/a"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Avg. Concurrents
                    </span>
                    <span className="font-semibold text-pink-400 text-sm font-mono block mt-0.5">
                      {typeof creatorData?.avg_stream_viewers === "number" ? formatFollowers(creatorData.avg_stream_viewers) : "n/a"}
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-0.5 truncate">
                      {creatorData?.signature_mode || "n/a"}
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
                            query: `Players who follow creator ${handle}`,
                            franchise: "ALL",
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
                      {selectedStudio ? STUDIO_NAMES[selectedStudio] : "Studio"} title
                    </span>
                    <span className="font-semibold text-white text-xs block mt-0.5">
                      {franchiseName(String(node.franchise || ""))}
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
                      {node.lifecycle_status || "Unknown"}
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
                  {node.lifecycle_status === "PRE_LAUNCH"
                    ? "Pre-launch title: no one plays it yet. Edges into this hub are WISHLISTED intent from Spanner."
                    : "Title hub in TakeTwoPlayerGraph. Edges into this hub are PLAYS_GAME (or cross-title play) from Spanner; select a player to inspect them."}
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
                      {node.rank_tier || "Unknown"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">Franchise</span>
                    <span className="font-semibold text-white text-xs block mt-0.5">
                      {franchiseName(String(node.franchise || ""))}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-xs text-gray-300">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                    <Users className="w-3.5 h-3.5" />
                    <span>{selectedStudio ? STUDIO_NAMES[selectedStudio] : ""} crew</span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Crew node (Spanner Clans). Edges are MEMBER_OF_CLAN with the member&apos;s role.
                  </p>
                </div>

                {crewStoredBlock}

                {survivalStoredBlock}
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
                      {node.platform || "n/a"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">
                      Match Confidence
                    </span>
                    <span className="font-semibold text-emerald-400 text-xs font-mono block mt-0.5">
                      {typeof node.confidence === "number" ? `${Math.round(node.confidence * 100)}%` : "n/a"}
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
                {decisionStoredBlock}
                {expandButton}

                {/* Idea 3 & Idea 2: 5-Stack Squad Value-at-Risk (VaR_crew) & Concordia Stag-Hunt Tipping Point */}
                {crewStoredBlock}

                {/* Idea 6: 30-Day Cox Proportional Hazards / Weibull Survival Curve S(t) & T50 */}
                {survivalStoredBlock}

                {/* Geographic Location & NBA Market */}
                {(node.dma_market || node.country) && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-gray-200">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm leading-none select-none">
                        {node.country_flag || ""}
                      </span>
                      <div className="truncate">
                        <span className="font-semibold text-white block truncate">
                          {node.dma_market || node.country}
                        </span>
                        <span className="text-[11px] text-gray-400 block truncate">
                          {node.country || ""}{" "}
                          {node.country_code ? `(${node.country_code})` : ""}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shrink-0">
                      Verified Geo
                    </span>
                  </div>
                )}

                {is2KEntity ? (
                <>
                {/* 2K telemetry: each tile renders only when the field is stored on the player row. */}
                {(() => {
                  const has = (k: string) => tel[k] !== undefined && tel[k] !== null;
                  const tiles: Array<{ label: string; value: string; tone?: string }> = [];
                  if (has("myplayer_ovr")) tiles.push({ label: "MyPLAYER OVR", value: `${tel.myplayer_ovr}`, tone: "text-white" });
                  if (has("myplayer_build")) tiles.push({ label: "Build", value: String(tel.myplayer_build) });
                  if (has("position")) tiles.push({ label: "Position", value: String(tel.position) });
                  if (has("rep_tier")) tiles.push({ label: "Rep tier", value: String(tel.rep_tier) });
                  if (has("badges_count")) tiles.push({ label: "Badges", value: `${tel.badges_count}` });
                  if (has("cap_breakers_unlocked")) tiles.push({ label: "Cap breakers", value: `${tel.cap_breakers_unlocked}` });
                  if (has("vc_balance")) tiles.push({ label: "VC balance", value: `${Number(tel.vc_balance).toLocaleString()} VC`, tone: "text-amber-300" });
                  if (has("vc_spend_90d")) tiles.push({ label: "VC spend 90d", value: `$${Math.round(Number(tel.vc_spend_90d)).toLocaleString()}` });
                  if (has("season_pass_edition")) tiles.push({ label: "Season pass", value: `${String(tel.season_pass_edition).replace(/_/g, " ")}${has("season_pass_tier") ? ` · L${tel.season_pass_tier}` : ""}` });
                  if (has("myteam_galaxy_opal_count")) tiles.push({ label: "Galaxy Opals", value: `${tel.myteam_galaxy_opal_count}` });
                  if (has("myteam_packs_opened_30d")) tiles.push({ label: "Packs (30d)", value: `${tel.myteam_packs_opened_30d}` });
                  if (has("park_win_pct")) tiles.push({ label: "Park win %", value: `${Math.round(Number(tel.park_win_pct) * 100)}%` });
                  if (has("rage_quits_7d")) tiles.push({ label: "Rage quits (7d)", value: `${tel.rage_quits_7d}` });
                  if (has("loss_streak") || typeof node.loss_streak === "number") tiles.push({ label: "Loss streak", value: `${node.loss_streak ?? tel.loss_streak}` });
                  if (has("last_login_days_ago")) tiles.push({ label: "Last login", value: `${tel.last_login_days_ago}d ago` });
                  if (has("platform")) tiles.push({ label: "Platform", value: String(tel.platform) });
                  if (has("nba2k26_veteran")) tiles.push({ label: "NBA 2K26 veteran", value: tel.nba2k26_veteran ? "Yes" : "No" });
                  if (has("nba2k26_spend_usd")) tiles.push({ label: "NBA 2K26 spend", value: `$${Math.round(Number(tel.nba2k26_spend_usd)).toLocaleString()}` });
                  if (has("migrated_to_2k27")) tiles.push({ label: "Moved to 2K27", value: tel.migrated_to_2k27 ? "Yes" : "No (holdout)" });
                  if (has("cross_2k_titles")) tiles.push({ label: "2K titles played", value: `${tel.cross_2k_titles}` });
                  if (has("gravity_score")) tiles.push({ label: "Cross-2K gravity", value: `${Math.round(Number(tel.gravity_score) * 100)}%` });
                  if (tiles.length === 0) return null;
                  return (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2" data-testid="twok-telemetry">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white">2K telemetry</span>
                        <span className="font-mono text-[11px] text-gray-400">{franchiseName(String(node.franchise || ""))}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] tabular">
                        {tiles.map((t) => (
                          <div key={t.label} className="p-1.5 rounded-lg bg-black/40 border border-white/5 min-w-0">
                            <div className="text-[10px] text-gray-400 font-sans truncate">{t.label}</div>
                            <div className={`font-semibold truncate ${t.tone || "text-gray-100"}`}>{t.value}</div>
                          </div>
                        ))}
                      </div>
                      {node.title_spend && Object.keys(node.title_spend).length > 0 && (
                        <div className="pt-1.5 border-t border-white/5 space-y-0.5">
                          <div className="text-[10px] text-gray-400">Spend by title (PLAYS_GAME.spend_usd)</div>
                          {Object.entries(node.title_spend)
                            .sort((a, b) => Number(b[1]) - Number(a[1]))
                            .map(([f, v]) => (
                              <div key={f} className="flex items-center justify-between font-mono text-[11px] tabular">
                                <span className="font-sans text-gray-200">{franchiseName(f)}</span>
                                <span className="text-amber-300">${Number(v).toFixed(2)}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                </>
                ) : (
                  /* Rockstar Games / Zynga player: show only telemetry stored on the Spanner row. */
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2" data-testid="studio-telemetry">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white">
                        {selectedStudio ? STUDIO_NAMES[selectedStudio] : ""} telemetry
                      </span>
                      <span className="font-mono text-[11px] text-gray-400">
                        {franchiseName(String(node.franchise || ""))}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] tabular">
                      {(
                        [
                          ["gtao_rank", "GTA Online rank"],
                          ["heists_completed_30d", "Heists (30d)"],
                          ["owned_businesses", "Businesses owned"],
                          ["gta_plus_member", "GTA+ member"],
                          ["rdo_role", "Red Dead role"],
                          ["zynga_daily_streak", "Daily streak"],
                          ["games_started_30d", "Games started (30d)"],
                          ["ad_views_30d", "Ad views (30d)"],
                          ["iap_spend_90d", "IAP spend 90d ($)"],
                          ["hours_played", "Hours played"],
                          ["last_login_days_ago", "Last login (days)"],
                          ["platform", "Platform"],
                          ["gta6_wishlisted", "GTA VI wishlisted"],
                        ] as Array<[string, string]>
                      )
                        .filter(([k]) => tel[k] !== undefined && tel[k] !== null)
                        .map(([k, label]) => (
                          <div key={k} className="p-1.5 rounded-lg bg-black/40 border border-white/5">
                            <div className="text-[10px] text-gray-400 font-sans">{label}</div>
                            <div className="text-white font-semibold truncate">
                              {typeof tel[k] === "boolean" ? (tel[k] ? "Yes" : "No") : String(tel[k])}
                            </div>
                          </div>
                        ))}
                    </div>
                    {node.title_spend && Object.keys(node.title_spend).length > 0 && (
                      <div className="pt-1.5 border-t border-white/5 space-y-0.5">
                        <div className="text-[10px] text-gray-400">Spend by title (PLAYS_GAME.spend_usd)</div>
                        {Object.entries(node.title_spend)
                          .sort((a, b) => Number(b[1]) - Number(a[1]))
                          .map(([f, v]) => (
                            <div key={f} className="flex items-center justify-between font-mono text-[11px] tabular">
                              <span className="font-sans text-gray-200">{franchiseName(f)}</span>
                              <span className="text-amber-300">${Number(v).toFixed(2)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                    {node.wishlisted && node.wishlisted.length > 0 && (
                      <div className="pt-1 border-t border-white/5 text-[11px] text-gray-300">
                        Wishlisted: {node.wishlisted.map((f) => franchiseName(f)).join(", ")}
                      </div>
                    )}
                    {node.crew_role && (
                      <div className="text-[11px] text-gray-300">
                        Crew role: <span className="font-mono text-white">{node.crew_role}</span>
                      </div>
                    )}
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
                        className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] border border-white/15 text-gray-100 font-mono text-[10.5px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {isExpandingNeighborhood
                            ? "Expanding neighborhood..."
                            : "Expand crew, identities & titles on graph"}
                        </span>
                      </button>
                    )}
                  </div>
                )}

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
                          {tel.crew_id}
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
                              <span>{creatorName}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 4c. Linked identities: from the player row or HAS_IDENTITY edges on the canvas */}
                {(() => {
                  const idOf = (v: any) => (typeof v === "object" && v ? v.id : String(v));
                  const fromCanvas = (graphData?.links || [])
                    .filter((l: any) => idOf(l.source) === node.id)
                    .map((l: any) => (graphData?.nodes || []).find((n) => n.id === idOf(l.target)))
                    .filter((n): n is GraphNode => !!n && n.type === "IDENTITY")
                    .map((n) => ({
                      platform: String(n.platform || ""),
                      handle: String(n.name || "").split(": ").slice(1).join(": ") || n.id,
                      confidence_score: Number(n.confidence),
                    }));
                  const identities =
                    node.linked_identities && node.linked_identities.length > 0
                      ? node.linked_identities
                      : fromCanvas;
                  if (identities.length === 0) return null;
                  return (
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <IdentityTree identities={identities} masterId={node.master_player_id || node.id} />
                    </div>
                  );
                })()}

                {/* 4d. Purchases stored on the player row (purchased_items) */}
                {node.purchased_items && node.purchased_items.length > 0 && (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-1">
                      <div className="flex items-center gap-1.5 text-white font-semibold text-[11px]">
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Purchases</span>
                      </div>
                      <span className="text-[11px] font-mono text-gray-400">
                        {node.purchased_items.length} items · $
                        {node.purchased_items.reduce((a, it) => a + Number(it.price || 0), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {node.purchased_items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5 text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate max-w-[195px]">
                            <PackageCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <div className="truncate">
                              <span className="text-white block font-medium truncate">{item.title}</span>
                              <span className="text-[11px] text-gray-400 block truncate">
                                {[item.category, item.date].filter(Boolean).join(" · ")}
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
                )}

                {/* 5. Playstyle & Behavioral Radar */}
                <PlaystyleRadar
                  spend={node.spend as number}
                  churnRisk={node.churn_risk as number}
                  tilt={node.tilt as number}
                  archetype={String(node.archetype || "")}
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
                  1° · 2° · 3° social graph
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                PLAYED_WITH · FRIENDS_WITH · INVITED
              </span>
            </div>

            {/* Interactive Hop Ring Filter Pills */}
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: "all" as const, label: "All 3°", color: "text-white" },
                  { id: "1" as const, label: "1° ties", color: "text-emerald-400" },
                  { id: "2" as const, label: "2° ties", color: "text-purple-300" },
                  { id: "3" as const, label: "3° ties", color: "text-amber-300" },
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
              title="Find the most similar players (live cosine similarity over all players in Spanner)"
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
