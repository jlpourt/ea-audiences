"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import ForceGraph3D from "react-force-graph-3d";
import { GraphData, GraphNode, TakeTwoLabel, SegmentationLens } from "@/lib/types";
import { X } from "lucide-react";

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
}

export interface LensClassification {
  bucketId: string;
  label: string;
  actionTag: string;
  color: string;
  anchor?: { x: number; y: number };
  targetRadius?: number;
}

export function classifyNodeForLens(
  node: GraphNode,
  keystoneCaptainIds: Set<string>,
  lens: SegmentationLens
): LensClassification | null {
  if (node.type !== "PLAYER" || lens === "FRANCHISE") return null;

  const spend = Number(node.spend || 0);
  const churn = Number(node.churn_risk || 0);
  const tilt = Number(node.tilt || 0);
  const lossStreak = Number(node.loss_streak || 0);
  const archetype = String(node.archetype || "");
  const franchise = String(node.franchise || "NBA2K");
  const tel = node.game_telemetry || {};
  const ovr = tel.myplayer_ovr !== undefined && tel.myplayer_ovr !== null ? Number(tel.myplayer_ovr) : 88;
  const lastLoginDays = Number(tel.last_login_days_ago || 0);

  if (lens === "CATE_UPLIFT") {
    if (
      keystoneCaptainIds.has(node.id) ||
      archetype === "REC_CREW_CAPTAIN" ||
      archetype === "PARK_REP_GRINDER"
    ) {
      return {
        bucketId: "SEED_CREW_CAPTAIN",
        label: "Keystone Captains",
        actionTag: "Seed",
        color: "#F5B400",
        anchor: { x: -240, y: -150 },
      };
    }
    if (
      tilt >= 0.58 ||
      lossStreak >= 3 ||
      archetype === "RAGE_QUIT_TILT_RISK" ||
      archetype === "MYNBA_FRANCHISE_SIM"
    ) {
      return {
        bucketId: "SLEEPING_DOG",
        label: "Sleeping Dogs",
        actionTag: "Suppress",
        color: "#FF4D5E",
        anchor: { x: 240, y: 150 },
      };
    }
    if (
      spend >= 420 ||
      archetype === "MYTEAM_PACK_WHALE" ||
      tel.season_pass_edition === "HALL_OF_FAME"
    ) {
      return {
        bucketId: "SURE_THING_D2C",
        label: "Sure Things",
        actionTag: "Route D2C +22%",
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
      franchise !== "NBA2K" ||
      archetype === "CROSS_LABEL_NOMAD" ||
      tel.migrated_to_2k27 === false
    ) {
      return {
        bucketId: "RING_3_STRETCH",
        label: "Ring 3 · Stretch",
        actionTag: "Cross-2K Bridge",
        color: "#A855F7",
        targetRadius: 335,
      };
    }
    if (ovr < 85 || keystoneCaptainIds.has(node.id) || spend < 150) {
      return {
        bucketId: "RING_2_NURTURE",
        label: "Ring 2 · Nurture",
        actionTag: "Crew & Sub-85",
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
    if (spend >= 320 && (churn >= 0.42 || lastLoginDays >= 4)) {
      return {
        bucketId: "WHALE_VELOCITY_DECAY",
        label: "Whale Decay",
        actionTag: "TimesFM Guard",
        color: "#38BDF8",
        anchor: { x: 240, y: -150 },
      };
    }
    if (lossStreak >= 2 || tilt >= 0.52 || churn >= 0.6) {
      return {
        bucketId: "REACTIVE_TILT_META",
        label: "Reactive Tilt",
        actionTag: "Rebirth Rescue",
        color: "#FF4D5E",
        anchor: { x: 240, y: 150 },
      };
    }
    if (ovr < 85) {
      return {
        bucketId: "BADGE_WALL_STALL",
        label: "Badge Wall",
        actionTag: "Boost OVR",
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

const DIVISION_CLUSTER_ANCHORS: Record<TakeTwoLabel, { x: number; y: number }> = {
  "2K": { x: 0, y: -220 },
  "2K_SPORTS": { x: -340, y: 210 },
  "2K_CORE": { x: 340, y: 210 },
};

export default function ForceGraphCanvas({
  data,
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
}: ForceGraphCanvasProps) {
  const fgRef = useRef<any>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [fallbackDims, setFallbackDims] = useState({ width: 1440, height: 848 });

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
  const keystoneCaptainIds = useMemo(() => {
    const socialDegree = new Map<string, number>();
    (data.links || []).forEach((l: any) => {
      const sId = typeof l.source === "object" ? l.source.id : String(l.source);
      const tId = typeof l.target === "object" ? l.target.id : String(l.target);
      const lbl = String(l.label || "");
      if (
        lbl === "MEMBER_OF_CLAN" ||
        lbl === "PLAYED_WITH" ||
        Boolean(l.isMultiHopBridge) ||
        sId.startsWith("clan-") ||
        tId.startsWith("clan-") ||
        sId.startsWith("mate-") ||
        tId.startsWith("mate-")
      ) {
        socialDegree.set(sId, (socialDegree.get(sId) || 0) + 1);
        socialDegree.set(tId, (socialDegree.get(tId) || 0) + 1);
      }
    });

    const captains = new Set<string>();
    (data.nodes || []).forEach((n: GraphNode) => {
      if (n.type !== "PLAYER") return;
      const arch = String(n.archetype || "");
      const deg = socialDegree.get(n.id) || 0;
      if (
        arch === "REC_CREW_CAPTAIN" ||
        arch === "PARK_REP_GRINDER" ||
        deg >= 3
      ) {
        captains.add(n.id);
      }
    });
    return captains;
  }, [data.nodes, data.links]);

  // Live lens bucket breakdown for the Floating Lens Breakdown Pill
  const lensBreakdown = useMemo(() => {
    if (segmentationLens === "FRANCHISE") return [];

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
              actionTag: "Route D2C +22%",
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
              actionTag: "Crew & Sub-85",
              color: "#F5B400",
            },
            {
              bucketId: "RING_3_STRETCH",
              label: "Ring 3 · Stretch",
              actionTag: "Cross-2K Bridge",
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
              actionTag: "TimesFM Guard",
              color: "#38BDF8",
            },
            {
              bucketId: "BADGE_WALL_STALL",
              label: "Badge Wall",
              actionTag: "Boost OVR",
              color: "#F5B400",
            },
            {
              bucketId: "REACTIVE_TILT_META",
              label: "Reactive Tilt",
              actionTag: "Rebirth Rescue",
              color: "#FF4D5E",
            },
          ];

    const counts = new Map<string, number>();
    bucketDefs.forEach((b) => counts.set(b.bucketId, 0));

    (data.nodes || []).forEach((n: GraphNode) => {
      if (n.type !== "PLAYER") return;
      const cls = classifyNodeForLens(n, keystoneCaptainIds, segmentationLens);
      if (cls) {
        counts.set(cls.bucketId, (counts.get(cls.bucketId) || 0) + 1);
      }
    });

    return bucketDefs.map((b) => ({
      ...b,
      count: counts.get(b.bucketId) || 0,
    }));
  }, [data.nodes, keystoneCaptainIds, segmentationLens]);

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
          const lbl: TakeTwoLabel = node.label || "2K";
          const target = DIVISION_CLUSTER_ANCHORS[lbl] || DIVISION_CLUSTER_ANCHORS["2K"];
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
          const cls = classifyNodeForLens(node, keystoneCaptainIds, segmentationLens);
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
          const cls = classifyNodeForLens(node, keystoneCaptainIds, "PORTFOLIO_RINGS");
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
  }, [data, is3D, enableDivisionClusters, segmentationLens, keystoneCaptainIds]);

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
    if (link.label === "MONETIZATION_GRAVITY" || link.label === "OWNS_SKU") return "#FFB800";
    if (link.label === "MEMBER_OF_CLAN") return "#00F59B";
    if (link.label === "FOLLOWS_CREATOR") return "#00F0FF";
    if (link.label === "CROSS_FRANCHISE_PLAY") return "#00D2FF";
    if (link.isTriggerStream) return "#FF4757";
    return "#00FF88";
  }, []);

  // Pre-frame canvas guide renderer for Segmentation Lenses (3-Ring Concentric Guides & Quadrant Anchors)
  const paintLensGuides2D = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (segmentationLens === "PORTFOLIO_RINGS") {
        const rings = [
          { r: 105, color: "rgba(25, 195, 125, 0.28)", text: "RING 1 · CORE 2K27 (r=105)" },
          { r: 220, color: "rgba(245, 180, 0, 0.26)", text: "RING 2 · CREW & NURTURE (r=220)" },
          { r: 335, color: "rgba(168, 85, 247, 0.26)", text: "RING 3 · CROSS-2K STRETCH (r=335)" },
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
                { x: 240, y: -150, label: "SURE THINGS (2K D2C +22%)", color: "rgba(56, 189, 248, 0.55)" },
                { x: -240, y: 150, label: "PERSUADABLES (HIGH CATE)", color: "rgba(25, 195, 125, 0.55)" },
                { x: 240, y: 150, label: "SLEEPING DOGS (SUPPRESS)", color: "rgba(255, 77, 94, 0.55)" },
              ]
            : [
                { x: -240, y: -150, label: "GOLDEN PATH (85+ OVR)", color: "rgba(25, 195, 125, 0.55)" },
                { x: 240, y: -150, label: "WHALE VELOCITY DECAY", color: "rgba(56, 189, 248, 0.55)" },
                { x: -240, y: 150, label: "SUB-85 BADGE WALL", color: "rgba(245, 180, 0, 0.55)" },
                { x: 240, y: 150, label: "REACTIVE TILT / META", color: "rgba(255, 77, 94, 0.55)" },
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
      }
    },
    [segmentationLens]
  );

  // Custom 2D Node Renderer (Sleek Apple HUD Nodes with White Center Specular Core & Emoji Pill Badges)
  const paintNode2D = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (typeof node.x !== "number" || typeof node.y !== "number") return;

      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isAnchor = node.type === "GAME";
      const isOffer = node.type === "OFFER";
      const isCreator = node.type === "CREATOR";
      const isClan = node.type === "CLAN";
      const isSquadmate = node.type === "SQUADMATE";
      const isIdentity = node.type === "IDENTITY";
      const isTilt = node.tilt && node.tilt > 0.6;
      const isWhale =
        (node.archetype && String(node.archetype).includes("WHALE")) ||
        (node.spend && node.spend >= 1000);
      const isKeystoneCaptain =
        node.type === "PLAYER" &&
        (keystoneCaptainIds.has(node.id) ||
          node.archetype === "REC_CREW_CAPTAIN" ||
          node.archetype === "PARK_REP_GRINDER");
      const lensClassification =
        node.type === "PLAYER" && segmentationLens !== "FRANCHISE"
          ? classifyNodeForLens(node, keystoneCaptainIds, segmentationLens)
          : null;

      const baseRadius = isAnchor
        ? 18
        : isCreator || isClan
        ? 16
        : isOffer || isIdentity
        ? 14
        : isSquadmate
        ? 8
        : isWhale
        ? 7
        : isKeystoneCaptain
        ? 6.2
        : 5;
      const radius = isSelected ? baseRadius * 1.35 : isHovered ? baseRadius * 1.2 : baseRadius;

      // 1. Outer Translucent Halo Glow
      if (
        isSelected ||
        isHovered ||
        isAnchor ||
        isOffer ||
        isCreator ||
        isClan ||
        isIdentity ||
        isSquadmate ||
        isWhale ||
        isTilt
      ) {
        ctx.beginPath();
        ctx.arc(
          node.x,
          node.y,
          radius + (isAnchor ? 12 : isCreator || isClan ? 10 : isOffer || isIdentity ? 9 : 5),
          0,
          2 * Math.PI,
          false
        );
        ctx.fillStyle = isSelected
          ? "rgba(255, 255, 255, 0.45)"
          : isAnchor
          ? node.id === "game-nba2k27"
            ? "rgba(228, 0, 43, 0.38)"
            : "rgba(245, 180, 0, 0.34)"
          : isClan
          ? "rgba(0, 245, 155, 0.38)"
          : isIdentity
          ? "rgba(168, 85, 247, 0.38)"
          : isCreator
          ? node.color
            ? `${node.color}45`
            : "rgba(0, 240, 255, 0.40)"
          : isOffer
          ? node.color
            ? `${node.color}40`
            : "rgba(236, 72, 153, 0.35)"
          : isSquadmate
          ? "rgba(0, 210, 255, 0.32)"
          : isTilt
          ? "rgba(255, 71, 87, 0.30)"
          : isWhale
          ? "rgba(255, 184, 0, 0.30)"
          : "rgba(0, 255, 136, 0.20)";
        ctx.fill();
      }

      // 2. Vibrant Core Circle + Crisp #FFFFFF Stroke Ring + White Center Specular Core (radius * 0.45)
      if (isAnchor) {
        const isFlagship2K27 = node.id === "game-nba2k27";
        const anchorColor = isFlagship2K27 ? "#E4002B" : node.color || "#F5B400";
        const anchorRadius = isFlagship2K27 ? radius * 1.15 : radius;
        ctx.beginPath();
        ctx.arc(node.x, node.y, anchorRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = anchorColor;
        ctx.fill();
        ctx.lineWidth = isFlagship2K27 ? 3.5 : 3;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Specular Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isClan) {
        const clanColor = node.color || "#00F59B";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = clanColor;
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Specular Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isIdentity) {
        const identityColor = node.color || "#A855F7";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = identityColor;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Specular Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isCreator) {
        const creatorColor = node.color || "#00F0FF";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = creatorColor;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Specular Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isOffer) {
        const offerColor = node.color || "#EC4899";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = offerColor;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Specular Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isSquadmate) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || "#00D2FF";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Specular Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else {
        // Player Nodes
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = lensClassification?.color || node.color || "#00FF88";
        ctx.fill();
        if (isSelected || isHovered) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#FFFFFF";
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
        }
      }

      // 3. Staggered Dark Rounded Pill Badges (rgba(6, 9, 15, 0.90)) with Neon Borders & Emoji Type Prefixes
      const showLabel =
        isAnchor ||
        isOffer ||
        isCreator ||
        isClan ||
        isIdentity ||
        isSquadmate ||
        isSelected ||
        isHovered ||
        globalScale > 1.4;

      if (showLabel && node.name) {
        const fontSize = isAnchor
          ? 11.5 / globalScale
          : isClan || isCreator
          ? 11 / globalScale
          : isOffer || isIdentity
          ? 10 / globalScale
          : isSquadmate
          ? 9.5 / globalScale
          : 9 / globalScale;
        ctx.font = `600 ${Math.max(fontSize, 2.5)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const rawLabel = String(node.name || "")
          .replace(/\s*—\s*/g, " · ")
          .replace(/—/g, "·");
        const cleanLabel =
          rawLabel.length > 32 ? `${rawLabel.slice(0, 30)}...` : rawLabel;

        const text = isAnchor
          ? node.id === "game-nba2k27"
            ? `🔥 ${cleanLabel} (Flagship)`
            : `🔥 ${cleanLabel}`
          : isClan
          ? `🛡️ ${cleanLabel}`
          : isIdentity
          ? `🆔 ${cleanLabel}`
          : isSquadmate
          ? `🤝 ${cleanLabel}`
          : isCreator
          ? `⭐ ${cleanLabel}`
          : isOffer
          ? `⚡ ${cleanLabel}`
          : isSelected
          ? `${cleanLabel} ($${Math.round(node.spend || 0)})`
          : cleanLabel;

        // Stagger labels: if node is in upper half, render above to avoid overlapping player clusters
        const isUpper = node.y < -40;
        const offsetDist =
          (isAnchor ? 15 : isCreator || isClan ? 14 : isOffer || isIdentity ? 13 : 9) /
          globalScale;
        const textY = isUpper ? node.y - radius - offsetDist : node.y + radius + offsetDist;

        const textWidth = ctx.measureText(text).width;
        const padX = 7 / globalScale;
        const padY = 3.5 / globalScale;
        const pillRadius = 4 / globalScale;
        const boxX = node.x - textWidth / 2 - padX;
        const boxY = textY - fontSize / 2 - padY;
        const boxW = textWidth + padX * 2;
        const boxH = fontSize + padY * 2;

        // Draw Rounded Pill
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, pillRadius);
        ctx.fillStyle = "rgba(6, 9, 15, 0.90)";
        ctx.fill();

        // Stroke Pill with Neon Accent Border
        ctx.lineWidth = 1.2 / globalScale;
        ctx.strokeStyle = isAnchor
          ? node.id === "game-nba2k27"
            ? "#E4002B"
            : node.color || "#00F0FF"
          : isClan
          ? "#00F59B"
          : isIdentity
          ? "#A855F7"
          : isSquadmate
          ? "#00D2FF"
          : isCreator
          ? node.color || "#00F0FF"
          : isOffer
          ? node.color || "#EC4899"
          : isSelected
          ? "#FFFFFF"
          : "rgba(255, 255, 255, 0.25)";
        ctx.stroke();

        // Label Text
        ctx.fillStyle = isAnchor
          ? node.id === "game-nba2k27"
            ? "#FF4D5E"
            : node.color || "#00F0FF"
          : isClan
          ? "#00F59B"
          : isIdentity
          ? "#D8B4FE"
          : isSquadmate
          ? "#00D2FF"
          : isCreator
          ? node.color || "#00F0FF"
          : isOffer
          ? node.color || "#EC4899"
          : isSelected
          ? "#FFFFFF"
          : "#F5F5F7";
        ctx.fillText(text, node.x, textY);
      }
    },
    [selectedNode, hoveredNode, keystoneCaptainIds, segmentationLens]
  );

  // Custom 2D Link Renderer (High-Clarity Interactive Constellation Trails)
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
      const isTrigger = Boolean(link.isTriggerStream);
      const isMonetization =
        link.label === "MONETIZATION_GRAVITY" ||
        link.label === "MAJOR_DLC_PURCHASE" ||
        link.label === "OWNS_SKU";
      const isCrossGame = link.label === "CROSS_FRANCHISE_PLAY";

      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);

      // Interactive Spotlight: Dim unrelated links on hover/selection
      if (hasActiveSelection) {
        if (isHighlighted) {
          if (isMultiHop) {
            ctx.strokeStyle =
              link.hopStep === 1
                ? "rgba(0, 245, 155, 0.95)"
                : link.hopStep === 2
                ? "rgba(0, 210, 255, 0.95)"
                : "rgba(255, 87, 34, 0.95)";
            ctx.lineWidth = 2.4;
          } else if (isTrigger) {
            ctx.strokeStyle = "rgba(255, 71, 87, 0.95)";
            ctx.lineWidth = 2.2;
          } else if (isMonetization) {
            ctx.strokeStyle = "rgba(255, 184, 0, 0.90)";
            ctx.lineWidth = 2.0;
          } else if (isCrossGame) {
            ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
            ctx.lineWidth = 1.8;
          } else {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.80)";
            ctx.lineWidth = 1.5;
          }
        } else {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
          ctx.lineWidth = 0.4;
        }
      } else {
        // Natural resting state - ultra-clean, lightweight constellation trails
        if (isMultiHop) {
          ctx.strokeStyle =
            link.hopStep === 1
              ? "rgba(0, 245, 155, 0.50)"
              : link.hopStep === 2
              ? "rgba(0, 210, 255, 0.50)"
              : "rgba(255, 87, 34, 0.50)";
          ctx.lineWidth = 1.3;
        } else if (isTrigger) {
          ctx.strokeStyle = "rgba(255, 71, 87, 0.30)";
          ctx.lineWidth = 0.9;
        } else if (isMonetization) {
          ctx.strokeStyle = "rgba(255, 184, 0, 0.20)";
          ctx.lineWidth = 0.75;
        } else if (isCrossGame) {
          ctx.strokeStyle = "rgba(0, 240, 255, 0.14)";
          ctx.lineWidth = 0.65;
        } else {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
          ctx.lineWidth = 0.55;
        }
      }

      ctx.stroke();
    },
    [highlightLinks, selectedNode, hoveredNode, highlightBridges]
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
              <span>{activeCohortName || "Multi-Hop Path"}</span>
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
              <span className="h-2 w-2 rounded-full bg-[#00F59B]" />
              <span>Hop 1: Crew / 2K ID</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
              <span className="h-2 w-2 rounded-full bg-[#00D2FF]" />
              <span>Hop 2: Squadmate / 2K26 Bridge</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
              <span className="h-2 w-2 rounded-full bg-[#FF5722]" />
              <span>Hop 3: Target 2K Hub</span>
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

        {segmentationLens !== "FRANCHISE" && lensBreakdown.length > 0 && (
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

      {/* Floating Constellation Legend (.apple-glass) */}
      <div
        className={`apple-glass absolute top-3 ${
          selectedNode || activeCohortName
            ? "right-[384px] hidden 2xl:flex"
            : "right-4 hidden xl:flex"
        } z-10 items-center gap-3 px-3 py-1.5 rounded-full text-[11px] font-mono text-gray-300 pointer-events-none`}
      >
        <span className="inline-flex items-center gap-1.5 font-semibold text-white">
          <span>🔥</span>
          <span>2K Hub</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00F59B]" />
          <span>🛡️ Crew</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00F0FF]" />
          <span>⭐ Creator</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#EC4899]" />
          <span>⚡ VC / Offer</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#F5B400]" />
          <span>MyTEAM Whale</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-[#F5B400]/80 bg-[#00FF88]/80" />
          <span>Keystone Captain</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FF6B35]" />
          <span>2K26 Bridge</span>
        </span>
      </div>

      {is3D ? (
        <ForceGraph3D
          ref={fgRef}
          width={resolvedWidth}
          height={resolvedHeight}
          graphData={data}
          nodeLabel={(n: any) => String(n.name || "").replace(/—/g, "·")}
          nodeColor={(n: any) => {
            if (segmentationLens !== "FRANCHISE" && n.type === "PLAYER") {
              const cls = classifyNodeForLens(n, keystoneCaptainIds, segmentationLens);
              if (cls?.color) return cls.color;
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
              : l.isTriggerStream
              ? "rgba(255, 71, 87, 0.7)"
              : l.label === "MONETIZATION_GRAVITY" ||
                l.label === "MAJOR_DLC_PURCHASE" ||
                l.label === "OWNS_SKU"
              ? "rgba(255, 184, 0, 0.7)"
              : l.label === "CROSS_FRANCHISE_PLAY"
              ? "rgba(0, 240, 255, 0.6)"
              : "rgba(255,255,255,0.15)"
          }
          linkWidth={(l: any) =>
            l.isMultiHopBridge ||
            l.isTriggerStream ||
            l.label === "MONETIZATION_GRAVITY" ||
            l.label === "OWNS_SKU"
              ? 1.8
              : 0.8
          }
          linkDirectionalParticles={getLinkParticles}
          linkDirectionalParticleSpeed={getLinkParticleSpeed}
          linkDirectionalParticleColor={getLinkParticleColor}
          linkDirectionalParticleWidth={2.8}
          onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
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
          onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
          onNodeHover={(node: any) => setHoveredNode((node as GraphNode) || null)}
          enableNodeDrag={true}
          cooldownTicks={120}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
        />
      )}
    </div>
  );
}
