"use client";

import React from "react";
import { ContextualViewType, GameFranchise } from "@/lib/types";

interface GraphControlsProps {
  currentView: ContextualViewType;
  onViewChange: (view: ContextualViewType) => void;
  selectedGame: GameFranchise;
  onGameChange: (game: GameFranchise) => void;
  archetypeFilter: string;
  onArchetypeChange: (archetype: string) => void;
  is3D: boolean;
  onToggle3D: () => void;
  nodeCount: number;
  edgeCount: number;
}

const GAME_OPTIONS: { id: GameFranchise; label: string; icon: string }[] = [
  { id: "ALL", label: "All CoD Modes", icon: "🌐" },
  { id: "WARZONE", label: "Warzone & Resurgence", icon: "🪂" },
  { id: "BLACK_OPS", label: "Black Ops 7 & Zombies", icon: "🧟" },
  { id: "MODERN_WARFARE", label: "Modern Warfare III", icon: "🎯" },
  { id: "CDL_RANKED", label: "CDL & Ranked Play", icon: "🏆" },
  { id: "COD_MOBILE", label: "CoD Mobile", icon: "📱" },
];

const COHORT_FILTERS_BY_GAME: Record<GameFranchise, { value: string; label: string }[]> = {
  ALL: [
    { value: "ALL", label: "All Call of Duty Players" },
    { value: "BLACKCELL_WHALE", label: "BlackCell Pass Whales" },
    { value: "VERDANSK_OG", label: "Verdansk OG Veterans" },
    { value: "CDL_RANKED_SWEAT", label: "CDL Ranked Sweats" },
    { value: "CAMO_COMPLETIONIST", label: "Mastery Camo Grinders" },
    { value: "ROUND_BASED_ZOMBIES_SLAYER", label: "Zombies Easter Egg Slayers" },
    { value: "SEARCH_AND_DESTROY_SPECIALIST", label: "S&D Clutch Specialists" },
    { value: "CASUAL_WARZONE_WARRIOR", label: "Casual Weekend Squads" },
    { value: "MOBILE_TOUCHPAD_PRODIGY", label: "CoD Mobile Touchpad Prodigies" },
    { value: "DMZ_EXTRACTION_SURVIVOR", label: "DMZ Extraction Survivors" },
    { value: "GULAG_TILT_RISK", label: "Gulag Tilt & Loss Risk" },
  ],
  COD: [
    { value: "ALL", label: "All Call of Duty Cohorts" },
    { value: "BLACKCELL_WHALE", label: "BlackCell Pass Whales" },
    { value: "VERDANSK_OG", label: "Verdansk OG Veterans" },
    { value: "CDL_RANKED_SWEAT", label: "CDL Ranked Sweats" },
    { value: "CAMO_COMPLETIONIST", label: "Mastery Camo Grinders" },
    { value: "GULAG_TILT_RISK", label: "Gulag Tilt Risk" },
  ],
  WARZONE: [
    { value: "ALL", label: "All Warzone Cohorts" },
    { value: "VERDANSK_OG", label: "Verdansk OG Veterans" },
    { value: "BLACKCELL_WHALE", label: "BlackCell Pass Whales" },
    { value: "CASUAL_WARZONE_WARRIOR", label: "Casual Resurgence Squads" },
    { value: "DMZ_EXTRACTION_SURVIVOR", label: "DMZ Extraction Survivors" },
    { value: "GULAG_TILT_RISK", label: "Gulag Tilt & Loss Risk" },
  ],
  BLACK_OPS: [
    { value: "ALL", label: "All Black Ops 7 Cohorts" },
    { value: "ROUND_BASED_ZOMBIES_SLAYER", label: "Terminus & Liberty Falls Slayers" },
    { value: "CAMO_COMPLETIONIST", label: "Dark Matter Camo Grinders" },
    { value: "BLACKCELL_WHALE", label: "Vault Edition Whales" },
    { value: "CASUAL_WARZONE_WARRIOR", label: "Casual MP Warriors" },
  ],
  MODERN_WARFARE: [
    { value: "ALL", label: "All Modern Warfare III Cohorts" },
    { value: "SEARCH_AND_DESTROY_SPECIALIST", label: "Search & Destroy Specialists" },
    { value: "CAMO_COMPLETIONIST", label: "Interstellar Camo Grinders" },
    { value: "BLACKCELL_WHALE", label: "Mastercraft Bundle Whales" },
    { value: "CASUAL_WARZONE_WARRIOR", label: "Casual Pub Stompers" },
  ],
  CDL_RANKED: [
    { value: "ALL", label: "All CDL Ranked Cohorts" },
    { value: "CDL_RANKED_SWEAT", label: "Top 250 & Iridescent Sweats" },
    { value: "GULAG_TILT_RISK", label: "Demotion Loss Streaks" },
    { value: "SEARCH_AND_DESTROY_SPECIALIST", label: "S&D Clutch Players" },
  ],
  COD_MOBILE: [
    { value: "ALL", label: "All Mobile Cohorts" },
    { value: "MOBILE_TOUCHPAD_PRODIGY", label: "Touchpad & Mythic Draw Whales" },
    { value: "CASUAL_WARZONE_WARRIOR", label: "Mobile Casuals" },
  ],
};

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
    { id: "audience-cohorts", label: "Cohorts Graph" },
    { id: "marketing-journey", label: "Marketing Journeys (Sankey)" },
    { id: "geo-map", label: "Geographic DMA Map" },
  ];

  const currentFilters = COHORT_FILTERS_BY_GAME[selectedGame] || COHORT_FILTERS_BY_GAME.ALL;

  return (
    <div className="absolute top-4 left-6 z-20 flex flex-wrap items-center gap-2.5 font-sans">
      {/* 1. Apple-Style Segmented Control: 2-Way View Switcher */}
      <div className="flex items-center bg-black/50 backdrop-blur-2xl p-1 rounded-xl border border-white/10 shadow-lg">
        {views.map((v) => {
          const isActive = currentView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-white/20 text-white shadow-sm font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* 2. Sleek Game Franchise Selector */}
      <div className="flex items-center bg-black/50 backdrop-blur-2xl px-3 py-1.5 rounded-xl border border-white/10 text-xs">
        <span className="text-gray-500 mr-2 text-[11px]">Title:</span>
        <select
          value={selectedGame}
          onChange={(e) => {
            onGameChange(e.target.value as GameFranchise);
            onArchetypeChange("ALL");
          }}
          className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer"
        >
          {GAME_OPTIONS.map((g) => (
            <option key={g.id} value={g.id} className="bg-[#121212] text-white">
              {g.icon} {g.label}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Dynamic Cohort Filters Dropdown (Adapts to Selected Title) */}
      {currentView === "audience-cohorts" && (
        <div className="flex items-center bg-black/50 backdrop-blur-2xl px-3 py-1.5 rounded-xl border border-white/10 text-xs">
          <span className="text-gray-500 mr-2 text-[11px]">Cohort:</span>
          <select
            value={archetypeFilter}
            onChange={(e) => onArchetypeChange(e.target.value)}
            className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer"
          >
            {currentFilters.map((f) => (
              <option key={f.value} value={f.value} className="bg-[#121212] text-white">
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. 2D / 3D Switcher */}
      {currentView === "audience-cohorts" && (
        <button
          onClick={onToggle3D}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-2xl border transition-all ${
            is3D
              ? "bg-white text-black border-white font-semibold"
              : "bg-black/50 text-gray-400 border-white/10 hover:text-white"
          }`}
        >
          {is3D ? "3D" : "2D"}
        </button>
      )}

      {/* 5. Clean Telemetry Counter */}
      <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-2xl px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-gray-400 font-mono">
        {currentView === "geo-map" ? (
          <span>12 Global DMAs Connected</span>
        ) : (
          <>
            <span>{nodeCount} Nodes</span>
            <span className="text-gray-600">•</span>
            <span>{edgeCount} Edges</span>
          </>
        )}
      </div>
    </div>
  );
}
