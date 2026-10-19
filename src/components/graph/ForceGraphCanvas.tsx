"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import ForceGraph3D from "react-force-graph-3d";
import { GraphData, GraphNode, SegmentationLens } from "@/lib/types";
import { archetypeLabel } from "@/lib/archetypes";
import { STUDIOS, STUDIO_COLORS, STUDIO_NAMES, type Studio } from "@/lib/studios";
import {
  nodeStudio,
  buildLensContext,
  classifyNodeForLens,
  computeKeystoneCaptains,
} from "@/lib/lens";
import { X } from "lucide-react";

export { nodeStudio, buildLensContext, classifyNodeForLens };
export type { LensClassification, LensContext } from "@/lib/lens";

export interface ForceGraphCanvasProps {
  data: GraphData;
  is3D?: boolean;
  selectedNode: GraphNode | null;
  onNodeClick: (node: GraphNode) => void;
  width?: number;
  height?: number;
  viewMode?: string;
  activeCohortName?: string | null;
  onClearCohort?: () => void;
  showLabelClusters?: boolean;
  clusterByLabel?: boolean;
  highlightBridges?: boolean;
  segmentationLens?: SegmentationLens;
  /** Manual segmentation: ids of players picked with Shift+click. */
  manualSelectionIds?: Set<string>;
  onToggleManualSelect?: (node: GraphNode) => void;
}

/** Studio cluster anchors match the API's studio sectors (2K top, Rockstar left, Zynga right). */
const STUDIO_CLUSTER_ANCHORS: Record<Studio, { x: number; y: number }> = {
  "2K": { x: 0, y: -260 },
  ROCKSTAR: { x: -200, y: 200 },
  ZYNGA: { x: 200, y: 200 },
};

/** Edge styles shared by the 2D painter, the 3D renderer and the legend. */
const EDGE_STYLES: Array<{ key: string; name: string; color: string; rest: string; dashed?: boolean }> = [
  { key: "PLAYS_GAME", name: "Plays", color: "#9CA3AF", rest: "rgba(255, 255, 255, 0.07)" },
  { key: "CROSS_STUDIO_PLAY", name: "Cross-studio play", color: "#A78BFA", rest: "rgba(167, 139, 250, 0.22)" },
  { key: "CROSS_FRANCHISE_PLAY", name: "Cross-title play", color: "#00D2FF", rest: "rgba(0, 210, 255, 0.14)" },
  { key: "WISHLISTED", name: "Wishlisted", color: "#FFD24D", rest: "rgba(255, 210, 77, 0.22)", dashed: true },
  { key: "INVITED", name: "Invited", color: "#2FD38A", rest: "rgba(47, 211, 138, 0.70)" },
  { key: "PLAYED_WITH", name: "Played with", color: "#2FD38A", rest: "rgba(47, 211, 138, 0.50)" },
  { key: "FRIENDS_WITH", name: "Friends with", color: "#9B72CB", rest: "rgba(155, 114, 203, 0.50)" },
  { key: "MEMBER_OF_CLAN", name: "Crew member", color: "#00F59B", rest: "rgba(0, 245, 155, 0.25)" },
  { key: "FOLLOWS_CREATOR", name: "Follows creator", color: "#00F0FF", rest: "rgba(0, 240, 255, 0.20)" },
  { key: "OWNS_SKU", name: "Owns offer", color: "#FFB800", rest: "rgba(255, 184, 0, 0.22)" },
  { key: "HAS_IDENTITY", name: "Linked identity", color: "#A855F7", rest: "rgba(168, 85, 247, 0.35)" },
];

function edgeStyleOf(label?: string) {
  const l = String(label || "");
  return EDGE_STYLES.find((s) => l.startsWith(s.key)) || null;
}

const NODE_TYPE_LEGEND: Array<{ type: string; name: string; color: string }> = [
  { type: "GAME", name: "Title hub", color: "#FFFFFF" },
  { type: "CLAN", name: "Crew", color: "#00F59B" },
  { type: "CREATOR", name: "Creator", color: "#00F0FF" },
  { type: "OFFER", name: "Offer", color: "#EC4899" },
  { type: "IDENTITY", name: "Identity", color: "#A855F7" },
  { type: "SQUADMATE", name: "Crew mate", color: "#00D2FF" },
];

export default function ForceGraphCanvas({
  data: rawData,
  is3D = false,
  selectedNode,
  onNodeClick,
  width,
  height,
  viewMode,
  activeCohortName,
  onClearCohort,
  showLabelClusters = false,
  clusterByLabel = false,
  highlightBridges = false,
  segmentationLens = "FRANCHISE",
  manualSelectionIds,
  onToggleManualSelect,
}: ForceGraphCanvasProps) {
  const fgRef = useRef<any>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [fallbackDims, setFallbackDims] = useState({ width: 1440, height: 848 });
  // Legend toggles: studios whose players / titles / crews are hidden.
  const [hiddenStudios, setHiddenStudios] = useState<Set<Studio>>(new Set());

  const data = useMemo<GraphData>(() => {
    if (hiddenStudios.size === 0) return rawData;
    const keep = new Set<string>();
    const nodes = rawData.nodes.filter((n) => {
      const studioScoped =
        n.type === "PLAYER" || n.type === "GAME" || n.type === "CLAN" || n.type === "SQUADMATE";
      const hide = studioScoped && hiddenStudios.has(nodeStudio(n));
      if (!hide) keep.add(n.id);
      return !hide;
    });
    const idOf = (v: any) => (typeof v === "object" ? v.id : String(v));
    const links = rawData.links.filter(
      (l) => keep.has(idOf(l.source)) && keep.has(idOf(l.target))
    );
    return { nodes, links };
  }, [rawData, hiddenStudios]);

  const lensCtx = useMemo(() => buildLensContext(data.nodes), [data.nodes]);
  // Fit the camera once per loaded dataset so every studio sector is in view.
  const fittedRef = useRef<GraphData | null>(null);
  const handleEngineStop = useCallback(() => {
    if (fittedRef.current === rawData) return;
    fittedRef.current = rawData;
    fgRef.current?.zoomToFit?.(600, 70);
  }, [rawData]);
  const hubStudios = useMemo(
    () => new Set(data.nodes.filter((n) => n.type === "GAME").map((n) => nodeStudio(n))),
    [data.nodes]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncDims = () => {
      setFallbackDims({ width: window.innerWidth, height: Math.max(400, window.innerHeight - 52) });
    };
    syncDims();
    window.addEventListener("resize", syncDims);
    return () => window.removeEventListener("resize", syncDims);
  }, []);

  const resolvedWidth = width ?? fallbackDims.width;
  const resolvedHeight = height ?? fallbackDims.height;
  const enableDivisionClusters = clusterByLabel || showLabelClusters;

  // Fast set lookup for connected links and neighbors to highlight paths on hover/select
  const highlightLinks = useMemo(() => {
    const set = new Set<string>();
    const active = selectedNode || hoveredNode;
    if (!active) return set;

    data.links.forEach((l: any) => {
      const sId = typeof l.source === "object" ? l.source.id : l.source;
      const tId = typeof l.target === "object" ? l.target.id : l.target;
      if (sId === active.id || tId === active.id) {
        set.add(`${sId}->${tId}`);
      }
    });
    return set;
  }, [data.links, selectedNode, hoveredNode]);

  // Check if multi-hop bridge edges are present in the active graph
  const multiHopBridgeCount = useMemo(() => {
    return (data.links || []).filter((l: any) => Boolean(l.isMultiHopBridge)).length;
  }, [data.links]);

  // Idea 3: Compute Keystone Crew Captains (REC_CREW_CAPTAIN, PARK_REP_GRINDER, or >= 3 social edges)
  const keystoneCaptainIds = useMemo(
    () => computeKeystoneCaptains(data.nodes || [], data.links || []),
    [data.nodes, data.links]
  );

  // Live lens bucket breakdown for the Floating Lens Breakdown Pill
  const lensBreakdown = useMemo(() => {
    if (
      segmentationLens === "FRANCHISE" ||
      segmentationLens === "ARCHETYPE" ||
      segmentationLens === "SOCIAL_HOPS"
    )
      return [];

    const bucketDefs: Array<{
      bucketId: string;
      label: string;
      actionTag: string;
      color: string;
    }> =
      segmentationLens === "CATE_UPLIFT"
        ? [
            {
              bucketId: "PERSUADABLE",
              label: "Persuadables",
              actionTag: "Target",
              color: "#19C37D",
            },
            {
              bucketId: "SEED_CREW_CAPTAIN",
              label: "Keystone Captains",
              actionTag: "Seed",
              color: "#F5B400",
            },
            {
              bucketId: "SURE_THING_D2C",
              label: "Sure Things",
              actionTag: "Hold discount",
              color: "#38BDF8",
            },
            {
              bucketId: "SLEEPING_DOG",
              label: "Sleeping Dogs",
              actionTag: "Suppress",
              color: "#FF4D5E",
            },
          ]
        : segmentationLens === "PORTFOLIO_RINGS"
        ? [
            {
              bucketId: "RING_1_CORE",
              label: "Ring 1 · Core",
              actionTag: "Retain",
              color: "#19C37D",
            },
            {
              bucketId: "RING_2_NURTURE",
              label: "Ring 2 · Nurture",
              actionTag: "Crew & low spend",
              color: "#F5B400",
            },
            {
              bucketId: "RING_3_STRETCH",
              label: "Ring 3 · Stretch",
              actionTag: "Cross-studio",
              color: "#A855F7",
            },
          ]
        : [
            {
              bucketId: "GOLDEN_PATH",
              label: "Golden Path",
              actionTag: "Healthy",
              color: "#19C37D",
            },
            {
              bucketId: "WHALE_VELOCITY_DECAY",
              label: "Whale Decay",
              actionTag: "Guard spend",
              color: "#38BDF8",
            },
            {
              bucketId: "BADGE_WALL_STALL",
              label: "Progress Stall",
              actionTag: "Boost OVR / re-engage",
              color: "#F5B400",
            },
            {
              bucketId: "REACTIVE_TILT_META",
              label: "Reactive Tilt",
              actionTag: "Rescue",
              color: "#FF4D5E",
            },
          ];

    const counts = new Map<string, number>();
    bucketDefs.forEach((b) => counts.set(b.bucketId, 0));

    (data.nodes || []).forEach((n: GraphNode) => {
      if (n.type !== "PLAYER") return;
      const cls = classifyNodeForLens(n, keystoneCaptainIds, segmentationLens, lensCtx);
      if (cls) {
        counts.set(cls.bucketId, (counts.get(cls.bucketId) || 0) + 1);
      }
    });

    return bucketDefs.map((b) => ({
      ...b,
      count: counts.get(b.bucketId) || 0,
    }));
  }, [data.nodes, keystoneCaptainIds, segmentationLens, lensCtx]);

  // Configure custom D3 forces: abk physics tuning + Segmentation Lens clustering
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || is3D) return;

    const chargeForce = fg.d3Force("charge");
    if (chargeForce) {
      chargeForce.strength(-110);
      if (typeof chargeForce.distanceMax === "function") {
        chargeForce.distanceMax(520);
      }
    }

    fg.d3Force("link")?.distance((link: any) => {
      if (link.isMultiHopBridge) return 100;
      if (
        link.label === "PLAYS_GAME" ||
        link.label === "PRIMARY_FRANCHISE_PLAYER" ||
        link.label === "BASE_GAME_RETAIL_PURCHASER" ||
        link.value === 2
      ) {
        return 100;
      }
      if (link.label === "MONETIZATION_GRAVITY" || link.label === "OWNS_SKU") return 110;
      if (link.isTriggerStream) return 120;
      return 130;
    });

    if (enableDivisionClusters && segmentationLens === "FRANCHISE") {
      fg.d3Force("divisionCluster", (alpha: number) => {
        for (const node of data.nodes as any[]) {
          if (node.fx !== undefined && node.fy !== undefined) continue;
          const target = STUDIO_CLUSTER_ANCHORS[nodeStudio(node)];
          node.vx = (node.vx || 0) + (target.x - (node.x || 0)) * alpha * 0.12;
          node.vy = (node.vy || 0) + (target.y - (node.y || 0)) * alpha * 0.12;
        }
      });
    } else {
      fg.d3Force("divisionCluster", null);
    }

    if (segmentationLens === "CATE_UPLIFT" || segmentationLens === "TRAJECTORY") {
      fg.d3Force("lensCluster", (alpha: number) => {
        for (const node of data.nodes as any[]) {
          if (node.type !== "PLAYER") continue;
          if (node.fx !== undefined && node.fy !== undefined) continue;
          const cls = classifyNodeForLens(node, keystoneCaptainIds, segmentationLens, lensCtx);
          if (cls?.anchor) {
            node.vx = (node.vx || 0) + (cls.anchor.x - (node.x || 0)) * alpha * 0.14;
            node.vy = (node.vy || 0) + (cls.anchor.y - (node.y || 0)) * alpha * 0.14;
          }
        }
      });
    } else if (segmentationLens === "PORTFOLIO_RINGS") {
      fg.d3Force("lensCluster", (alpha: number) => {
        for (const node of data.nodes as any[]) {
          if (node.type !== "PLAYER") continue;
          if (node.fx !== undefined && node.fy !== undefined) continue;
          const cls = classifyNodeForLens(node, keystoneCaptainIds, "PORTFOLIO_RINGS", lensCtx);
          const targetR = cls?.targetRadius || 220;
          const x = node.x || 0.01;
          const y = node.y || 0.01;
          const dist = Math.sqrt(x * x + y * y) || 1;
          const deltaR = (targetR - dist) * alpha * 0.16;
          node.vx = (node.vx || 0) + (x / dist) * deltaR;
          node.vy = (node.vy || 0) + (y / dist) * deltaR;
        }
      });
    } else {
      fg.d3Force("lensCluster", null);
    }

    fg.d3ReheatSimulation?.();
  }, [data, is3D, enableDivisionClusters, segmentationLens, keystoneCaptainIds, lensCtx]);

  // Directional Particle Streams (5 directional hop particles)
  const getLinkParticles = useCallback(
    (link: any) => {
      const sId = typeof link.source === "object" ? link.source.id : link.source;
      const tId = typeof link.target === "object" ? link.target.id : link.target;
      const isHighlighted = highlightLinks.has(`${sId}->${tId}`);

      if (isHighlighted) return 5;
      if (link.isMultiHopBridge) return 5;
      if (link.isTriggerStream) return 2;
      return 0;
    },
    [highlightLinks]
  );

  const getLinkParticleSpeed = useCallback((link: any) => {
    if (link.isMultiHopBridge) return link.hopStep === 1 ? 0.016 : link.hopStep === 2 ? 0.012 : 0.009;
    if (link.isTriggerStream) return 0.012;
    if (link.label === "MONETIZATION_GRAVITY" || link.label === "OWNS_SKU") return 0.008;
    return 0.005;
  }, []);

  const getLinkParticleColor = useCallback((link: any) => {
    if (link.isMultiHopBridge) {
      if (link.hopStep === 1) return "#00F59B"; // Hop 1: Emerald (Player -> Crew / 2K Account)
      if (link.hopStep === 2) return "#00D2FF"; // Hop 2: Cyan (Crew -> Squadmate / 2K26 Bridge)
      if (link.hopStep === 3) return "#FF5722"; // Hop 3: Target 2K Title Orange-Red
      return "#00F59B";
    }
    const style = edgeStyleOf(link.label);
    if (style) return style.color;
    if (link.isTriggerStream) return "#FF4757";
    return "#00FF88";
  }, []);

  // Pre-frame canvas guide renderer for Segmentation Lenses (3-Ring Concentric Guides & Quadrant Anchors)
  const paintLensGuides2D = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (segmentationLens === "PORTFOLIO_RINGS") {
        const rings = [
          { r: 105, color: "rgba(25, 195, 125, 0.28)", text: "RING 1 · CORE" },
          { r: 220, color: "rgba(245, 180, 0, 0.26)", text: "RING 2 · CREW & NURTURE" },
          { r: 335, color: "rgba(168, 85, 247, 0.26)", text: "RING 3 · CROSS-STUDIO STRETCH" },
        ];
        ctx.save();
        rings.forEach((ring) => {
          ctx.beginPath();
          ctx.setLineDash([5 / globalScale, 5 / globalScale]);
          ctx.arc(0, 0, ring.r, 0, 2 * Math.PI, false);
          ctx.strokeStyle = ring.color;
          ctx.lineWidth = 1.4 / globalScale;
          ctx.stroke();

          const fontSize = Math.max(8.5 / globalScale, 2.5);
          ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = ring.color.replace(/0\.2[68]/, "0.68");
          ctx.fillText(ring.text, 0, -ring.r - 4 / globalScale);
        });
        ctx.restore();
      } else if (segmentationLens === "CATE_UPLIFT" || segmentationLens === "TRAJECTORY") {
        const quads =
          segmentationLens === "CATE_UPLIFT"
            ? [
                { x: -240, y: -150, label: "KEYSTONE CAPTAINS (SEED)", color: "rgba(245, 180, 0, 0.55)" },
                { x: 240, y: -150, label: "SURE THINGS (HOLD DISCOUNT)", color: "rgba(56, 189, 248, 0.55)" },
                { x: -240, y: 150, label: "PERSUADABLES (TARGET)", color: "rgba(25, 195, 125, 0.55)" },
                { x: 240, y: 150, label: "SLEEPING DOGS (SUPPRESS)", color: "rgba(255, 77, 94, 0.55)" },
              ]
            : [
                { x: -240, y: -150, label: "GOLDEN PATH", color: "rgba(25, 195, 125, 0.55)" },
                { x: 240, y: -150, label: "WHALE VELOCITY DECAY", color: "rgba(56, 189, 248, 0.55)" },
                { x: -240, y: 150, label: "PROGRESS STALL", color: "rgba(245, 180, 0, 0.55)" },
                { x: 240, y: 150, label: "REACTIVE TILT / CHURN", color: "rgba(255, 77, 94, 0.55)" },
              ];
        ctx.save();
        const fontSize = Math.max(9 / globalScale, 2.5);
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        quads.forEach((q) => {
          ctx.beginPath();
          ctx.setLineDash([4 / globalScale, 4 / globalScale]);
          ctx.arc(q.x, q.y, 78, 0, 2 * Math.PI, false);
          ctx.strokeStyle = q.color.replace("0.55", "0.18");
          ctx.lineWidth = 1.1 / globalScale;
          ctx.stroke();

          ctx.fillStyle = q.color;
          ctx.fillText(q.label, q.x, q.y - 86);
        });
        ctx.restore();
      } else if (segmentationLens === "FRANCHISE" && hubStudios.size > 1) {
        // Studio sector captions for the macro constellation.
        const sectors: Record<Studio, number> = { "2K": -90, ROCKSTAR: 135, ZYNGA: 45 };
        ctx.save();
        const fontSize = Math.max(11 / globalScale, 3);
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        Array.from(hubStudios).forEach((s) => {
          const a = (sectors[s] * Math.PI) / 180;
          ctx.fillStyle = `${STUDIO_COLORS[s]}B3`;
          ctx.fillText(STUDIO_NAMES[s].toUpperCase(), Math.cos(a) * 200, Math.sin(a) * 200);
        });
        ctx.restore();
      }
    },
    [segmentationLens, hubStudios]
  );

  // Custom 2D node renderer: solid core + white stroke for anchors, plain dots for players.
  const paintNode2D = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (typeof node.x !== "number" || typeof node.y !== "number") return;

      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isPicked = Boolean(manualSelectionIds?.has(node.id));
      const isAnchor = node.type === "GAME";
      const isPreLaunch = isAnchor && node.lifecycle_status === "PRE_LAUNCH";
      const isOffer = node.type === "OFFER";
      const isCreator = node.type === "CREATOR";
      const isClan = node.type === "CLAN";
      const isSquadmate = node.type === "SQUADMATE";
      const isIdentity = node.type === "IDENTITY";
      const isPlayer = node.type === "PLAYER";
      const isKeystoneCaptain = isPlayer && keystoneCaptainIds.has(node.id);
      const isTopSpender =
        isPlayer && Number(node.spend || 0) > 0 && Number(node.spend || 0) >= lensCtx.spendP80[nodeStudio(node)];
      const lensClassification = isPlayer
        ? classifyNodeForLens(node, keystoneCaptainIds, segmentationLens, lensCtx)
        : null;

      const baseRadius = isAnchor
        ? 18
        : isCreator || isClan
        ? 14
        : isOffer || isIdentity
        ? 13
        : isSquadmate
        ? 8
        : isTopSpender
        ? 6.5
        : isKeystoneCaptain
        ? 6
        : 5;
      const radius = isSelected ? baseRadius * 1.35 : isHovered ? baseRadius * 1.2 : baseRadius;
      const anchorColor: string = node.color || "#9CA3AF";

      // 1. Soft halo for anchors and the focused node.
      if (isSelected || isHovered || isAnchor || isClan || isCreator || isOffer || isIdentity) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + (isAnchor ? 12 : 8), 0, 2 * Math.PI, false);
        ctx.fillStyle = isSelected ? "rgba(255, 255, 255, 0.40)" : `${anchorColor}38`;
        ctx.fill();
      }

      // 2. Core.
      if (isPlayer) {
        const fill =
          lensClassification?.color ||
          (segmentationLens === "ARCHETYPE" || segmentationLens === "SOCIAL_HOPS"
            ? node.color || "#7C8799"
            : STUDIO_COLORS[nodeStudio(node)]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = fill;
        ctx.fill();
        if (isSelected || isHovered) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#FFFFFF";
          ctx.stroke();
        }
      } else if (isPreLaunch) {
        // Pre-launch title: hollow dashed ring (intent only, nobody plays it yet).
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = "rgba(6, 8, 14, 0.92)";
        ctx.fill();
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = anchorColor;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = anchorColor;
        ctx.fill();
        ctx.lineWidth = isAnchor ? 3 : 2.2;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.4, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      }

      // 3. Manual segment marker (Shift+click).
      if (isPicked) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 3.2, 0, 2 * Math.PI, false);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();
      }

      // 4. Label pill.
      const showLabel =
        isAnchor || isOffer || isCreator || isClan || isIdentity || isSquadmate ||
        isSelected || isHovered || globalScale > 1.4;
      if (!showLabel || !node.name) return;

      const fontSize = isAnchor
        ? 11.5 / globalScale
        : isClan || isCreator
        ? 10.5 / globalScale
        : isOffer || isIdentity
        ? 10 / globalScale
        : 9 / globalScale;
      ctx.font = `600 ${Math.max(fontSize, 2.5)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const rawLabel = String(node.name || "").replace(/\s*—\s*/g, " · ");
      const cleanLabel = rawLabel.length > 32 ? `${rawLabel.slice(0, 30)}...` : rawLabel;
      const text = isPlayer && isSelected ? `${cleanLabel} ($${Math.round(node.spend || 0)})` : cleanLabel;

      const isUpper = node.y < -40;
      const offsetDist = (isAnchor ? 15 : isCreator || isClan ? 13 : isOffer || isIdentity ? 12 : 9) / globalScale;
      const textY = isUpper ? node.y - radius - offsetDist : node.y + radius + offsetDist;
      const textWidth = ctx.measureText(text).width;
      const padX = 7 / globalScale;
      const padY = 3.5 / globalScale;
      ctx.beginPath();
      ctx.roundRect(
        node.x - textWidth / 2 - padX,
        textY - fontSize / 2 - padY,
        textWidth + padX * 2,
        fontSize + padY * 2,
        4 / globalScale
      );
      ctx.fillStyle = "rgba(6, 9, 15, 0.90)";
      ctx.fill();
      ctx.lineWidth = 1.1 / globalScale;
      ctx.strokeStyle = isPlayer ? (isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.25)") : anchorColor;
      ctx.stroke();
      ctx.fillStyle = isPlayer ? "#F5F5F7" : isAnchor ? "#FFFFFF" : anchorColor;
      ctx.fillText(text, node.x, textY);
    },
    [selectedNode, hoveredNode, keystoneCaptainIds, segmentationLens, lensCtx, manualSelectionIds]
  );

  // Custom 2D link renderer: colour by edge type (see EDGE_STYLES / legend).
  const paintLink2D = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      if (
        !link.source ||
        !link.target ||
        typeof link.source.x !== "number" ||
        typeof link.target.x !== "number"
      ) {
        return;
      }

      const sId = typeof link.source === "object" ? link.source.id : link.source;
      const tId = typeof link.target === "object" ? link.target.id : link.target;
      const isHighlighted = highlightLinks.has(`${sId}->${tId}`);
      const hasActiveSelection = Boolean(selectedNode || hoveredNode);
      const isMultiHop = Boolean(link.isMultiHopBridge);
      const style = edgeStyleOf(link.label);
      const hopColor =
        link.hopStep === 1 ? "0, 245, 155" : link.hopStep === 2 ? "0, 210, 255" : "255, 87, 34";

      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      if (style?.dashed) ctx.setLineDash([3, 3]);

      if (hasActiveSelection && !isHighlighted) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
        ctx.lineWidth = 0.4;
      } else if (isMultiHop) {
        ctx.strokeStyle = `rgba(${hopColor}, ${isHighlighted ? 0.95 : 0.5})`;
        ctx.lineWidth = isHighlighted ? 2.4 : 1.3;
      } else if (isHighlighted) {
        ctx.strokeStyle = style ? style.color : "rgba(255, 255, 255, 0.80)";
        ctx.lineWidth = 1.8;
      } else {
        ctx.strokeStyle = style ? style.rest : "rgba(255, 255, 255, 0.07)";
        ctx.lineWidth = style && style.key !== "PLAYS_GAME" ? 0.8 : 0.55;
      }

      ctx.stroke();
      if (style?.dashed) ctx.setLineDash([]);
    },
    [highlightLinks, selectedNode, hoveredNode]
  );

  // Legend entries computed from what is actually on the canvas.
  const legend = useMemo(() => {
    const studioCounts = new Map<Studio, number>();
    const archCounts = new Map<string, { count: number; color: string }>();
    const typeSet = new Set<string>();
    const hopCounts = new Map<number, { count: number; color: string }>();
    let hasPreLaunch = false;
    for (const n of rawData.nodes) {
      if (n.type === "PLAYER") {
        const s = nodeStudio(n);
        studioCounts.set(s, (studioCounts.get(s) || 0) + 1);
        const hop = n.game_telemetry?.social_hop_degree;
        if (typeof hop === "number") {
          const cur = hopCounts.get(hop) || { count: 0, color: n.color || "#FFFFFF" };
          cur.count += 1;
          hopCounts.set(hop, cur);
        }
        const a = String(n.archetype || "");
        if (a) {
          const cur = archCounts.get(a) || { count: 0, color: n.color || "#7C8799" };
          cur.count += 1;
          archCounts.set(a, cur);
        }
      } else {
        typeSet.add(n.type);
        if (n.type === "GAME" && n.lifecycle_status === "PRE_LAUNCH") hasPreLaunch = true;
        if (n.type === "GAME" || n.type === "CLAN") {
          const s = nodeStudio(n);
          if (!studioCounts.has(s)) studioCounts.set(s, 0);
        }
      }
    }
    const edgeKeys = new Set<string>();
    for (const l of data.links) {
      const st = edgeStyleOf(l.label);
      if (st) edgeKeys.add(st.key);
    }
    return {
      studios: STUDIOS.filter((s) => studioCounts.has(s)).map((s) => ({
        id: s,
        count: studioCounts.get(s) || 0,
      })),
      archetypes: Array.from(archCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([id, v]) => ({ id, ...v })),
      types: NODE_TYPE_LEGEND.filter((t) => typeSet.has(t.type)),
      hasPreLaunch,
      hops: Array.from(hopCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([hop, v]) => ({ hop, ...v })),
      edges: EDGE_STYLES.filter((e) => edgeKeys.has(e.key)),
    };
  }, [rawData.nodes, data.links]);

  const toggleStudio = useCallback((s: Studio) => {
    setHiddenStudios((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback(
    (node: any, event?: MouseEvent) => {
      if (event?.shiftKey && node?.type === "PLAYER" && onToggleManualSelect) {
        onToggleManualSelect(node as GraphNode);
        return;
      }
      onNodeClick(node as GraphNode);
    },
    [onNodeClick, onToggleManualSelect]
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: "#06080E" }}
      data-view-mode={viewMode || "audience-cohorts"}
    >
      {/* Top-Left HUD Stack: Multi-Hop Banner + Floating Lens Breakdown Pill */}
      <div className="pointer-events-none absolute top-3 left-4 z-20 flex flex-col items-start gap-2">
        {(multiHopBridgeCount > 0 || activeCohortName || highlightBridges) && (
          <div className="apple-glass pointer-events-auto flex items-center gap-3 rounded-2xl px-3.5 py-2 text-[11px] font-mono text-white shadow-2xl">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{activeCohortName || "Multi-hop path"}</span>
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
              <span className="h-2 w-2 rounded-full bg-[#00F59B]" />
              <span>1st hop</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
              <span className="h-2 w-2 rounded-full bg-[#00D2FF]" />
              <span>2nd hop</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
              <span className="h-2 w-2 rounded-full bg-[#FF5722]" />
              <span>3rd hop</span>
            </span>
            {onClearCohort && (
              <button
                type="button"
                onClick={onClearCohort}
                className="ml-1 rounded-lg bg-white/10 p-1 text-gray-300 hover:bg-white/20 hover:text-white"
                title="Reset Cohort Filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {lensBreakdown.length > 0 && (
          <div
            className="apple-glass pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl px-3.5 py-2 text-[11px] font-mono text-white shadow-2xl"
            data-testid="lens-breakdown-pill"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              {segmentationLens === "CATE_UPLIFT"
                ? "CATE Uplift Lens"
                : segmentationLens === "PORTFOLIO_RINGS"
                ? "3-Ring Portfolio"
                : "Trajectory Lens"}
            </span>
            <span className="h-3 w-px bg-white/15" />
            {lensBreakdown.map((bucket) => (
              <span
                key={bucket.bucketId}
                className="inline-flex items-center gap-1.5 text-[11px] text-gray-200 tabular-nums"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: bucket.color }}
                />
                <span className="font-medium text-white">{bucket.label}:</span>
                <span className="font-semibold text-white">{bucket.count}</span>
                <span className="text-[10px] text-gray-400">
                  ({bucket.actionTag})
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Legend: built from the nodes and edges actually rendered. Studio rows toggle visibility. */}
      <div
        className="apple-glass absolute bottom-9 left-4 z-20 w-[208px] rounded-2xl px-3 py-2.5 text-[11px] text-gray-300 shadow-2xl"
        data-testid="graph-legend"
      >
        {segmentationLens === "SOCIAL_HOPS" && legend.hops.length > 0 ? (
          <>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Players by hop
            </div>
            {legend.hops.map((h) => (
              <div key={h.hop} className="flex items-center justify-between gap-2 py-[1px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: h.color }} />
                  <span>{h.hop === 0 ? "0° seed player" : `${h.hop}° tie`}</span>
                </span>
                <span className="font-mono text-gray-500 tabular-nums">{h.count}</span>
              </div>
            ))}
          </>
        ) : segmentationLens === "ARCHETYPE" ? (
          <>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Players by archetype
            </div>
            {legend.archetypes.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 py-[1px]">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="truncate">{archetypeLabel(a.id)}</span>
                </span>
                <span className="font-mono text-gray-500 tabular-nums">{a.count}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {segmentationLens === "FRANCHISE" ? "Players by studio" : "Studios"}
          </div>
        )}
        <div
          className={
            segmentationLens === "ARCHETYPE" || (segmentationLens === "SOCIAL_HOPS" && legend.hops.length > 0)
              ? "mt-2 border-t border-white/10 pt-1.5"
              : ""
          }
        >
          {legend.studios.map((s) => {
            const hidden = hiddenStudios.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleStudio(s.id)}
                aria-pressed={!hidden}
                title={hidden ? `Show ${STUDIO_NAMES[s.id]}` : `Hide ${STUDIO_NAMES[s.id]}`}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-[2px] text-left transition-colors hover:bg-white/[0.06] ${
                  hidden ? "opacity-40" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: STUDIO_COLORS[s.id] }}
                  />
                  <span className={hidden ? "line-through" : "text-white"}>{STUDIO_NAMES[s.id]}</span>
                </span>
                <span className="font-mono text-gray-500 tabular-nums">{s.count}</span>
              </button>
            );
          })}
        </div>
        {(legend.types.length > 0 || legend.hasPreLaunch) && (
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-white/10 pt-1.5">
            {legend.types.map((t) => (
              <span key={t.type} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full border-2 border-white/90"
                  style={{ backgroundColor: t.type === "GAME" ? "#6B7280" : t.color }}
                />
                <span>{t.name}</span>
              </span>
            ))}
            {legend.hasPreLaunch && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-[#FFD24D]" />
                <span>Pre-launch</span>
              </span>
            )}
          </div>
        )}
        {legend.edges.length > 0 && (
          <div className="mt-2 space-y-0.5 border-t border-white/10 pt-1.5">
            {legend.edges.map((e) => (
              <span key={e.key} className="flex items-center gap-1.5">
                <span
                  className={`w-4 shrink-0 border-t-2 ${e.dashed ? "border-dashed" : ""}`}
                  style={{ borderColor: e.color }}
                />
                <span>{e.name}</span>
              </span>
            ))}
          </div>
        )}
        {onToggleManualSelect && (
          <div className="mt-2 border-t border-white/10 pt-1.5 text-[10px] text-gray-500">
            Shift+click players to build a segment
          </div>
        )}
      </div>

      {is3D ? (
        <ForceGraph3D
          ref={fgRef}
          width={resolvedWidth}
          height={resolvedHeight}
          graphData={data}
          nodeLabel={(n: any) => String(n.name || "").replace(/—/g, "·")}
          nodeColor={(n: any) => {
            if (n.type === "PLAYER") {
              const cls = classifyNodeForLens(n, keystoneCaptainIds, segmentationLens, lensCtx);
              if (cls?.color) return cls.color;
              if (segmentationLens !== "ARCHETYPE" && segmentationLens !== "SOCIAL_HOPS")
                return STUDIO_COLORS[nodeStudio(n)];
            }
            return n.color || "#00F0FF";
          }}
          nodeVal={(n: any) => n.val || 7}
          nodeRelSize={4}
          linkColor={(l: any) =>
            l.isMultiHopBridge
              ? l.hopStep === 1
                ? "rgba(0, 245, 155, 0.8)"
                : l.hopStep === 2
                ? "rgba(0, 210, 255, 0.8)"
                : "rgba(255, 87, 34, 0.8)"
              : edgeStyleOf(l.label)?.rest || "rgba(255,255,255,0.15)"
          }
          linkWidth={(l: any) =>
            l.isMultiHopBridge || (edgeStyleOf(l.label) && edgeStyleOf(l.label)!.key !== "PLAYS_GAME")
              ? 1.6
              : 0.8
          }
          linkDirectionalParticles={getLinkParticles}
          linkDirectionalParticleSpeed={getLinkParticleSpeed}
          linkDirectionalParticleColor={getLinkParticleColor}
          linkDirectionalParticleWidth={2.8}
          onNodeClick={(node: any, event: MouseEvent) => handleNodeClick(node, event)}
          onNodeHover={(node: any) => setHoveredNode((node as GraphNode) || null)}
          backgroundColor="#06080E"
          enableNodeDrag={true}
        />
      ) : (
        <ForceGraph2D
          ref={fgRef}
          width={resolvedWidth}
          height={resolvedHeight}
          graphData={data}
          backgroundColor="#06080E"
          onRenderFramePre={paintLensGuides2D}
          nodeCanvasObject={paintNode2D}
          nodeCanvasObjectMode={() => "replace"}
          linkColor={() => "rgba(0,0,0,0)"}
          linkCanvasObject={paintLink2D}
          linkCanvasObjectMode={() => "after"}
          linkDirectionalParticles={getLinkParticles}
          linkDirectionalParticleSpeed={getLinkParticleSpeed}
          linkDirectionalParticleColor={getLinkParticleColor}
          linkDirectionalParticleWidth={2.6}
          onNodeClick={(node: any, event: MouseEvent) => handleNodeClick(node, event)}
          onNodeHover={(node: any) => setHoveredNode((node as GraphNode) || null)}
          enableNodeDrag={true}
          cooldownTicks={120}
          onEngineStop={handleEngineStop}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
        />
      )}
    </div>
  );
}
