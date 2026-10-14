"use client";

import React from "react";
import { ContextualViewType, GameFranchise, SegmentationLens } from "@/lib/types";

export interface GraphControlsProps {
  currentView: ContextualViewType;
  onViewChange: (view: ContextualViewType) => void;
  selectedGame: GameFranchise;
  onGameChange: (game: GameFranchise) => void;
  archetypeFilter: string;
  onArchetypeChange: (archetype: string) => void;
  segmentationLens?: SegmentationLens;
  onLensChange?: (lens: SegmentationLens) => void;
  is3D: boolean;
  onToggle3D: () => void;
  clusterByLabel?: boolean;
  onToggleClusterByLabel?: () => void;
  highlightBridges?: boolean;
  onToggleHighlightBridges?: () => void;
  isInspectorOpen?: boolean;
  nodeCount: number;
  edgeCount: number;
}

const LENS_OPTIONS: { id: SegmentationLens; label: string }[] = [
  { id: "FRANCHISE", label: "Franchise" },
  { id: "SOCIAL_HOPS", label: "Social Hops (1°·2°·3°)" },
  { id: "CATE_UPLIFT", label: "CATE Uplift" },
  { id: "PORTFOLIO_RINGS", label: "3-Ring Portfolio" },
  { id: "TRAJECTORY", label: "Trajectory" },
];

const GAME_OPTIONS: { id: GameFranchise; label: string }[] = [
  { id: "ALL", label: "All 2K Titles" },
  { id: "NBA2K", label: "NBA 2K27" },
  { id: "NBA2K26", label: "NBA 2K26" },
  { id: "NBA2KMOBILE", label: "2K Mobile" },
  { id: "WWE2K", label: "WWE 2K25" },
  { id: "PGA2K", label: "PGA 2K25" },
  { id: "BL4", label: "Borderlands 4" },
  { id: "CIV7", label: "Civ VII" },
];

export default function GraphControls({
  currentView,
  onViewChange,
  selectedGame,
  onGameChange,
  onArchetypeChange,
  segmentationLens = "FRANCHISE",
  onLensChange,
  is3D,
  onToggle3D,
}: GraphControlsProps) {
  const views: { id: ContextualViewType; label: string }[] = [
    { id: "audience-cohorts", label: "Cohorts" },
    { id: "marketing-journey", label: "Journeys" },
    { id: "geo-map", label: "Markets" },
  ];

  const isGraphCanvasView =
    currentView === "audience-cohorts" ||
    currentView === "cross-franchise" ||
    currentView === "social-clans" ||
    currentView === "single-identity" ||
    currentView === "social-hops";

  return (
    <div className="flex items-center gap-2 font-sans min-w-0">
      {/* 1. Primary View Switcher */}
      <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/[0.08] p-0.5">
        {views.map((v) => {
          const isActive =
            currentView === v.id ||
            (v.id === "audience-cohorts" && isGraphCanvasView);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewChange(v.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-white/15 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* 2. Consolidated Graph Scope & Lens Control Pill (when on graph view) */}
      {isGraphCanvasView && (
        <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px]">
          <select
            aria-label="Filter by 2K title"
            value={selectedGame}
            onChange={(e) => {
              onGameChange(e.target.value as GameFranchise);
              onArchetypeChange("ALL");
            }}
            className="bg-transparent text-[11px] text-white font-medium focus:outline-none cursor-pointer"
          >
            {GAME_OPTIONS.map((g) => (
              <option
                key={g.id}
                value={g.id}
                className="bg-[#0E1117] text-white"
              >
                {g.label}
              </option>
            ))}
          </select>

          {onLensChange && (
            <>
              <span className="h-3 w-px bg-white/15 mx-0.5" />
              <span className="text-gray-400 text-[11px]">Lens</span>
              <select
                aria-label="Segmentation Lens Switcher"
                value={segmentationLens}
                onChange={(e) =>
                  onLensChange(e.target.value as SegmentationLens)
                }
                className="bg-transparent text-[11px] text-emerald-300 font-semibold focus:outline-none cursor-pointer"
              >
                {LENS_OPTIONS.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    className="bg-[#0E1117] text-white"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <span className="h-3 w-px bg-white/15 mx-0.5" />
          <button
            type="button"
            onClick={onToggle3D}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all ${
              is3D
                ? "bg-white text-black"
                : "text-gray-300 hover:text-white hover:bg-white/10"
            }`}
            title="Toggle 2D / 3D Graph Projection"
          >
            {is3D ? "3D" : "2D"}
          </button>
        </div>
      )}
    </div>
  );
}
