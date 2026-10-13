"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Zap,
  X,
  Flame,
  RefreshCw,
} from "lucide-react";
import { GraphData } from "@/lib/types";
import { archetypeLabel } from "@/lib/archetypes";
import { TabularNumber } from "@/components/brand/TabularNumber";

export interface SeasonJourneySankeyProps {
  graphData?: GraphData;
  onSelectPlayer?: (playerId: string) => void;
  onPressureTest?: (cohortTitle: string, query: string) => void;
  onLaunchFocusGroup?: (cohortTitle: string, query: string) => void;
  onActivate?: (cohortTitle: string) => void;
  onEmitA2A?: (cohortTitle: string) => void;
  onReturnToGraph?: () => void;
}

interface SankeyNode {
  id: string;
  name: string;
  subtitle: string;
  stage: number;
  color: string;
  count: number;
  spend: number;
  pct: number;
  sampled_players: any[];
}

interface SankeyLink {
  id: string;
  source: string;
  target: string;
  sourceStage: number;
  targetStage: number;
  count: number;
  spend: number;
  pct: number;
  sampled_players: any[];
}

interface JourneyMetrics {
  totalPlayers: number;
  totalSpend: number;
  retainedCount: number;
  retainedRatePct: number;
  cliffChurnCount: number;
  sub85Count: number;
  crewReupCount: number;
  holdout2k26Count?: number;
}

const SVG_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif";

const STAGE_HEADERS = [
  { index: 0, title: "1. Tip-Off Cohort", subtitle: "2K27 Launch · 2K26 Veterans · Cross-2K" },
  { index: 1, title: "2. Mode Entry", subtitle: "MyCAREER / The City · MyTEAM · MyNBA" },
  { index: 2, title: "3. Week 4-6 Status", subtitle: "85+ Grinders · Cliff · Whales · Holdouts" },
  { index: 3, title: "4. Intervention Offer", subtitle: "Crew Re-Up · HoF Pass · Opal · Upgrade" },
  { index: 4, title: "5. Season 2 Outcome", subtitle: "Retained · High-LTV Expansion · Churn" },
];

const CLEAN_NODE_TITLES: Record<string, string> = {
  acq_launch: "NBA 2K27 Launch",
  acq_returning: "2K26 Returning Veterans",
  acq_cross2k: "Cross-2K Titles",
  mode_career: "MyCAREER / The City",
  mode_myteam: "MyTEAM",
  mode_mynba_w: "MyNBA & The W",
  status_85plus: "85+ OVR Grinders",
  status_sub85_cliff: "Sub-85 Stalled Cliff",
  status_whale: "MyTEAM Opal Whales",
  status_2k26_holdout: "2K26 Holdout Squads",
  offer_crew_reup: "$4.99 Crew Re-Up",
  offer_hof_pass: "HoF Season Pass",
  offer_deluxe_pack: "Galaxy Opal Pack",
  offer_2k26_upgrade: "2K26 → 2K27 HoF Upgrade",
  out_retained: "Retained in Season 2",
  out_expansion: "High-LTV 2K Expansion",
  out_churn: "Season 1 Cliff Churn",
};

function toOneSentenceTakeaway(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/\s*\u2014\s*/g, " · ").trim();
  const match = cleaned.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : cleaned;
}

export function SeasonJourneySankey({
  onSelectPlayer,
  onPressureTest,
  onLaunchFocusGroup,
  onActivate,
  onEmitA2A,
}: SeasonJourneySankeyProps) {
  const [nodes, setNodes] = useState<SankeyNode[]>([]);
  const [links, setLinks] = useState<SankeyLink[]>([]);
  const [metrics, setMetrics] = useState<JourneyMetrics | null>(null);
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selection & hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    type: "node" | "link";
    data: SankeyNode | SankeyLink;
  } | null>(null);

  // Drawer takeaway
  const [pathDiagnosis, setPathDiagnosis] = useState<string>("");
  const [isPathLoading, setIsPathLoading] = useState<boolean>(false);

  // Fetch live funnel data from journey summary route
  const fetchFunnel = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/journey/summary");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawNodes: SankeyNode[] = (data.nodes || []).map((n: SankeyNode) => ({
        ...n,
        name: CLEAN_NODE_TITLES[n.id] || n.name.replace(/\s*\u2014\s*/g, " · "),
        subtitle: (n.subtitle || "").replace(/\s*\u2014\s*/g, " · "),
      }));
      setNodes(rawNodes);
      setLinks(data.links || []);
      setMetrics(data.metrics || null);
      const cleanDiag = toOneSentenceTakeaway(data.diagnosis || "");
      setDiagnosis(cleanDiag);
      const defaultCliffNode =
        rawNodes.find((n) => n.id === "status_sub85_cliff") || rawNodes[0];
      if (defaultCliffNode) {
        setSelectedItem((prev) => prev ?? { type: "node", data: defaultCliffNode });
        setPathDiagnosis((prev) => prev || cleanDiag);
      }
    } catch (err: any) {
      console.error("[SeasonJourneySankey] fetch error:", err);
      setError(err?.message || "Failed to load journey data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnel();
  }, []);

  const nodeById = useMemo(() => {
    const map = new Map<string, SankeyNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Compute node positions in fixed aspect-ratio SVG coordinates (1240 width x 520 height)
  const svgLayout = useMemo(() => {
    const width = 1240;
    const height = 520;
    const topPad = 56;
    const bottomPad = 12;
    const stageWidth = 188;
    const colSpacing = (width - stageWidth * 5) / 4; // 75px open ribbon flow between columns
    const colX = [0, 1, 2, 3, 4].map((s) => s * (stageWidth + colSpacing));

    // Group nodes by stage
    const byStage: Record<number, SankeyNode[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    nodes.forEach((n) => {
      if (byStage[n.stage]) byStage[n.stage].push(n);
    });

    const nodeLayouts = new Map<string, { x: number; y: number; w: number; h: number }>();

    for (let s = 0; s < 5; s++) {
      const stageNodes = byStage[s] || [];
      const x = colX[s];
      const totalStageCount = stageNodes.reduce((sum, n) => sum + n.count, 0) || 1;
      const verticalGap = stageNodes.length >= 4 ? 14 : 16;
      const availableH =
        height - topPad - bottomPad - Math.max(0, stageNodes.length - 1) * verticalGap;
      const minH = 54;
      const remH = Math.max(0, availableH - stageNodes.length * minH);

      let currY = topPad;
      stageNodes.forEach((n) => {
        const h = Math.round(minH + (n.count / totalStageCount) * remH);
        nodeLayouts.set(n.id, { x, y: currY, w: stageWidth, h });
        currY += h + verticalGap;
      });
    }

    return { width, height, topPad, stageWidth, colX, nodeLayouts };
  }, [nodes]);

  const resolveItemTitle = (item: { type: "node" | "link"; data: SankeyNode | SankeyLink }) => {
    if (item.type === "node") {
      const n = item.data as SankeyNode;
      return CLEAN_NODE_TITLES[n.id] || n.name;
    }
    const l = item.data as SankeyLink;
    const srcName = CLEAN_NODE_TITLES[l.source] || nodeById.get(l.source)?.name || l.source;
    const dstName = CLEAN_NODE_TITLES[l.target] || nodeById.get(l.target)?.name || l.target;
    return `${srcName} → ${dstName}`;
  };

  // Click on a node or link
  const handleSelectNode = (node: SankeyNode) => {
    setSelectedItem({ type: "node", data: node });
    setPathDiagnosis(diagnosis);
  };

  const handleSelectLink = async (link: SankeyLink) => {
    setSelectedItem({ type: "link", data: link });
    setIsPathLoading(true);
    try {
      const sourceNode = nodeById.get(link.source);
      const targetNode = nodeById.get(link.target);
      const res = await fetch("/api/marketing/journey/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageFrom: sourceNode?.name || CLEAN_NODE_TITLES[link.source] || link.source,
          stageTo: targetNode?.name || CLEAN_NODE_TITLES[link.target] || link.target,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setPathDiagnosis(toOneSentenceTakeaway(d.diagnosis || ""));
      }
    } catch (err: any) {
      console.error("[SeasonJourneySankey] transition diagnosis error:", err);
      setPathDiagnosis("");
    } finally {
      setIsPathLoading(false);
    }
  };

  const handleLaunchPressureTest = () => {
    if (!selectedItem) return;
    const title = resolveItemTitle(selectedItem);
    const query =
      selectedItem.type === "node"
        ? `Segment "${title}" Season 1 Cohort`
        : `Journey transition ${title}`;

    if (onPressureTest) onPressureTest(title, query);
    else if (onLaunchFocusGroup) onLaunchFocusGroup(title, query);
  };

  const handleLaunchActivation = () => {
    if (!selectedItem) return;
    const title = resolveItemTitle(selectedItem);

    if (onActivate) onActivate(title);
    else if (onEmitA2A) onEmitA2A(title);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0A0A0C] text-[#F4F1EA] overflow-hidden select-none">
      {/* Clean Sub-Header Bar */}
      <div className="h-14 px-6 border-b border-white/[0.07] bg-[#121216]/90 backdrop-blur-md flex items-center justify-between gap-4 z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold tracking-tight text-white truncate">
            Season 1 → Season 2 Lifecycle Flows
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.05] text-[#F4F1EA]/70 font-mono border border-white/[0.08] shrink-0 tabular">
            {metrics ? `${metrics.totalPlayers.toLocaleString()} Players` : "2,850 Players"} · 5 Stages
          </span>
        </div>

        {/* 4 Compact High-Contrast Inline KPI Pills + Refresh Button */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center gap-1.5">
            <span className="text-white/55 text-[11px]">Total Cohort:</span>
            <TabularNumber
              value={metrics?.totalPlayers ?? 2850}
              className="font-mono font-semibold text-white text-xs"
            />
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center gap-1.5">
            <span className="text-white/55 text-[11px]">Sub-85 Cliff:</span>
            <TabularNumber
              value={metrics?.sub85Count ?? 483}
              className="font-mono font-semibold text-[#FF4D5E] text-xs"
            />
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center gap-1.5">
            <span className="text-white/55 text-[11px]">Crew Re-Up:</span>
            <TabularNumber
              value={metrics?.crewReupCount ?? 483}
              className="font-mono font-semibold text-[#19C37D] text-xs"
            />
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center gap-1.5">
            <span className="text-white/55 text-[11px]">S2 Retained:</span>
            <span className="font-mono font-semibold text-[#19C37D] text-xs tabular">
              {metrics?.retainedRatePct ?? 81}%
            </span>
          </div>
          <button
            onClick={fetchFunnel}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/70 hover:text-white transition-colors"
            title="Refresh lifecycle telemetry"
            aria-label="Refresh lifecycle telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "courtside-Transfer-pulse text-[#E4002B]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Sankey Canvas */}
      <div className="relative flex-1 px-6 py-4 overflow-hidden flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
            <div className="flex items-center gap-3 text-xs text-white/80">
              <RefreshCw className="w-4 h-4 courtside-Transfer-pulse text-[#E4002B]" />
              <span>Tracing Season 1 → Season 2 MyPLAYER &amp; 2K26 Upgrade trajectories...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/40 text-sm text-red-200">
              {error}
            </div>
          </div>
        )}

        <svg
          viewBox="0 0 1240 520"
          className="w-full h-full max-h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {links.map((link) => {
              const sNode = nodeById.get(link.source);
              const tNode = nodeById.get(link.target);
              const startColor = sNode?.color || "#E4002B";
              const endColor = tNode?.color || "#C8905A";
              const sLayout = svgLayout.nodeLayouts.get(link.source);
              const tLayout = svgLayout.nodeLayouts.get(link.target);
              return (
                <linearGradient
                  key={`grad-${link.id}`}
                  id={`grad-${link.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={(sLayout?.x || 0) + (sLayout?.w || 188)}
                  y1={sLayout?.y || 0}
                  x2={tLayout?.x || 1240}
                  y2={tLayout?.y || 520}
                >
                  <stop offset="0%" stopColor={startColor} stopOpacity="0.48" />
                  <stop offset="100%" stopColor={endColor} stopOpacity="0.48" />
                </linearGradient>
              );
            })}
          </defs>

          {/* 5 Stage Column Headers aligned 100% with colX */}
          {STAGE_HEADERS.map((h) => {
            const x = svgLayout.colX[h.index];
            return (
              <g key={`stage-hdr-${h.index}`} transform={`translate(${x}, 0)`}>
                <text
                  x={2}
                  y={22}
                  fill="#F4F1EA"
                  fontSize={12}
                  fontWeight={600}
                  fontFamily={SVG_FONT_FAMILY}
                  letterSpacing="-0.01em"
                >
                  {h.title}
                </text>
                <text
                  x={2}
                  y={38}
                  fill="rgba(244,241,234,0.48)"
                  fontSize={9.5}
                  fontFamily={SVG_FONT_FAMILY}
                >
                  {h.subtitle}
                </text>
                <line
                  x1={0}
                  y1={46}
                  x2={svgLayout.stageWidth}
                  y2={46}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* Links / Ribbons */}
          {links.map((link) => {
            const sLayout = svgLayout.nodeLayouts.get(link.source);
            const tLayout = svgLayout.nodeLayouts.get(link.target);
            if (!sLayout || !tLayout) return null;

            const x1 = sLayout.x + sLayout.w;
            const y1 = sLayout.y + sLayout.h / 2;
            const x2 = tLayout.x;
            const y2 = tLayout.y + tLayout.h / 2;
            const dx = (x2 - x1) * 0.5;

            const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            const strokeW = Math.max(
              3,
              Math.min(38, (link.count / (metrics?.totalPlayers || 2850)) * 115)
            );

            const isHovered =
              hoveredLinkId === link.id ||
              hoveredNodeId === link.source ||
              hoveredNodeId === link.target;
            const isSelected =
              selectedItem?.type === "link" && (selectedItem.data as SankeyLink).id === link.id;

            return (
              <path
                key={link.id}
                d={d}
                fill="none"
                stroke={`url(#grad-${link.id})`}
                strokeWidth={strokeW}
                strokeLinecap="round"
                className="cursor-pointer transition-opacity duration-200"
                style={{
                  opacity:
                    isHovered || isSelected
                      ? 0.95
                      : hoveredNodeId || hoveredLinkId
                      ? 0.15
                      : 0.65,
                  strokeDasharray: "1000",
                  animation: "sankeyDrawIn 600ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
                }}
                onMouseEnter={() => setHoveredLinkId(link.id)}
                onMouseLeave={() => setHoveredLinkId(null)}
                onClick={() => handleSelectLink(link)}
              />
            );
          })}

          {/* Stage Nodes */}
          {nodes.map((node) => {
            const layout = svgLayout.nodeLayouts.get(node.id);
            if (!layout) return null;

            const isHovered = hoveredNodeId === node.id;
            const isSelected =
              selectedItem?.type === "node" && (selectedItem.data as SankeyNode).id === node.id;
            const maxChars = 28;
            const cleanTitle = CLEAN_NODE_TITLES[node.id] || node.name;
            const displayTitle =
              cleanTitle.length > maxChars
                ? `${cleanTitle.slice(0, maxChars - 1)}…`
                : cleanTitle;
            const showSubtitle = layout.h >= 44;

            return (
              <g
                key={node.id}
                transform={`translate(${layout.x}, ${layout.y})`}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => handleSelectNode(node)}
              >
                {/* Node Card Box */}
                <rect
                  width={layout.w}
                  height={layout.h}
                  rx={8}
                  fill="#121216"
                  stroke={
                    isSelected
                      ? "#E4002B"
                      : isHovered
                      ? "rgba(255,255,255,0.42)"
                      : "rgba(255,255,255,0.12)"
                  }
                  strokeWidth={isSelected ? 2 : 1}
                  className="transition-colors duration-150"
                />

                {/* Left Accent Bar */}
                <rect width={4} height={layout.h} rx={2} fill={node.color} />

                {/* Node Title */}
                <text
                  x={13}
                  y={showSubtitle ? 21 : 20}
                  fill="#F4F1EA"
                  fontSize={11.5}
                  fontWeight={600}
                  fontFamily={SVG_FONT_FAMILY}
                  className="pointer-events-none"
                >
                  {displayTitle}
                </text>

                {/* Node Subtitle (only shown when h >= 68 so shorter nodes never crowd) */}
                {showSubtitle && (
                  <text
                    x={13}
                    y={37}
                    fill="rgba(244,241,234,0.52)"
                    fontSize={9.5}
                    fontFamily={SVG_FONT_FAMILY}
                    className="pointer-events-none"
                  >
                    {node.subtitle}
                  </text>
                )}

                {/* Node Count & Share % */}
                <text
                  x={13}
                  y={showSubtitle ? Math.min(layout.h - 10, 55) : 39}
                  fill={node.color}
                  fontSize={11.5}
                  fontWeight={600}
                  fontFamily={SVG_FONT_FAMILY}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                  className="pointer-events-none"
                >
                  {node.count.toLocaleString()} ({node.pct}%)
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right-Hand Path Insight Drawer */}
      {selectedItem && (
        <div className="absolute top-3 bottom-3 right-4 w-[360px] rounded-2xl z-30 apple-glass-heavy glass-enter flex flex-col overflow-hidden">
          {/* Drawer Header */}
          <div className="px-4 py-3.5 border-b border-white/[0.08] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-[#E4002B]/20 text-[#E4002B] inline-block mb-1">
                {selectedItem.type === "node" ? "STAGE COHORT" : "TRANSITION PATH"}
              </span>
              <div className="text-xs font-semibold text-white truncate">
                {resolveItemTitle(selectedItem)}
              </div>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
              aria-label="Close path inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Volume & Spend Stats */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div className="text-[10px] text-white/50 mb-0.5">PLAYERS · SHARE</div>
                <div className="text-base font-mono font-semibold text-white tabular">
                  {selectedItem.data.count.toLocaleString()}{" "}
                  <span className="text-xs text-white/55 font-normal">
                    ({selectedItem.data.pct}%)
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div className="text-[10px] text-white/50 mb-0.5">CUMULATIVE VC LTV</div>
                <div className="text-base font-mono font-semibold text-[#F5B400] tabular">
                  ${selectedItem.data.spend.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Idea 4 & Idea 6: Dennis Ceccarelli's Golden Path vs. Reactive Frustration Telemetry Clustering + Cox Survival Shift */}
            {(() => {
              const itemId =
                selectedItem.type === "node"
                  ? (selectedItem.data as SankeyNode).id
                  : `${(selectedItem.data as SankeyLink).source}->${
                      (selectedItem.data as SankeyLink).target
                    }`;

              const isGoldenPath =
                itemId.includes("85plus") ||
                itemId.includes("whale") ||
                itemId.includes("retained") ||
                itemId.includes("expansion") ||
                itemId.includes("hof_pass") ||
                itemId.includes("deluxe_pack");
              const isMatchmakingTilt = itemId.includes("churn");
              const isSoloDrift =
                itemId.includes("holdout") ||
                itemId.includes("returning") ||
                itemId.includes("2k26_upgrade") ||
                itemId.includes("mynba");
              const activeClusterKey = isGoldenPath
                ? "golden"
                : isMatchmakingTilt
                ? "tilt"
                : isSoloDrift
                ? "drift"
                : "wall";

              const clusters = [
                {
                  key: "golden",
                  label: "Golden Path · On-Track",
                  spec: "88+ OVR · <2 Loss Streak · T50 > 26d",
                  nodeId: "status_85plus",
                  accent: "text-[#19C37D] border-[#19C37D]/35 bg-[#19C37D]/10",
                },
                {
                  key: "wall",
                  label: "Reactive Trigger · Build Wall Stall",
                  spec: "78-84 OVR · <15K VC Balance · T50 = Day 9",
                  nodeId: "status_sub85_cliff",
                  accent: "text-[#FF4D5E] border-[#FF4D5E]/35 bg-[#FF4D5E]/10",
                },
                {
                  key: "tilt",
                  label: "Reactive Trigger · Matchmaking Tilt",
                  spec: "3+ Park Loss Streak · Rage-Quit Risk · T50 = Day 7",
                  nodeId: "out_churn",
                  accent: "text-amber-300 border-amber-400/35 bg-amber-500/10",
                },
                {
                  key: "drift",
                  label: "Reactive Trigger · Solo Queue Drift",
                  spec: "Inactive Crew Mates · T50 = Day 11",
                  nodeId: "status_2k26_holdout",
                  accent: "text-cyan-300 border-cyan-400/35 bg-cyan-500/10",
                },
              ];

              return (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white">
                      Telemetry Trajectory Clustering
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#19C37D]/15 text-[#19C37D] border border-[#19C37D]/30 tabular">
                      +12.0d Lifespan with Crew Re-Up
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {clusters.map((c) => {
                      const isActive = c.key === activeClusterKey;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => {
                            const targetNode = nodeById.get(c.nodeId);
                            if (targetNode) handleSelectNode(targetNode);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                            isActive
                              ? c.accent
                              : "bg-black/30 border-white/[0.06] text-white/70 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold truncate">
                              {c.label}
                            </div>
                            <div className="text-[10px] font-mono opacity-80 truncate tabular">
                              {c.spec}
                            </div>
                          </div>
                          {isActive && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/40 border border-current shrink-0">
                              Active
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Cox Survival Shift Bar */}
                  <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono tabular">
                    <span className="text-rose-300">Baseline T50: Day 9</span>
                    <span className="text-white/40">→</span>
                    <span className="text-[#19C37D] font-semibold">
                      Crew Re-Up T50: Day 21 (+12.0d)
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 1-Sentence Takeaway */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
                <Flame className="w-3.5 h-3.5 text-[#F5B400] shrink-0" />
                <span>Lifecycle Takeaway</span>
              </div>
              {isPathLoading ? (
                <div className="py-1.5 flex items-center gap-2 text-xs text-white/60">
                  <RefreshCw className="w-3.5 h-3.5 courtside-Transfer-pulse text-[#E4002B]" />
                  <span>Analyzing cohort transition...</span>
                </div>
              ) : (
                <p className="text-xs text-white/75 leading-relaxed">
                  {pathDiagnosis ||
                    diagnosis ||
                    "Targeted Season 1 interventions convert stalled MyPLAYER builds and 2K26 holdout veterans into active Season 2 squads."}
                </p>
              )}
            </div>

            {/* Sampled Players List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-white/90">
                <span>Sampled Players</span>
                <span className="text-[10px] text-white/50 font-mono tabular">
                  {selectedItem.data.sampled_players?.length || 0} sampled
                </span>
              </div>
              <div className="space-y-1.5">
                {(selectedItem.data.sampled_players || []).map((p: any) => (
                  <button
                    key={p.player_id}
                    type="button"
                    onClick={() => onSelectPlayer?.(p.player_id)}
                    className="pressable w-full p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] flex items-center justify-between text-left cursor-pointer transition-colors text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-white truncate">{p.gamer_tag}</div>
                      <div className="text-[10px] text-white/50 font-mono truncate">
                        {p.dma_market} · {archetypeLabel(p.primary_archetype)}
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0 tabular">
                      {p.ovr && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-white font-medium mr-1.5">
                          {p.ovr} OVR
                        </span>
                      )}
                      <span className="text-[#F5B400] font-medium text-[11px]">
                        ${(p.spend || 0).toFixed(0)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="p-3.5 border-t border-white/[0.08] bg-[#0A0A0C]/80 flex gap-2">
            <button
              type="button"
              onClick={handleLaunchPressureTest}
              className="pressable flex-1 py-2 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-white flex items-center justify-center gap-1.5 border border-white/10"
            >
              <Users className="w-3.5 h-3.5 text-[#F5B400]" />
              Pressure-Test Cohort
            </button>
            <button
              type="button"
              onClick={handleLaunchActivation}
              className="pressable flex-1 py-2 px-3 rounded-xl bg-[#E4002B] hover:bg-[#A3001F] text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-lg shadow-[#E4002B]/20"
            >
              <Zap className="w-3.5 h-3.5" />
              Activate Segment
            </button>
          </div>
        </div>
      )}

      {/* Draw-in animation */}
      <style jsx>{`
        @keyframes sankeyDrawIn {
          from {
            stroke-dashoffset: 1000;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

// Alias for backwards compatibility
export const PlayerMarketingJourneySankey = SeasonJourneySankey;
export default SeasonJourneySankey;
