"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import ForceGraph3D from "react-force-graph-3d";
import { GraphData, GraphNode } from "@/lib/types";

interface ForceGraphCanvasProps {
  data: GraphData;
  is3D: boolean;
  selectedNode: GraphNode | null;
  onNodeClick: (node: GraphNode) => void;
  width: number;
  height: number;
}

export default function ForceGraphCanvas({
  data,
  is3D,
  selectedNode,
  onNodeClick,
  width,
  height,
}: ForceGraphCanvasProps) {
  const fgRef = useRef<any>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Configure custom D3 forces for spread out cluster layout, monetization wells, and zero collision
  useEffect(() => {
    if (fgRef.current && !is3D) {
      fgRef.current.d3Force("charge")?.strength(-380);
      fgRef.current.d3Force("link")?.distance((link: any) => {
        if (link.label === "MONETIZATION_GRAVITY") return 140;
        if (link.isTriggerStream) return 160;
        return 180;
      });
      fgRef.current.d3Force(
        "collide",
        (window as any).d3?.forceCollide((node: any) => {
          const isAnchor = node.type === "GAME" || node.type === "OFFER";
          return isAnchor ? 48 : 12;
        })
      );
    }
  }, [data, is3D]);

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

  // Directional Particle Streams
  const getLinkParticles = useCallback(
    (link: any) => {
      const sId = typeof link.source === "object" ? link.source.id : link.source;
      const tId = typeof link.target === "object" ? link.target.id : link.target;
      const isHighlighted = highlightLinks.has(`${sId}->${tId}`);

      if (link.isMultiHopBridge) return isHighlighted ? 6 : 4;
      if (link.isTriggerStream) return isHighlighted ? 6 : 4;
      if (link.label === "MONETIZATION_GRAVITY" || link.label === "MAJOR_DLC_PURCHASE") return isHighlighted ? 5 : 3;
      if (link.label === "CROSS_FRANCHISE_PLAY") return isHighlighted ? 4 : 2;
      return isHighlighted ? 3 : 0;
    },
    [highlightLinks]
  );

  const getLinkParticleSpeed = useCallback((link: any) => {
    if (link.isMultiHopBridge) return link.hopStep === 1 ? 0.018 : link.hopStep === 2 ? 0.014 : 0.010;
    if (link.isTriggerStream) return 0.015;
    if (link.label === "MONETIZATION_GRAVITY" || link.label === "MAJOR_DLC_PURCHASE") return 0.010;
    if (link.label === "CROSS_FRANCHISE_PLAY") return 0.008;
    return 0.005;
  }, []);

  const getLinkParticleColor = useCallback((link: any) => {
    if (link.isMultiHopBridge) {
      if (link.hopStep === 1) return "#00F59B"; // Emerald (Player -> Clan)
      if (link.hopStep === 2) return "#00D2FF"; // Cyan (Clan -> Squadmate)
      if (link.hopStep === 3) return "#FF334B"; // Diablo Crimson / Target Game
      return "#00F59B";
    }
    if (link.isTriggerStream) return "#FF4757";
    if (link.label === "MONETIZATION_GRAVITY" || link.label === "MAJOR_DLC_PURCHASE") return "#FFB800";
    if (link.label === "CROSS_FRANCHISE_PLAY") return "#00F0FF";
    return "#00FF88";
  }, []);

  // Custom 2D Node Renderer (Sleek Apple HUD Nodes)
  const paintNode2D = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isAnchor = node.type === "GAME";
      const isOffer = node.type === "OFFER";
      const isCreator = node.type === "CREATOR";
      const isClan = node.type === "CLAN";
      const isSquadmate = node.type === "SQUADMATE";
      const isIdentity = node.type === "IDENTITY";
      const isTilt = node.tilt && node.tilt > 0.60;
      const isWhale = (node.archetype && node.archetype.includes("WHALE")) || (node.spend && node.spend >= 1000);

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
        : 5;
      const radius = isSelected ? baseRadius * 1.35 : isHovered ? baseRadius * 1.2 : baseRadius;

      // 1. Halo Glow
      if (isSelected || isHovered || isAnchor || isOffer || isCreator || isClan || isIdentity || isWhale || isTilt) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + (isAnchor ? 12 : isCreator || isClan ? 10 : isOffer || isIdentity ? 9 : 5), 0, 2 * Math.PI, false);
        ctx.fillStyle = isSelected
          ? "rgba(255, 255, 255, 0.45)"
          : isAnchor
          ? "rgba(230, 255, 0, 0.35)"
          : isClan
          ? "rgba(0, 245, 155, 0.38)"
          : isIdentity
          ? "rgba(168, 85, 247, 0.38)"
          : isCreator
          ? (node.color ? `${node.color}45` : "rgba(0, 240, 255, 0.40)")
          : isOffer
          ? (node.color ? `${node.color}40` : "rgba(236, 72, 153, 0.35)")
          : isTilt
          ? "rgba(255, 71, 87, 0.30)"
          : isWhale
          ? "rgba(255, 184, 0, 0.30)"
          : "rgba(0, 255, 136, 0.20)";
        ctx.fill();
      }

      // 2. Node Core Circle & Outer Glow Ring
      if (isAnchor) {
        // Bright Neon Lime Anchor Hub
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#E6FF00";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Specular Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isClan) {
        // Glowing Emerald Clan Node (Spanner Multi-Hop Bridge)
        const clanColor = node.color || "#00F59B";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = clanColor;
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isIdentity) {
        // Battle.net Unified Identity Node (Purple)
        const identityColor = node.color || "#A855F7";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = identityColor;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.42, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isCreator) {
        // Glowing Content Creator Node
        const creatorColor = node.color || "#00F0FF";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = creatorColor;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.42, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isOffer) {
        // Glowing Store Offer Node (Red, Pink, Purple, Gold)
        const offerColor = node.color || "#EC4899";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = offerColor;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // White Center Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else if (isSquadmate) {
        // Multi-Hop Squadmate Node (Electric Cyan)
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || "#00D2FF";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();
      } else {
        // Player Nodes
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || "#00FF88";
        ctx.fill();
        if (isSelected || isHovered) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#FFFFFF";
          ctx.stroke();
        }
      }

      // 3. Rounded Pill Label with Neon Border
      const showLabel = isAnchor || isOffer || isCreator || isClan || isIdentity || isSquadmate || isSelected || isHovered || globalScale > 1.4;
      if (showLabel) {
        const fontSize = isAnchor
          ? 11.5 / globalScale
          : isClan || isCreator
          ? 11 / globalScale
          : isOffer || isIdentity
          ? 10.5 / globalScale
          : isSquadmate
          ? 9.5 / globalScale
          : 9 / globalScale;
        ctx.font = `600 ${Math.max(fontSize, 2.5)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const text = isAnchor
          ? node.name
          : isClan
          ? `🛡️ ${node.name}`
          : isIdentity
          ? `🆔 ${node.name}`
          : isSquadmate
          ? `⚡ ${node.name}`
          : isCreator
          ? `⭐ ${node.name}`
          : isOffer
          ? node.name
          : isSelected
          ? `${node.name} ($${node.spend || 0})`
          : node.name;

        const textY = node.y + radius + (isAnchor ? 14 : isCreator || isClan ? 13 : isOffer || isIdentity ? 12 : 9) / globalScale;
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
        ctx.fillStyle = "rgba(6, 9, 15, 0.88)";
        ctx.fill();

        // Stroke Pill with Neon Accent Border
        ctx.lineWidth = 1.2 / globalScale;
        ctx.strokeStyle = isAnchor
          ? "#00F0FF"
          : isClan
          ? "#00F59B"
          : isIdentity
          ? "#A855F7"
          : isSquadmate
          ? "#00D2FF"
          : isCreator
          ? (node.color || "#00F0FF")
          : isOffer
          ? (node.color || "#EC4899")
          : isSelected
          ? "#FFFFFF"
          : "rgba(255, 255, 255, 0.25)";
        ctx.stroke();

        // Label Text
        ctx.fillStyle = isAnchor
          ? "#00F0FF"
          : isClan
          ? "#00F59B"
          : isIdentity
          ? "#D8B4FE"
          : isSquadmate
          ? "#00D2FF"
          : isCreator
          ? (node.color || "#00F0FF")
          : isOffer
          ? (node.color || "#EC4899")
          : isSelected
          ? "#FFFFFF"
          : "#F5F5F7";
        ctx.fillText(text, node.x, textY);
      }
    },
    [selectedNode, hoveredNode]
  );

  // Custom 2D Link Renderer (Sleek High-Contrast Particle Trails)
  const paintLink2D = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isMultiHop = link.isMultiHopBridge;
      const isTrigger = link.isTriggerStream;
      const isMonetization = link.label === "MONETIZATION_GRAVITY" || link.label === "MAJOR_DLC_PURCHASE";
      const isCrossGame = link.label === "CROSS_FRANCHISE_PLAY";

      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);

      if (isMultiHop) {
        if (link.hopStep === 1) {
          ctx.strokeStyle = "rgba(0, 245, 155, 0.70)"; // Emerald Hop 1
          ctx.lineWidth = 2.0;
        } else if (link.hopStep === 2) {
          ctx.strokeStyle = "rgba(0, 210, 255, 0.70)"; // Electric Cyan Hop 2
          ctx.lineWidth = 2.0;
        } else {
          ctx.strokeStyle = "rgba(255, 51, 75, 0.70)"; // Target Hop 3
          ctx.lineWidth = 2.0;
        }
      } else if (isTrigger) {
        ctx.strokeStyle = "rgba(255, 71, 87, 0.75)"; // Neon Coral Trigger
        ctx.lineWidth = 1.8;
      } else if (isMonetization) {
        ctx.strokeStyle = "rgba(255, 184, 0, 0.65)"; // Whale Gold Stream
        ctx.lineWidth = 1.6;
      } else if (isCrossGame) {
        ctx.strokeStyle = "rgba(0, 240, 255, 0.55)"; // Cyan Migration Bridge
        ctx.lineWidth = 1.3;
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
        ctx.lineWidth = 0.8;
      }

      ctx.stroke();
    },
    []
  );

  return (
    <>
      {is3D ? (
        <ForceGraph3D
          ref={fgRef}
          width={width}
          height={height}
          graphData={data}
          nodeLabel="name"
          nodeColor={(n: any) => n.color || "#00F0FF"}
          nodeVal={(n: any) => n.val || 7}
          nodeRelSize={4}
          linkColor={(l: any) =>
            l.isTriggerStream
              ? "rgba(255, 71, 87, 0.7)"
              : l.label === "MONETIZATION_GRAVITY" || l.label === "MAJOR_DLC_PURCHASE"
              ? "rgba(255, 184, 0, 0.7)"
              : l.label === "CROSS_FRANCHISE_PLAY"
              ? "rgba(0, 240, 255, 0.6)"
              : "rgba(255,255,255,0.15)"
          }
          linkWidth={(l: any) =>
            l.isTriggerStream || l.label === "MONETIZATION_GRAVITY" || l.label === "MAJOR_DLC_PURCHASE" ? 1.8 : 0.8
          }
          linkDirectionalParticles={getLinkParticles}
          linkDirectionalParticleSpeed={getLinkParticleSpeed}
          linkDirectionalParticleColor={getLinkParticleColor}
          linkDirectionalParticleWidth={2.8}
          onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
          backgroundColor="#080A0E"
          enableNodeDrag={true}
        />
      ) : (
        <ForceGraph2D
          ref={fgRef}
          width={width}
          height={height}
          graphData={data}
          nodeCanvasObject={paintNode2D}
          nodeCanvasObjectMode={() => "replace"}
          linkCanvasObject={paintLink2D}
          linkCanvasObjectMode={() => "after"}
          linkDirectionalParticles={getLinkParticles}
          linkDirectionalParticleSpeed={getLinkParticleSpeed}
          linkDirectionalParticleColor={getLinkParticleColor}
          linkDirectionalParticleWidth={2.6}
          onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
          onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)}
          enableNodeDrag={true}
          cooldownTicks={120}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}
    </>
  );
}
