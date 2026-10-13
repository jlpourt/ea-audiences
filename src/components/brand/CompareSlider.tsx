"use client";

import React, { useCallback, useRef, useState } from "react";

export interface CompareSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  aspectClass?: string;
  className?: string;
}

/**
 * Before/After creative comparison slider (Codex §4 rule 16):
 * - Uses `clip-path: inset(0 var(--split) 0 0)` on the top image layer.
 * - Uses `setPointerCapture` during drag with zero transition while dragging
 *   and a gentle 180ms `var(--ease-out)` settle on release.
 * - Supports Left/Right keyboard arrows.
 */
export function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Generic store tile",
  afterLabel = "Custom Cohort Render",
  aspectClass = "aspect-[4/3]",
  className = "",
}: CompareSliderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [splitPct, setSplitPct] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.max(4, Math.min(96, raw)));
  }, []);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="slider"
      aria-label="Compare generic store tile and generated creative"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(splitPct)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        updateFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setDragging(false);
      }}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setSplitPct((p) => Math.max(4, p - 5));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setSplitPct((p) => Math.min(96, p + 5));
        }
      }}
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-court-ink select-none cursor-ew-resize ${aspectClass} ${className}`}
    >
      {/* Bottom layer: After (Generated creative) */}
      <img
        src={afterSrc}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* Top layer: Before (Generic tile), clipped by splitPct */}
      <div
        style={{
          clipPath: `inset(0 ${(100 - splitPct).toFixed(2)}% 0 0)`,
          transition: dragging ? "none" : "clip-path 180ms var(--ease-out)",
        }}
        className="absolute inset-0"
      >
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="h-full w-full object-cover filter saturate-75 brightness-90"
          draggable={false}
        />
      </div>

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-court-black/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim border border-white/10">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 z-20 rounded bg-twok-red/90 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-chalk border border-white/20">
        {afterLabel}
      </span>

      {/* Divider line + handle */}
      <div
        style={{
          transform: `translate3d(${splitPct.toFixed(2)}%, 0, 0)`,
          transition: dragging ? "none" : "transform 180ms var(--ease-out)",
        }}
        className="pointer-events-none absolute inset-y-0 left-0 w-full z-20"
      >
        <div className="relative h-full w-[2px] -translate-x-1/2 bg-chalk shadow-[0_0_12px_rgba(0,0,0,0.8)]">
          <div className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-court-black/90 text-chalk shadow-lg">
            <span className="font-mono text-[10px] leading-none">↔</span>
          </div>
        </div>
      </div>
    </div>
  );
}
