"use client";

import React, { useState, useMemo } from "react";
import { GraphNode, GraphData, CohortContext } from "@/lib/types";
import { archetypeLabel } from "@/lib/archetypes";
import { formatFollowers } from "@/lib/format";
import PlaystyleRadar from "./PlaystyleRadar";
import {
  X,
  User,
  ArrowUpRight,
  Users,
  ShoppingBag,
  Gamepad2,
  Zap,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  Award,
  Loader2,
  PackageCheck,
  Receipt,
  MapPin,
  Sparkles,
  Video,
  Radio,
  Flame,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Search,
  SlidersHorizontal,
} from "lucide-react";

interface EntityInspectorProps {
  node: GraphNode | null;
  /** Shared shape — see CohortContext in @/lib/types. Partial because the
   *  inspector can render before a cohort query has run. */
  cohortContext?: Partial<CohortContext> | null;
  graphData?: GraphData;
  onSelectNode?: (node: GraphNode | null) => void;
  onClose: () => void;
  onLaunchDeepSona: (node?: GraphNode) => void;
  onEmitA2A: (node?: GraphNode) => void;
  isDeepSonaLoading?: boolean;
}

export default function EntityInspector({
  node,
  cohortContext,
  graphData,
  onSelectNode,
  onClose,
  onLaunchDeepSona,
  onEmitA2A,
  isDeepSonaLoading = false,
}: EntityInspectorProps) {
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  // Extract all player nodes from current graph data
  const playerNodes = useMemo(() => {
    return (graphData?.nodes || []).filter((n) => n.type === "PLAYER");
  }, [graphData]);

  // Compute cohort averages
  const cohortStats = useMemo(() => {
    if (playerNodes.length === 0) {
      return {
        count: cohortContext?.matchedCount || 0,
        estimatedTotal: cohortContext?.estimatedTotal || 0,
        avgSpend: cohortContext?.avgSpend || 850,
        avgChurn: cohortContext?.avgChurn || 0.45,
        avgTilt: cohortContext?.avgTilt || 0.65,
        avgLossStreak: 2.1,
        dominantArchetype: cohortContext?.dominantArchetype || "COMPETITIVE_GRINDER",
        topCreators: [
          { name: "SCUMP", pct: "48%" },
          { name: "TIMTHETATMAN", pct: "36%" },
        ],
        topCountries: [{ name: "United Kingdom", flag: "🇬🇧", pct: "58%" }],
      };
    }

    const totalSpend = playerNodes.reduce((acc, p) => acc + (p.spend || 0), 0);
    const totalChurn = playerNodes.reduce((acc, p) => acc + (p.churn_risk || 0), 0);
    const totalTilt = playerNodes.reduce((acc, p) => acc + (p.tilt || 0), 0);
    const totalLossStreak = playerNodes.reduce((acc, p) => acc + (p.loss_streak || 0), 0);

    const archCounts: Record<string, number> = {};
    const creatorCounts: Record<string, number> = {};
    const countryCounts: Record<string, { count: number; flag: string }> = {};

    playerNodes.forEach((p) => {
      if (p.archetype) archCounts[p.archetype] = (archCounts[p.archetype] || 0) + 1;
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

    const dominantArch =
      Object.entries(archCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      cohortContext?.dominantArchetype ||
      "COMPETITIVE_GRINDER";

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
      // True cohort size when a query supplied it; otherwise just what is drawn.
      // Never extrapolate from the rendered node count.
      estimatedTotal: cohortContext?.estimatedTotal || playerNodes.length,
      isSampled: cohortContext?.isSampled ?? false,
      avgSpend: cohortContext?.avgSpend ?? totalSpend / playerNodes.length,
      avgChurn: cohortContext?.avgChurn ?? totalChurn / playerNodes.length,
      avgTilt: totalTilt / playerNodes.length,
      avgLossStreak: totalLossStreak / playerNodes.length,
      dominantArchetype: dominantArch,
      topCreators,
      topCountries,
    };
  }, [playerNodes, cohortContext]);

  // Filtered players list for search within cohort
  const filteredPlayers = useMemo(() => {
    if (!playerSearchQuery.trim()) return playerNodes;
    const q = playerSearchQuery.toLowerCase();
    return playerNodes.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.country && p.country.toLowerCase().includes(q)) ||
        (p.dma_market && p.dma_market.toLowerCase().includes(q)) ||
        (p.archetype && p.archetype.toLowerCase().includes(q))
    );
  }, [playerNodes, playerSearchQuery]);

  // If no node is selected and no cohort data exists, return null
  if (!node && playerNodes.length === 0 && !cohortContext) return null;

  // Single Node Type Flags
  const isOffer = node?.type === "OFFER";
  const isGame = node?.type === "GAME";
  const isPlayer = node?.type === "PLAYER";
  const isCreator = node?.type === "CREATOR";
  const offerData = (node as any)?.offer_data;
  const gameMeta = (node as any)?.game_telemetry;
  const creatorData = (node as any)?.creator_data;

  // If node is null, we render the Cohort Intelligence View!
  const isCohortView = !node;

  return (
    <div className="absolute top-16 right-6 z-30 w-[410px] apple-glass-heavy rounded-3xl p-5 space-y-4 animate-spring-in font-sans text-xs max-h-[88vh] overflow-y-auto shadow-2xl border border-white/10">
      {/* 1. TOP NAVIGATION / BREADCRUMB */}
      {!isCohortView && playerNodes.length > 0 && (
        <button
          onClick={() => onSelectNode?.(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-cyan-300 text-[11px] font-medium transition-all group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Cohort Overview ({playerNodes.length} Players)</span>
        </button>
      )}

      {/* 2. HEADER */}
      <div className="flex items-start justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white shrink-0 ${
              isCohortView
                ? "bg-gradient-to-br from-cyan-500/25 to-purple-500/25 border border-cyan-500/30 text-cyan-300 shadow-lg"
                : isOffer
                ? "bg-gradient-to-br from-amber-500/20 to-pink-500/20 border border-pink-500/30 text-pink-300"
                : isCreator
                ? "bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-cyan-500/30 text-cyan-300 shadow-md"
                : isGame
                ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                : "bg-white/10 text-white"
            }`}
          >
            {isCohortView ? (
              <Users className="w-4 h-4 text-cyan-300" />
            ) : isOffer ? (
              <ShoppingBag className="w-4 h-4" />
            ) : isCreator ? (
              <Sparkles className="w-4 h-4 text-cyan-300" />
            ) : isGame ? (
              <Gamepad2 className="w-4 h-4" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>

          <div className="truncate">
            <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="truncate max-w-[210px]">
                {isCohortView ? (cohortContext?.query || "Synthesized Audience Cohort") : node?.name}
              </span>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                  isCohortView
                    ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                    : isOffer
                    ? "bg-pink-500/10 border border-pink-500/20 text-pink-400"
                    : isCreator
                    ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                    : isGame
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-white/10 text-gray-300"
                }`}
              >
                {isCohortView ? "ACTIVE COHORT" : isOffer ? "STORE ITEM" : isCreator ? "CREATOR" : node?.type}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
              {isCohortView
                ? cohortStats.isSampled
                  ? `${cohortStats.estimatedTotal.toLocaleString()} players matched • showing ${cohortStats.count}`
                  : `${cohortStats.estimatedTotal.toLocaleString()} players matched`
                : `${node?.franchise ? `${node.franchise} • ` : ""}${node?.id}`}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 3. COHORT INTELLIGENCE VIEW (When no single node is clicked) */}
      {isCohortView && (
        <div className="space-y-3.5">
          {/* Top KPI Cards (Cohort Averages) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 block uppercase font-medium">Dominant Playstyle</span>
              <span className="font-semibold text-cyan-300 text-xs truncate block mt-0.5">
                {cohortStats.dominantArchetype}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 block uppercase font-medium">Avg Lifetime Spend</span>
              <span className="font-semibold text-amber-300 text-xs font-mono block mt-0.5">
                {`$${cohortStats.avgSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
              <span className="text-[9px] text-gray-400 block mt-0.5">
                {`Cohort LTV: $${(cohortStats.avgSpend * cohortStats.estimatedTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </span>
            </div>
          </div>

          {/* Aggregated Cohort Telemetry Box */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-1">
              <span className="text-gray-400 font-semibold uppercase text-[10px]">Cohort Aggregated Telemetry</span>
              <span className="text-emerald-400 font-mono text-[10px]">Cloud Spanner Property Graph</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[9px] text-gray-400 block uppercase">Avg Tilt</span>
                <span className="text-pink-400 font-semibold text-xs mt-0.5 block">
                  {Math.round(cohortStats.avgTilt * 100)}%
                </span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[9px] text-gray-400 block uppercase">Avg Churn</span>
                <span className="text-amber-400 font-semibold text-xs mt-0.5 block">
                  {Math.round(cohortStats.avgChurn * 100)}%
                </span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[9px] text-gray-400 block uppercase">Loss Slump</span>
                <span className="text-purple-300 font-semibold text-xs mt-0.5 block">
                  {cohortStats.avgLossStreak.toFixed(1)} Matches
                </span>
              </div>
            </div>

            {/* Dominant Geographic Distribution */}
            {cohortStats.topCountries.length > 0 && (
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
                <span className="text-gray-400">Primary Geographic Reach:</span>
                <div className="flex items-center gap-1.5 font-medium text-white">
                  <span>{cohortStats.topCountries[0].flag}</span>
                  <span>{cohortStats.topCountries[0].name}</span>
                  <span className="text-cyan-300 font-mono text-[10px]">({cohortStats.topCountries[0].pct})</span>
                </div>
              </div>
            )}
          </div>

          {/* Top Creator Influence Gravity */}
          {cohortStats.topCreators.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between border-b border-white/5 pb-1">
                <div className="flex items-center gap-1.5 text-white font-semibold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Creator Network Gravity</span>
                </div>
                <span className="text-[9px] font-mono text-gray-400">Follower Share</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cohortStats.topCreators.map((creator, cIdx) => (
                  <div
                    key={cIdx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[10px] font-semibold"
                  >
                    <span>⭐</span>
                    <span>{creator.name}</span>
                    <span className="text-[9px] font-mono text-cyan-200/70">({creator.pct})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Cohort Players Roster */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <div className="flex items-center gap-1.5 text-white font-semibold text-[11px]">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sampled Cohort Players ({playerNodes.length})</span>
              </div>
              <span className="text-[9px] text-gray-400">Click to Inspect</span>
            </div>

            {/* Quick Player Filter */}
            {playerNodes.length > 6 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={playerSearchQuery}
                  onChange={(e) => setPlayerSearchQuery(e.target.value)}
                  placeholder="Filter players in cohort..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-[11px] outline-none focus:border-cyan-500/50"
                />
              </div>
            )}

            {/* Scrollable Player List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredPlayers.map((player, idx) => (
                <button
                  key={player.id || idx}
                  onClick={() => onSelectNode?.(player)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-black/40 hover:bg-white/[0.06] border border-white/5 hover:border-cyan-500/30 text-left transition-all group"
                >
                  <div className="flex items-center gap-2 truncate max-w-[240px]">
                    <span className="text-sm select-none shrink-0">
                      {player.country_flag || "👤"}
                    </span>
                    <div className="truncate">
                      <span className="text-white block font-medium text-[11px] truncate group-hover:text-cyan-300 transition-colors">
                        {player.name}
                      </span>
                      <span className="text-[9px] text-gray-400 block truncate">
                        {player.dma_market || "Global"} • Loss Streak: {player.loss_streak || 0}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="font-mono text-amber-300 font-semibold text-[11px]">
                      $${(player.spend || 0).toFixed(0)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-300 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cohort Averages Playstyle & Behavioral Profile */}
          <PlaystyleRadar
            spend={cohortStats.avgSpend}
            churnRisk={cohortStats.avgChurn}
            tilt={cohortStats.avgTilt}
            archetype={cohortStats.dominantArchetype}
          />
        </div>
      )}

      {/* 4. SINGLE ENTITY VIEWS (When a specific node is clicked) */}
      {!isCohortView && node && (
        <>
          {/* A. Content for In-Game Purchasable Monetization Nodes */}
          {isOffer && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Store Price</span>
                  <span className="font-semibold text-emerald-400 text-base font-mono block mt-0.5">
                    {/* Was `$${node.spend?.toFixed(2) || "4.99"}` — the doubled
                        `$$` rendered every price as "$$99.99", and the fallback
                        invented a price for any offer missing one. */}
                    {typeof node.spend === "number" ? `$${node.spend.toFixed(2)}` : "—"}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    {offerData?.category || "Monetization SKU"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Conversion Lift</span>
                  <span className="font-semibold text-cyan-400 text-base font-mono block mt-0.5">
                    {/* Now a number (percentage points) rather than the old
                        "+24.8%" string, which was also the hardcoded fallback
                        shown whenever the real value was missing. */}
                    {typeof offerData?.expected_conversion_boost === "number"
                      ? `+${offerData.expected_conversion_boost.toFixed(1)}%`
                      : "—"}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    Modelled uplift
                  </span>
                </div>
              </div>

              {offerData?.affinity_archetype && (
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Best Fit Archetype</span>
                  <span className="font-semibold text-pink-400 text-xs font-mono block mt-0.5">
                    {archetypeLabel(offerData.affinity_archetype)}
                  </span>
                </div>
              )}

              {offerData?.description && (
                <p className="text-[11px] text-gray-300 p-3 rounded-2xl bg-white/[0.02] border border-white/5 leading-relaxed">
                  {offerData.description}
                </p>
              )}
            </div>
          )}

          {/* B. Content for Content Creator Nodes */}
          {isCreator && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                  <span className="text-[10px] text-cyan-300 block uppercase font-medium">Follower Reach</span>
                  <span className="font-semibold text-white text-base font-mono block mt-0.5">
                    {/* Was `creatorData?.subscribers || "1.2M+"`. No creator
                        record has a `subscribers` field, so every creator in
                        the demo displayed the same invented 1.2M+ figure —
                        including Scump, who has 3.2M. */}
                    {formatFollowers(creatorData?.followers)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    {creatorData?.platform || "—"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Avg. Concurrents</span>
                  {/* Was `creatorData?.primary_archetype`, which creators do
                      not have, so this always fell back to a constant. Average
                      stream viewership is a field that actually exists and is
                      the more useful number for a media buy. */}
                  <span className="font-semibold text-pink-400 text-base font-mono block mt-0.5">
                    {formatFollowers(creatorData?.avg_stream_viewers)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    {creatorData?.signature_mode || "—"}
                  </span>
                </div>
              </div>

              {typeof creatorData?.conversion_affinity === "number" && (
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Conversion Affinity</span>
                  <span className="font-semibold text-emerald-400 text-base font-mono block mt-0.5">
                    {(creatorData.conversion_affinity * 100).toFixed(0)}%
                  </span>
                </div>
              )}

              {creatorData?.sponsorship_angle && (
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Co-Branded LiveOps Activation Concept</span>
                  </div>
                  <p className="text-[11px] text-gray-300 font-mono leading-relaxed bg-black/50 p-2.5 rounded-xl border border-white/5">
                    {creatorData.sponsorship_angle}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* C. Content for Game Mode Nodes */}
          {isGame && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Franchise</span>
                  {/* The fallback here used to name a franchise that is not in the catalog — a
                      leftover the reskin audit missed because it does not
                      contain any of the searched brand terms. */}
                  <span className="font-semibold text-white text-xs block mt-0.5">
                    {node.franchise || "—"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Lifecycle</span>
                  <span
                    className={`font-semibold text-xs font-mono block mt-0.5 ${
                      node.lifecycle_status === "LIVE"
                        ? "text-emerald-400"
                        : node.lifecycle_status === "UPCOMING"
                        ? "text-purple-400"
                        : node.lifecycle_status === "SUNSET"
                        ? "text-alert-red"
                        : "text-gray-400"
                    }`}
                  >
                    {node.lifecycle_status || "—"}
                  </span>
                </div>
              </div>

              {node.current_season && (
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Current Season</span>
                  <span className="font-semibold text-white text-xs block mt-0.5">
                    {node.current_season}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* D. Content for Player Nodes */}
          {isPlayer && (
            <>
              {/* Top Metrics */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Playstyle</span>
                  <span className="font-semibold text-white text-xs truncate block mt-0.5">
                    {node.archetype || "GENERAL_PLAYER"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-gray-500 block uppercase">Lifetime Spend</span>
                  <span className="font-semibold text-amber-300 text-xs font-mono block mt-0.5">
                    $${node.spend?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>

              {/* Geographic Location & DMA Market */}
              {(node.dma_market || node.country) && (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-[11px] text-gray-200">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none select-none">
                      {node.country_flag || (node.country === "United Kingdom" ? "🇬🇧" : node.country === "Germany" ? "🇩🇪" : node.country === "France" ? "🇫🇷" : node.country === "Spain" ? "🇪🇸" : node.country === "Brazil" ? "🇧🇷" : node.country === "Japan" ? "🇯🇵" : node.country === "Saudi Arabia" ? "🇸🇦" : node.country === "Canada" ? "🇨🇦" : node.country === "Mexico" ? "🇲🇽" : node.country === "Italy" ? "🇮🇹" : "🇺🇸")}
                    </span>
                    <div className="truncate">
                      <span className="font-semibold text-white block truncate">
                        {node.dma_market || "Major Metropolitan DMA"}
                      </span>
                      <span className="text-[10px] text-gray-400 block truncate">
                        {node.country || "United States"} {node.country_code ? `(${node.country_code})` : ""}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                    Verified Geo
                  </span>
                </div>
              )}

              {/* Creator Affiliations */}
              {node.followed_creators && node.followed_creators.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <div className="flex items-center gap-1.5 text-white font-semibold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Creator & Influencer Affinities</span>
                    </div>
                    <span className="text-[9px] font-mono text-gray-400">
                      {node.followed_creators.length} Linked Creators
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {node.followed_creators.map((cId, cIdx) => {
                      const creatorName = cId.replace("creator-", "").toUpperCase();
                      const isPrimary = cId === node.primary_creator_influence;
                      return (
                        <span
                          key={cIdx}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold border ${
                            isPrimary
                              ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                              : "bg-white/5 border-white/10 text-gray-300"
                          }`}
                        >
                          <span>{isPrimary ? "⭐" : "📺"}</span>
                          <span>{creatorName}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Game-Specific Telemetry Box */}
              {gameMeta && (
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] border-b border-white/5 pb-1 mb-1">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">Game Telemetry:</span>
                    <span className="text-emerald-400 font-mono">{node.franchise}</span>
                  </div>
                  {gameMeta.rank_tier && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Rank Tier:</span>
                      <span className="text-white font-medium">{gameMeta.rank_tier}</span>
                    </div>
                  )}
                  {gameMeta.kd_ratio && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">K/D Ratio:</span>
                      <span className="text-amber-300 font-mono">{gameMeta.kd_ratio}</span>
                    </div>
                  )}
                  {gameMeta.gulag_win_rate !== undefined && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Gulag Win Rate:</span>
                      <span className="text-emerald-300 font-mono">{Math.round(gameMeta.gulag_win_rate * 100)}%</span>
                    </div>
                  )}
                  {gameMeta.main_loadout && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Main Loadout:</span>
                      <span className="text-cyan-300">{gameMeta.main_loadout}</span>
                    </div>
                  )}
                  {gameMeta.character_class && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Character Class:</span>
                      <span className="text-yellow-300 font-medium">{gameMeta.character_class}</span>
                    </div>
                  )}
                  {gameMeta.raid_progression && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Raid Progression:</span>
                      <span className="text-purple-300 font-mono">{gameMeta.raid_progression}</span>
                    </div>
                  )}
                  {gameMeta.pit_tier !== undefined && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Pit Tier:</span>
                      <span className="text-rose-300 font-mono">Tier {gameMeta.pit_tier}</span>
                    </div>
                  )}
                  {gameMeta.main_hero && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Main Hero:</span>
                      <span className="text-cyan-300 font-medium">{gameMeta.main_hero}</span>
                    </div>
                  )}
                  {gameMeta.current_level !== undefined && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Current Level:</span>
                      <span className="text-pink-300 font-mono">Level {gameMeta.current_level}</span>
                    </div>
                  )}
                  {gameMeta.primary_playstyle && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Playstyle:</span>
                      <span className="text-purple-300">{gameMeta.primary_playstyle}</span>
                    </div>
                  )}
                  {node.loss_streak !== undefined && node.loss_streak > 0 && (
                    <div className="flex justify-between text-[11px] text-pink-400">
                      <span>Recent Defeats:</span>
                      <span className="font-mono">{node.loss_streak} Match Streak</span>
                    </div>
                  )}
                </div>
              )}

              {/* Verified In-Game Purchases & Owned Content */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                  <div className="flex items-center gap-1.5 text-white font-semibold text-[11px]">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verified In-Game Purchases & SKUs</span>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {(node.spend || 0) >= 2500
                      ? "Tier 4 Mega Whale"
                      : (node.spend || 0) >= 700
                      ? "Tier 3 High Engagement"
                      : (node.spend || 0) >= 100
                      ? "Tier 2 Core Loyalist"
                      : (node.spend || 0) > 0
                      ? "Tier 1 Starter Spender"
                      : "Tier 0 Base Game / F2P"}
                  </span>
                </div>

                {/* List of Purchased Items */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {(node.purchased_items && node.purchased_items.length > 0
                    ? node.purchased_items
                    : [
                        {
                          title: `${node.franchise || "COD"} Standard Retail Edition`,
                          price: (node.spend || 0) > 0 ? (node.spend || 0) : 0.0,
                          date: "2024-09-27",
                          category: (node.spend || 0) > 0 ? "Retail & In-Game Items" : "Free-to-Play Tier",
                          type: "RETAIL_BASE",
                        },
                      ]
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-[11px]"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[210px]">
                        <PackageCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div className="truncate">
                          <span className="text-white block font-medium truncate">{item.title}</span>
                          <span className="text-[9px] text-gray-400 block truncate">{item.category} • {item.date}</span>
                        </div>
                      </div>
                      <span className="font-mono text-emerald-400 font-semibold shrink-0 ml-2">
                        $${item.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total Cumulative Spend Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-gray-400">
                  <span>Cumulative Lifetime Spend:</span>
                  <span className="font-mono text-amber-300 font-bold text-xs">
                    $${(node.spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Playstyle & Frustration Radar */}
              <PlaystyleRadar
                spend={node.spend || 120}
                churnRisk={node.churn_risk || 0.45}
                tilt={node.tilt || 0.65}
                archetype={node.archetype || ""}
              />
            </>
          )}
        </>
      )}

      {/* 5. ACTION BUTTONS (Focus Group & A2A Dispatch) */}
      <div className="pt-2 space-y-2">
        <button
          onClick={() => onLaunchDeepSona(node || undefined)}
          disabled={isDeepSonaLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-semibold shadow-lg transition-all disabled:opacity-70 active:scale-[0.98]"
        >
          {isDeepSonaLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Synthesizing Focus Group...</span>
            </>
          ) : (
            <>
              <Users className="w-4 h-4 text-black" />
              <span>
                {isCohortView
                  ? "Launch Synthetic Focus Group for Cohort"
                  : isOffer
                  ? "Test Offer in Synthetic Focus Group"
                  : "Launch Synthetic Focus Group"}
              </span>
            </>
          )}
        </button>

        <button
          onClick={() => onEmitA2A(node || undefined)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-[0.98]"
        >
          <span>Emit A2A Brief to Act 2 (Creative)</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
