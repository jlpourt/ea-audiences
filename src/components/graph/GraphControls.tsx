"use client";

import React from "react";
import { ContextualViewType, GameFranchise } from "@/lib/types";

export interface GraphControlsProps {
  currentView: ContextualViewType;
  onViewChange: (view: ContextualViewType) => void;
  selectedGame: GameFranchise;
  onGameChange: (game: GameFranchise) => void;
  archetypeFilter: string;
  onArchetypeChange: (archetype: string) => void;
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

const GAME_OPTIONS: { id: GameFranchise; label: string }[] = [
  { id: "ALL", label: "All 2K" },
  { id: "NBA2K", label: "NBA 2K27" },
  { id: "NBA2K26", label: "NBA 2K26" },
  { id: "NBA2KMOBILE", label: "2K Mobile" },
  { id: "WWE2K", label: "WWE 2K25" },
  { id: "PGA2K", label: "PGA 2K25" },
  { id: "BL4", label: "Borderlands 4" },
  { id: "CIV7", label: "Civ VII" },
];

const COHORT_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All Cohorts" },
  { value: "MYTEAM_PACK_WHALE", label: "MyTEAM Whales" },
  { value: "PARK_REP_GRINDER", label: "Park Grinders" },
  { value: "CROSS_LABEL_NOMAD", label: "2K26 Bridge" },
  { value: "REC_CREW_CAPTAIN", label: "Crew Captains" },
  { value: "MYCAREER_STORY_CASUAL", label: "MyCAREER Casuals" },
  { value: "BUILD_LAB_THEORYCRAFTER", label: "Build Lab" },
  { value: "MYNBA_FRANCHISE_SIM", label: "MyNBA Sim" },
  { value: "THE_W_LOYALIST", label: "The W Loyalists" },
  { value: "MOBILE_DAILY_RITUALIST", label: "2K Mobile Ritualists" },
  { value: "RAGE_QUIT_TILT_RISK", label: "Rage-Quit Risk" },
];

export default function GraphControls({
  currentView,
  onViewChange,
  selectedGame,
  onGameChange,
  archetypeFilter,
  onArchetypeChange,
  is3D,
  onToggle3D,
  nodeCount,
  edgeCount,
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
    currentView === "single-identity";

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

      {/* 2. Title Selector (when on graph view) */}
      {isGraphCanvasView && (
        <div className="flex items-center px-2 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px]">
          <span className="text-gray-400 mr-1.5 text-[11px]">Title</span>
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
        </div>
      )}

      {/* 3. Cohort Archetype Dropdown (when on graph view) */}
      {isGraphCanvasView && (
        <div className="flex items-center px-2 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px]">
          <span className="text-gray-400 mr-1.5 text-[11px]">Cohort</span>
          <select
            aria-label="Filter by player cohort archetype"
            value={archetypeFilter}
            onChange={(e) => onArchetypeChange(e.target.value)}
            className="bg-transparent text-[11px] text-white font-medium focus:outline-none cursor-pointer"
          >
            {COHORT_OPTIONS.map((f) => (
              <option
                key={f.value}
                value={f.value}
                className="bg-[#0E1117] text-white"
              >
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. 2D / 3D Toggle Button */}
      {isGraphCanvasView && (
        <button
          type="button"
          onClick={onToggle3D}
          className={`px-2 py-1 rounded-xl text-[11px] font-medium transition-all ${
            is3D
              ? "bg-white text-black border border-white font-semibold"
              : "bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:text-white"
          }`}
        >
          {is3D ? "3D" : "2D"}
        </button>
      )}

      {/* 5. Nodes · Edges Counter Pill */}
      {isGraphCanvasView && (
        <div className="hidden 2xl:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11px] text-gray-300 font-mono tabular">
          <span>{nodeCount}N</span>
          <span className="text-gray-500">·</span>
          <span>{edgeCount}E</span>
        </div>
      )}
    </div>
  );
}
