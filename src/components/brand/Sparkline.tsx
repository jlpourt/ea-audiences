"use client";

import React, { useId } from "react";
import { useReducedMotion } from "framer-motion";

export interface SparklineProps {
  values: number[];
  labels?: string[];
  width?: number;
  height?: number;
  stroke?: string;
  highlightIndex?: number | null;
  highlightLabel?: string;
  className?: string;
}

/**
 * Compact SVG line + area chart with a 600ms `stroke-dasharray` draw-in on
 * mount (`var(--ease-out)`), plus an optional marker for the recommended price
 * or peak value.
 */
export function Sparkline({
  values,
  labels,
  width = 220,
  height = 56,
  stroke = "var(--twok-red)",
  highlightIndex = null,
  highlightLabel,
  className = "",
}: SparklineProps) {
  const gradId = useId();
  const prefersReducedMotion = useReducedMotion();

  if (!values || values.length === 0) return null;

  const padX = 8;
  const padY = 8;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);

  const pts = values.map((v, idx) => {
    const x =
      values.length === 1
        ? width / 2
        : padX + (idx / (values.length - 1)) * innerW;
    const y = padY + innerH - ((v - minVal) / range) * innerH;
    return { x, y, v, label: labels?.[idx] };
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(
    height - padY
  ).toFixed(1)} L${pts[0].x.toFixed(1)},${(height - padY).toFixed(1)} Z`;

  const hi =
    highlightIndex !== null &&
    highlightIndex >= 0 &&
    highlightIndex < pts.length
      ? pts[highlightIndex]
      : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible select-none ${className}`}
      role="img"
      aria-label="Sparkline chart"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#${gradId})`} />

      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={
          prefersReducedMotion
            ? undefined
            : {
                strokeDasharray: 1,
                strokeDashoffset: 0,
                animation: "courtside-spark-draw 600ms var(--ease-out) both",
              }
        }
      />

      {hi && (
        <g>
          <line
            x1={hi.x}
            y1={padY}
            x2={hi.x}
            y2={height - padY}
            stroke="var(--vc-gold)"
            strokeDasharray="2 2"
            strokeWidth={1}
          />
          <circle
            cx={hi.x}
            cy={hi.y}
            r={3.5}
            fill="var(--vc-gold)"
            stroke="var(--court-black)"
            strokeWidth={1.5}
          />
          {highlightLabel && (
            <text
              x={Math.min(Math.max(hi.x, 24), width - 24)}
              y={Math.max(10, hi.y - 6)}
              textAnchor="middle"
              className="fill-vc-gold font-mono text-[9px] tabular"
            >
              {highlightLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
