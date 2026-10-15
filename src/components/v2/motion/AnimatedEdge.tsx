"use client";

/**
 * <AnimatedEdge> SVG edge that draws itself, then (optionally) carries a
 * flowing dash to show data moving along it.
 *
 * Purpose: explanation. Shows a relationship being discovered (draw) and
 * a live flow (dash). The draw uses framer-motion pathLength; the flow is
 * a CSS animation so it stays smooth while the main thread is busy.
 * Reduced motion: no draw, no flow; the edge simply fades in.
 *
 * Must be rendered inside an <svg>.
 *
 * Usage:
 *   <svg viewBox="0 0 400 200">
 *     <AnimatedEdge d={curvedPath(20, 100, 380, 60)} flow delay={0.2} />
 *   </svg>
 */
import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import { ease } from "./springs";

export interface AnimatedEdgeProps {
  /** SVG path data. Use curvedPath() for a quick bezier. */
  d: string;
  /** Base stroke. Default var(--edge). */
  stroke?: string;
  /** Flow dash stroke. Default var(--accent). */
  flowStroke?: string;
  strokeWidth?: number;
  /** Draw the path in on mount. Default true. */
  draw?: boolean;
  /** Overlay a flowing dash. Default false. */
  flow?: boolean;
  /** Seconds before drawing starts. */
  delay?: number;
  /** Draw duration, seconds. Default 0.8. */
  duration?: number;
  /** Dash length / gap in px for the flow overlay. */
  dash?: number;
  gap?: number;
  /** ms per dash cycle. Lower = faster. Default 900. */
  speed?: number;
  /** Reverse the flow direction (dest to source). */
  reverse?: boolean;
  opacity?: number;
  className?: string;
  markerEnd?: string;
}

export function AnimatedEdge({
  d,
  stroke = "var(--edge)",
  flowStroke = "var(--accent)",
  strokeWidth = 1.5,
  draw = true,
  flow = false,
  delay = 0,
  duration = 0.8,
  dash = 4,
  gap = 12,
  speed = 900,
  reverse = false,
  opacity = 1,
  className,
  markerEnd,
}: AnimatedEdgeProps) {
  const reduce = !!useReducedMotion();
  const shouldDraw = draw && !reduce;
  const cycle = dash + gap;

  return (
    <g className={className} style={{ pointerEvents: "none" }}>
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd={markerEnd}
        initial={shouldDraw ? { pathLength: 0, opacity: 0 } : { opacity: 0 }}
        animate={shouldDraw ? { pathLength: 1, opacity } : { opacity }}
        transition={{
          pathLength: { duration, delay, ease: ease.inOut },
          opacity: { duration: 0.2, delay },
        }}
      />
      {flow && !reduce && (
        <motion.path
          d={d}
          fill="none"
          stroke={flowStroke}
          strokeWidth={strokeWidth + 0.5}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          className="v2-edge-flow"
          style={
            {
              "--v2-dash-cycle": reverse ? -cycle : cycle,
              "--v2-dash-speed": `${speed}ms`,
            } as CSSProperties
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.3, delay: delay + (shouldDraw ? duration : 0) }}
        />
      )}
    </g>
  );
}

/**
 * Smooth cubic bezier between two points. `curvature` 0 is a straight line;
 * 0.25 is a gentle arc. Horizontal-dominant by default (good for left-to-right
 * flows); set `vertical` for top-to-bottom flows.
 */
export function curvedPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature = 0.4,
  vertical = false,
): string {
  if (vertical) {
    const dy = (y2 - y1) * curvature;
    return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
  }
  const dx = (x2 - x1) * curvature;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** Quadratic arc bowed perpendicular to the line (good for graph edges). */
export function arcPath(x1: number, y1: number, x2: number, y2: number, bow = 0.15): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * bow;
  const cy = my + dx * bow;
  return `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;
}
