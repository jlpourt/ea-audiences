"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Users,
  TrendingUp,
  DollarSign,
  Filter,
  ArrowUpRight,
  BarChart3,
  X,
  Flame,
  Sparkles,
  Loader2,
  Zap,
  ShieldCheck,
  Target,
  Info,
} from "lucide-react";
import { GraphData, GraphNode } from "@/lib/types";

interface PlayerMarketingJourneySankeyProps {
  graphData: GraphData;
  onSelectPlayer?: (player: GraphNode) => void;
  onLaunchDeepSona?: (targetNode?: GraphNode, customTitle?: string) => void;
  onEmitA2A?: (targetNode?: GraphNode) => void;
  onReturnToGraph?: () => void;
}

// 5 Clean Funnel Stages
const STAGES = [
  { id: "acquisition", title: "1. Acquisition", subtitle: "Entry Gravity", color: "#00F0FF" },
  { id: "activation", title: "2. Core Mode", subtitle: "Active Gameplay", color: "#10B981" },
  { id: "friction", title: "3. Friction Event", subtitle: "Live-Ops Trigger", color: "#EC4899" },
  { id: "intervention", title: "4. Offer", subtitle: "Intervention", color: "#8B5CF6" },
  { id: "outcome", title: "5. Outcome", subtitle: "Retention & LTV", color: "#F59E0B" },
];

export default function PlayerMarketingJourneySankey({
  graphData,
  onSelectPlayer,
  onLaunchDeepSona,
  onEmitA2A,
  onReturnToGraph,
}: PlayerMarketingJourneySankeyProps) {
  const [selectedCohortPreset, setSelectedCohortPreset] = useState<string>("ALL");
  const [selectedMetric, setSelectedMetric] = useState<"count" | "revenue">("count");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<{ type: "node" | "link"; id: string; data: any } | null>(null);
  const [playerSearch, setPlayerSearch] = useState<string>("");

  // Floating Tooltip Coordinates & Data
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    stageName?: string;
    count: number;
    spend: number;
    pct: number;
    conversion?: string;
  } | null>(null);

  // Gemini Flash Lite Intelligence Summary State
  const [geminiSummary, setGeminiSummary] = useState<{
    path_summary?: string;
    funnel_summary?: string;
    key_tactical_lever?: string;
    recommended_bid_modifier?: string;
    model_used?: string;
  } | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);

  // 1. Extract Players from graph data
  const rawPlayers = useMemo(() => {
    return (graphData?.nodes || []).filter((n) => n.type === "PLAYER");
  }, [graphData]);

  // 2. Filter Players based on selected cohort preset
  const filteredPlayers = useMemo(() => {
    if (selectedCohortPreset === "ALL") return rawPlayers;
    if (selectedCohortPreset === "WHALES") return rawPlayers.filter((p) => (p.spend || 0) >= 1000 || (p.archetype || "").includes("WHALE"));
    if (selectedCohortPreset === "TILT_SLUMP") return rawPlayers.filter((p) => (p.loss_streak || 0) >= 2 || (p.tilt || 0) >= 0.65);
    if (selectedCohortPreset === "RUSH_SOCIAL") return rawPlayers.filter((p) => (p.archetype || "").includes("SOCIAL") || (p.archetype || "").includes("RAIDER") || (p.clan_name !== undefined && p.clan_name !== null));
    return rawPlayers;
  }, [rawPlayers, selectedCohortPreset]);

  // 3. Classify Each Player across the 5 Stages (Short uncluttered names)
  const playerTrajectories = useMemo(() => {
    return filteredPlayers.map((player) => {
      // Stage 0: Acquisition
      let acqId = "acq_social";
      let acqName = "Organic Clips";
      let acqSub = "YouTube / TikTok";
      if (player.followed_creators && player.followed_creators.length > 0) {
        acqId = "acq_creator";
        acqName = "Creator Streams";
        acqSub = "Scump / TimTheTatman";
      } else if ((player.spend || 0) >= 200 || (player.hours || 0) >= 300) {
        acqId = "acq_preorder";
        acqName = "Vault Pre-Order";
        acqSub = "Battle.net / Retail";
      } else if ((player.spend || 0) < 30 || (player.franchise === "CANDYCRUSH")) {
        acqId = "acq_bnet";
        acqName = "Battle.net & Mobile";
        acqSub = "Cross-Play Gravity";
      }

      // Stage 1: Core Mode
      let modeId = "mode_warzone";
      let modeName = "Warzone Resurgence";
      let modeSub = "Squads BR";
      if (player.franchise === "WOW" || player.archetype === "AZERITE_COLLECTOR") {
        modeId = "mode_wow";
        modeName = "Mythic+ Dungeons";
        modeSub = "20-Player Raids";
      } else if (player.franchise === "DIABLO4" || player.archetype === "SANCTUARY_COLLECTOR") {
        modeId = "mode_pit";
        modeName = "The Pit & Hordes";
        modeSub = "Tier 80+ Grinds";
      } else if (player.franchise === "CANDYCRUSH" || player.archetype === "BOOSTER_WHALE") {
        modeId = "mode_candy";
        modeName = "Candy Crush Saga";
        modeSub = "Commuter Match-3";
      } else if (player.franchise === "OVERWATCH2") {
        modeId = "mode_ow2";
        modeName = "Overwatch 2 Ranked";
        modeSub = "Role Queue 5v5";
      } else if (player.archetype === "COMPETITIVE_GRINDER" || (player.hours || 0) > 400) {
        modeId = "mode_bo6";
        modeName = "BO6 Ranked Play";
        modeSub = "Competitive CDL";
      }

      // Stage 2: Friction Trigger
      let fricId = "fric_organic";
      let fricName = "Smooth Flow";
      let fricSub = "Low Friction";
      if ((player.loss_streak || 0) >= 2 || (player.tilt || 0) >= 0.65) {
        fricId = "fric_gulag";
        fricName = "Gulag / Wipe Tilt";
        fricSub = "Elimination Slump";
      } else if ((player.spend || 0) >= 600 || player.archetype === "BLACKCELL_WHALE") {
        fricId = "fric_bp_cap";
        fricName = "Battle Pass Fatigue";
        fricSub = "Progression Wall";
      } else if (player.franchise === "CANDYCRUSH" || (player.game_telemetry?.current_level || 0) > 500) {
        fricId = "fric_booster";
        fricName = "Booster Depletion";
        fricSub = "Level 500+ Wall";
      } else if (player.archetype === "COMPETITIVE_GRINDER") {
        fricId = "fric_rank";
        fricName = "Rank Demotion";
        fricSub = "Skill Barrier";
      }

      // Stage 3: Marketing Offer
      let offId = "off_free";
      let offName = "Free Seasonal Cache";
      let offSub = "$0 Milestone";
      if (fricId === "fric_gulag") {
        offId = "off_blackcell";
        offName = "BlackCell Bundle";
        offSub = "$9.99 CP Coins";
      } else if (player.franchise === "WOW") {
        offId = "off_wow_sub";
        offName = "6-Month Sub & Mount";
        offSub = "$77.94 Bundle";
      } else if (player.franchise === "DIABLO4") {
        offId = "off_relic";
        offName = "Infernal Relic Pack";
        offSub = "$19.99 Platinum";
      } else if (player.franchise === "CANDYCRUSH") {
        offId = "off_goldbars";
        offName = "50 Gold Bars Starter";
        offSub = "$4.99 Reload";
      } else if ((player.spend || 0) >= 1000) {
        offId = "off_vault_vault";
        offName = "Battle.net Vault Pack";
        offSub = "$49.99 Collector";
      }

      // Stage 4: Lifecycle Outcome
      let outId = "out_core";
      let outName = "Active Core";
      let outSub = "Churn <20%";
      if ((player.spend || 0) >= 700 && (player.churn_risk || 0) < 0.4) {
        outId = "out_whale";
        outName = "Whale Retained";
        outSub = "$1,200+ LTV";
      } else if (player.primary_creator_influence) {
        outId = "out_creator_reengaged";
        outName = "Creator Fan";
        outSub = "Re-Engaged";
      } else if ((player.churn_risk || 0) >= 0.65) {
        outId = "out_at_risk";
        outName = "At-Risk Drop";
        outSub = "Inactive";
      }

      return {
        player,
        stages: [
          { stage: 0, id: acqId, name: acqName, sub: acqSub },
          { stage: 1, id: modeId, name: modeName, sub: modeSub },
          { stage: 2, id: fricId, name: fricName, sub: fricSub },
          { stage: 3, id: offId, name: offName, sub: offSub },
          { stage: 4, id: outId, name: outName, sub: outSub },
        ],
      };
    });
  }, [filteredPlayers]);

  // 4. Build Sankey Graph Model
  const sankeyModel = useMemo(() => {
    const totalCount = playerTrajectories.length || 1;
    const stageNodesMap: Record<number, Record<string, { id: string; name: string; sub: string; stage: number; count: number; spend: number; players: GraphNode[] }>> = {
      0: {},
      1: {},
      2: {},
      3: {},
      4: {},
    };

    const linkMap: Record<string, { id: string; source: string; target: string; sourceStage: number; targetStage: number; count: number; spend: number; players: GraphNode[] }> = {};

    playerTrajectories.forEach((t) => {
      for (let s = 0; s < 5; s++) {
        const nodeInfo = t.stages[s];
        if (!stageNodesMap[s][nodeInfo.id]) {
          stageNodesMap[s][nodeInfo.id] = {
            id: nodeInfo.id,
            name: nodeInfo.name,
            sub: nodeInfo.sub,
            stage: s,
            count: 0,
            spend: 0,
            players: [],
          };
        }
        stageNodesMap[s][nodeInfo.id].count += 1;
        stageNodesMap[s][nodeInfo.id].spend += t.player.spend || 0;
        stageNodesMap[s][nodeInfo.id].players.push(t.player);

        // Transition Link
        if (s < 4) {
          const nextNode = t.stages[s + 1];
          const linkKey = `${nodeInfo.id}->${nextNode.id}`;
          if (!linkMap[linkKey]) {
            linkMap[linkKey] = {
              id: linkKey,
              source: nodeInfo.id,
              target: nextNode.id,
              sourceStage: s,
              targetStage: s + 1,
              count: 0,
              spend: 0,
              players: [],
            };
          }
          linkMap[linkKey].count += 1;
          linkMap[linkKey].spend += t.player.spend || 0;
          linkMap[linkKey].players.push(t.player);
        }
      }
    });

    return {
      stageNodesMap,
      links: Object.values(linkMap).filter((l) => l.count > 0),
      totalPlayers: totalCount,
    };
  }, [playerTrajectories]);

  // SVG Geometry - Generous Width & Spacing
  const svgWidth = 1200;
  const svgHeight = 440;
  const colX = [60, 310, 560, 810, 1060];
  const nodeWidth = 12;

  // Calculate clean dynamic node layout
  const nodeLayout = useMemo(() => {
    const layout: Record<string, { id: string; name: string; sub: string; stage: number; x: number; y: number; h: number; count: number; spend: number; pct: number; players: GraphNode[] }> = {};

    for (let s = 0; s < 5; s++) {
      // Filter out nodes with 0 count to prevent clutter
      const nodes = Object.values(sankeyModel.stageNodesMap[s] || {}).filter((n) => n.count > 0);
      const x = colX[s];
      const stageTotal = nodes.reduce((sum, n) => sum + n.count, 0) || 1;
      const availableHeight = svgHeight - 60;
      const padding = 20;
      const totalPaddings = (nodes.length - 1) * padding;
      const usableHeight = Math.max(80, availableHeight - totalPaddings);

      let currentY = 30;
      nodes.forEach((n) => {
        const heightRatio = n.count / stageTotal;
        const h = Math.max(26, Math.round(heightRatio * usableHeight));
        layout[n.id] = {
          ...n,
          x,
          y: currentY,
          h,
          pct: Math.round((n.count / sankeyModel.totalPlayers) * 100),
        };
        currentY += h + padding;
      });
    }

    return layout;
  }, [sankeyModel, colX]);

  // Aggregate Funnel Stats
  const funnelMetrics = useMemo(() => {
    const total = sankeyModel.totalPlayers;
    const totalRev = filteredPlayers.reduce((acc, p) => acc + (p.spend || 0), 0);
    const converted = filteredPlayers.filter((p) => (p.spend || 0) > 50).length;
    const rescuedChurn = filteredPlayers.filter((p) => (p.loss_streak || 0) >= 2 && (p.churn_risk || 0) < 0.45).length;

    return {
      totalAnalyzed: total,
      conversionRate: Math.round((converted / (total || 1)) * 100),
      totalPipelineLtv: totalRev,
      rescuedTiltPlayers: rescuedChurn,
    };
  }, [sankeyModel, filteredPlayers]);

  // Fetch Gemini Flash Lite Dynamic Intelligence Summary whenever a path is selected
  useEffect(() => {
    if (!selectedPath) {
      setGeminiSummary(null);
      return;
    }

    let isMounted = true;
    const fetchSummary = async () => {
      setIsSummaryLoading(true);
      try {
        const res = await fetch("/api/marketing/journey/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selected_path: selectedPath,
            funnel_metrics: funnelMetrics,
            cohort_preset: selectedCohortPreset,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setGeminiSummary(data);
        }
      } catch (e) {
        console.error("Failed to generate Gemini journey summary:", e);
      } finally {
        if (isMounted) setIsSummaryLoading(false);
      }
    };

    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [selectedPath, funnelMetrics, selectedCohortPreset]);

  // Filtered players in selected path drawer
  const activeDrilldownPlayers = useMemo(() => {
    if (!selectedPath) return [];
    const list: GraphNode[] = selectedPath.data.players || [];
    if (!playerSearch.trim()) return list;
    const q = playerSearch.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.country && p.country.toLowerCase().includes(q)) ||
        (p.dma_market && p.dma_market.toLowerCase().includes(q))
    );
  }, [selectedPath, playerSearch]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltip && tooltip.visible) {
      setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative w-full h-full bg-[#080A0E] text-white flex flex-col overflow-hidden font-sans select-none"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. TOP BAR / KPI HEADER
      ────────────────────────────────────────────────────────────── */}
      <div className="relative z-20 flex flex-wrap items-center justify-between px-6 py-3 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00F0FF]" />
            <span className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <span>Player Marketing Journeys</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-medium">
                ABK Cross-Title Funnel
              </span>
            </span>
          </div>

          <span className="text-gray-600 hidden sm:inline">|</span>

          {/* Preset Cohort Filter Pills */}
          <div className="flex items-center gap-1.5 bg-white/[0.04] p-1 rounded-xl border border-white/10">
            {[
              { id: "ALL", label: "All ABK Players" },
              { id: "WHALES", label: "💎 Battle.net Whales ($1k+)" },
              { id: "TILT_SLUMP", label: "⚡ Gulag / Wipe Tilt" },
              { id: "RUSH_SOCIAL", label: "🎯 Squads & Mythic Guilds" },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setSelectedCohortPreset(preset.id);
                  setSelectedPath(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  selectedCohortPreset === preset.id
                    ? "bg-white text-black font-semibold shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Metric Selector */}
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10 text-[11px]">
            <button
              onClick={() => setSelectedMetric("count")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                selectedMetric === "count" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold" : "text-gray-400 hover:text-white"
              }`}
            >
              Volume
            </button>
            <button
              onClick={() => setSelectedMetric("revenue")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                selectedMetric === "revenue" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold" : "text-gray-400 hover:text-white"
              }`}
            >
              Revenue
            </button>
          </div>

          <button
            onClick={() => onLaunchDeepSona && onLaunchDeepSona(undefined, "ABK Battle.net Cross-Title Funnel Simulation")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-semibold shadow-lg transition-all"
          >
            <Users className="w-3.5 h-3.5 text-black" />
            <span>Simulate Focus Group</span>
          </button>

          {onReturnToGraph && (
            <button
              onClick={onReturnToGraph}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all"
            >
              Back to Graph
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KPI SUMMARY METRIC CARDS
      ────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pt-3 pb-1">
        <div className="apple-glass rounded-2xl p-2.5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-gray-400 block uppercase font-medium">Funnel Audience</span>
            <span className="text-base font-bold text-white font-mono mt-0.5 block">
              {funnelMetrics.totalAnalyzed.toLocaleString()} <span className="text-[11px] text-gray-400 font-normal">Players</span>
            </span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300">
            <Users className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="apple-glass rounded-2xl p-2.5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-gray-400 block uppercase font-medium">Conversion Rate</span>
            <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
              {funnelMetrics.conversionRate}% <span className="text-[10px] text-emerald-300/70 font-normal">(Intervention)</span>
            </span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="apple-glass rounded-2xl p-2.5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-gray-400 block uppercase font-medium">Pipeline LTV</span>
            <span className="text-base font-bold text-amber-300 font-mono mt-0.5 block">
              ${funnelMetrics.totalPipelineLtv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="apple-glass rounded-2xl p-2.5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-gray-400 block uppercase font-medium">Slump Churn Rescued</span>
            <span className="text-base font-bold text-pink-400 font-mono mt-0.5 block">
              +{funnelMetrics.rescuedTiltPlayers} <span className="text-[10px] text-pink-300/70 font-normal">Players</span>
            </span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-300">
            <Flame className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. INTERACTIVE SANKEY CANVAS & FLOW STAGE COLUMNS
      ────────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 flex overflow-hidden p-5 gap-4">
        {/* Main Sankey Visualization Canvas */}
        <div className="relative flex-1 apple-glass-heavy rounded-3xl p-4 border border-white/10 overflow-hidden flex flex-col shadow-2xl">
          {/* Stage Column Headers */}
          <div className="grid grid-cols-5 gap-4 pb-2 border-b border-white/10 text-center select-none">
            {STAGES.map((st) => (
              <div key={st.id} className="space-y-0.5">
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: st.color, boxShadow: `0 0 6px ${st.color}` }}
                  />
                  <span className="text-xs font-semibold text-white tracking-tight">{st.title}</span>
                </div>
                <span className="text-[9px] text-gray-400 block">{st.subtitle}</span>
              </div>
            ))}
          </div>

          {/* SVG Canvas for Sankey Ribbons and Nodes */}
          <div className="relative flex-1 w-full h-full mt-1">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="grad-cyan-emerald" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id="grad-emerald-pink" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#EC4899" stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id="grad-pink-purple" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EC4899" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id="grad-purple-amber" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.45" />
                </linearGradient>
              </defs>

              {/* 3A. Draw Transition Flow Ribbons */}
              {sankeyModel.links.map((link) => {
                const srcNode = nodeLayout[link.source];
                const dstNode = nodeLayout[link.target];
                if (!srcNode || !dstNode) return null;

                const isHovered = hoveredLinkId === link.id || hoveredNodeId === link.source || hoveredNodeId === link.target;
                const isSelected = selectedPath?.id === link.id;

                const ribbonThickness = Math.max(3, Math.round((link.count / (srcNode.count || 1)) * srcNode.h * 0.8));
                const y0 = srcNode.y + srcNode.h / 2;
                const y1 = dstNode.y + dstNode.h / 2;

                const x0 = srcNode.x + nodeWidth;
                const x1 = dstNode.x;
                const cX = (x0 + x1) / 2;

                const d = `M ${x0} ${y0 - ribbonThickness / 2} C ${cX} ${y0 - ribbonThickness / 2}, ${cX} ${y1 - ribbonThickness / 2}, ${x1} ${y1 - ribbonThickness / 2} L ${x1} ${y1 + ribbonThickness / 2} C ${cX} ${y1 + ribbonThickness / 2}, ${cX} ${y0 + ribbonThickness / 2}, ${x0} ${y0 + ribbonThickness / 2} Z`;

                let fillGradient = "url(#grad-cyan-emerald)";
                if (link.sourceStage === 1) fillGradient = "url(#grad-emerald-pink)";
                if (link.sourceStage === 2) fillGradient = "url(#grad-pink-purple)";
                if (link.sourceStage === 3) fillGradient = "url(#grad-purple-amber)";

                return (
                  <path
                    key={link.id}
                    d={d}
                    fill={fillGradient}
                    opacity={isSelected ? 0.95 : isHovered ? 0.85 : 0.35}
                    stroke={isSelected ? "#00F0FF" : isHovered ? "#FFFFFF" : "transparent"}
                    strokeWidth={isSelected ? 1.5 : isHovered ? 1 : 0}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={(e) => {
                      setHoveredLinkId(link.id);
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: `${srcNode.name} ➔ ${dstNode.name}`,
                        count: link.count,
                        spend: link.spend,
                        pct: Math.round((link.count / sankeyModel.totalPlayers) * 100),
                        conversion: `${Math.round((link.count / (srcNode.count || 1)) * 100)}% flow`,
                      });
                    }}
                    onMouseLeave={() => {
                      setHoveredLinkId(null);
                      setTooltip(null);
                    }}
                    onClick={() =>
                      setSelectedPath({
                        type: "link",
                        id: link.id,
                        data: {
                          title: `${srcNode.name} ➔ ${dstNode.name}`,
                          source: srcNode.name,
                          target: dstNode.name,
                          count: link.count,
                          spend: link.spend,
                          pct: Math.round((link.count / sankeyModel.totalPlayers) * 100),
                          players: link.players,
                        },
                      })
                    }
                  />
                );
              })}

              {/* 3B. Draw Stage Nodes with Simplified Clean Text */}
              {Object.values(nodeLayout).map((node) => {
                const isHovered = hoveredNodeId === node.id;
                const isSelected = selectedPath?.id === node.id;
                const stageColor = STAGES[node.stage]?.color || "#00F0FF";
                const isLastColumn = node.stage === 4;

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer group"
                    onMouseEnter={(e) => {
                      setHoveredNodeId(node.id);
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: node.name,
                        stageName: STAGES[node.stage]?.title,
                        count: node.count,
                        spend: node.spend,
                        pct: node.pct,
                      });
                    }}
                    onMouseLeave={() => {
                      setHoveredNodeId(null);
                      setTooltip(null);
                    }}
                    onClick={() =>
                      setSelectedPath({
                        type: "node",
                        id: node.id,
                        data: {
                          title: node.name,
                          stageName: STAGES[node.stage]?.title,
                          count: node.count,
                          spend: node.spend,
                          pct: node.pct,
                          players: node.players,
                        },
                      })
                    }
                  >
                    {/* Node Vertical Bar */}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={nodeWidth}
                      height={node.h}
                      rx={5}
                      fill={stageColor}
                      opacity={isSelected ? 1 : isHovered ? 0.95 : 0.8}
                      className="transition-all duration-200"
                      style={{
                        filter: isHovered || isSelected ? `drop-shadow(0 0 8px ${stageColor})` : undefined,
                      }}
                    />

                    {/* Clean Short Text Label */}
                    <text
                      x={isLastColumn ? node.x - 8 : node.x + nodeWidth + 8}
                      y={node.y + Math.min(14, node.h / 2 + 1)}
                      textAnchor={isLastColumn ? "end" : "start"}
                      className="text-[10px] font-semibold fill-gray-200 select-none group-hover:fill-white transition-colors"
                    >
                      {node.name}
                    </text>

                    {/* Secondary Metric / Count */}
                    <text
                      x={isLastColumn ? node.x - 8 : node.x + nodeWidth + 8}
                      y={node.y + Math.min(14, node.h / 2 + 1) + 12}
                      textAnchor={isLastColumn ? "end" : "start"}
                      className="text-[9px] font-mono fill-cyan-300/90 select-none font-medium"
                    >
                      {selectedMetric === "revenue"
                        ? `$${node.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : `${node.count} (${node.pct}%)`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            4. RIGHT-SIDE DRILLDOWN INSPECTOR DRAWER (WITH GEMINI FLASH LITE)
        ────────────────────────────────────────────────────────────── */}
        <div className="w-80 apple-glass-heavy rounded-3xl p-4 border border-white/10 flex flex-col space-y-3 shadow-2xl font-sans overflow-y-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                <Filter className="w-3.5 h-3.5" />
              </span>
              <div>
                <span className="text-xs font-semibold text-white block">Journey Path Inspector</span>
                <span className="text-[10px] text-gray-400 block font-mono truncate max-w-[190px]">
                  {selectedPath ? selectedPath.data.title : "Click any node or ribbon to inspect"}
                </span>
              </div>
            </div>
            {selectedPath && (
              <button
                onClick={() => setSelectedPath(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {selectedPath ? (
            <>
              {/* Path KPI Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[9px] text-gray-500 block uppercase">Path Players</span>
                  <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                    {selectedPath.data.count} <span className="text-[10px] text-cyan-300">({selectedPath.data.pct}%)</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[9px] text-gray-500 block uppercase">Path Revenue</span>
                  <span className="text-sm font-bold text-amber-300 font-mono mt-0.5 block">
                    ${selectedPath.data.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* 🌟 1. GEMINI FLASH LITE: PATH INTELLIGENCE */}
              <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 backdrop-blur-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider font-mono">
                      Gemini Flash-Lite Path Intel
                    </span>
                  </div>
                  {isSummaryLoading && (
                    <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                  )}
                </div>

                {isSummaryLoading ? (
                  <div className="space-y-1 py-1">
                    <div className="h-2.5 bg-cyan-400/10 rounded animate-pulse w-full" />
                    <div className="h-2.5 bg-cyan-400/10 rounded animate-pulse w-4/5" />
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-200 leading-relaxed">
                    {geminiSummary?.path_summary || "Analyzing telemetry across selected trajectory..."}
                  </p>
                )}

                {geminiSummary?.key_tactical_lever && (
                  <div className="flex items-center gap-1.5 pt-1 text-[9px] text-cyan-300/90 font-mono">
                    <Zap className="w-2.5 h-2.5 text-yellow-400 flex-shrink-0" />
                    <span className="truncate">{geminiSummary.key_tactical_lever}</span>
                  </div>
                )}
              </div>

              {/* 🌟 2. GEMINI FLASH LITE: OVERALL FUNNEL HEALTH */}
              <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 backdrop-blur-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider font-mono">
                      Funnel Health & Retention
                    </span>
                  </div>
                </div>

                {isSummaryLoading ? (
                  <div className="space-y-1 py-1">
                    <div className="h-2.5 bg-emerald-400/10 rounded animate-pulse w-full" />
                    <div className="h-2.5 bg-emerald-400/10 rounded animate-pulse w-3/4" />
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-200 leading-relaxed">
                    {geminiSummary?.funnel_summary || "Computing overall funnel conversion throughput..."}
                  </p>
                )}

                {geminiSummary?.recommended_bid_modifier && (
                  <div className="flex items-center gap-1.5 pt-1 text-[9px] text-emerald-300 font-mono">
                    <Target className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{geminiSummary.recommended_bid_modifier}</span>
                  </div>
                )}
              </div>

              {/* Sampled Players List */}
              <div className="flex-1 flex flex-col min-h-0 space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] border-b border-white/5 pb-1">
                  <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-cyan-400" />
                    <span>Sampled Players ({selectedPath.data.players?.length || 0})</span>
                  </span>
                  <span className="text-[9px] text-gray-500">Click to Inspect</span>
                </div>

                {/* Filter */}
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Filter players in path..."
                  className="w-full px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-[10px] outline-none"
                />

                {/* Player List */}
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {activeDrilldownPlayers.slice(0, 20).map((player, pIdx) => (
                    <button
                      key={player.id || pIdx}
                      onClick={() => onSelectPlayer && onSelectPlayer(player)}
                      className="w-full flex items-center justify-between p-1.5 rounded-xl bg-black/40 hover:bg-white/[0.06] border border-white/5 text-left transition-all group"
                    >
                      <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                        <span className="text-xs">{player.country_flag || "👤"}</span>
                        <div className="truncate">
                          <span className="text-white text-[10px] block font-medium truncate group-hover:text-cyan-300">
                            {player.name}
                          </span>
                          <span className="text-[8px] text-gray-400 block truncate">
                            {player.dma_market || "Global"} • Tilt: {Math.round((player.tilt || 0.5) * 100)}%
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-amber-300 text-[9px] font-semibold">
                        ${(player.spend || 0).toFixed(0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1.5 space-y-1.5">
                <button
                  onClick={() =>
                    onLaunchDeepSona &&
                    onLaunchDeepSona(selectedPath.data.players?.[0], `DeepSona: ${selectedPath.data.title} Funnel Segment`)
                  }
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-semibold shadow-lg transition-all active:scale-[0.98]"
                >
                  <Users className="w-3.5 h-3.5 text-black" />
                  <span>Simulate Focus Group</span>
                </button>

                <button
                  onClick={() => onEmitA2A && onEmitA2A(selectedPath.data.players?.[0])}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-[10px] font-medium transition-all"
                >
                  <span>Emit A2A Brief to Act 2</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-2 text-gray-400">
              <BarChart3 className="w-7 h-7 text-gray-600 animate-pulse" />
              <span className="text-xs text-gray-300 font-medium">Select a Funnel Node or Link</span>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Click any stage column (Acquisition, Mode, Friction, Offer, Outcome) or transition ribbon to inspect real-time player telemetry, conversion rates, and trigger focus groups.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. FLOATING FROSTED GLASS HOVER TOOLTIP
      ────────────────────────────────────────────────────────────── */}
      {tooltip && tooltip.visible && (
        <div
          className="fixed pointer-events-none z-50 p-2.5 rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/20 text-white shadow-2xl animate-fade-in text-[11px] space-y-1 min-w-[180px]"
          style={{
            left: `${Math.min(window.innerWidth - 220, tooltip.x + 16)}px`,
            top: `${Math.min(window.innerHeight - 140, tooltip.y + 16)}px`,
          }}
        >
          <div className="font-semibold text-white tracking-tight flex items-center justify-between">
            <span className="truncate max-w-[140px]">{tooltip.title}</span>
            {tooltip.stageName && (
              <span className="text-[9px] text-gray-400 font-mono">{tooltip.stageName}</span>
            )}
          </div>
          <div className="flex items-center justify-between text-gray-300 text-[10px] font-mono">
            <span>Players:</span>
            <span className="font-bold text-cyan-300">{tooltip.count} ({tooltip.pct}%)</span>
          </div>
          <div className="flex items-center justify-between text-gray-300 text-[10px] font-mono">
            <span>Est. Revenue:</span>
            <span className="font-bold text-amber-300">${tooltip.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          {tooltip.conversion && (
            <div className="flex items-center justify-between text-gray-300 text-[10px] font-mono border-t border-white/10 pt-1 mt-1">
              <span>Conversion:</span>
              <span className="font-bold text-emerald-400">{tooltip.conversion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
