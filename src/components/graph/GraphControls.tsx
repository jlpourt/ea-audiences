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
  { id: "ALL", label: "All Franchises", icon: "🌐" },
  { id: "COD", label: "Call of Duty", icon: "🎯" },
  { id: "WOW", label: "World of Warcraft", icon: "⚔️" },
  { id: "DIABLO4", label: "Diablo IV", icon: "🔥" },
  { id: "OVERWATCH2", label: "Overwatch 2", icon: "🛡️" },
  { id: "CANDYCRUSH", label: "Candy Crush Saga", icon: "🍬" },
];

// Every value below is an archetype that actually has players in that franchise
// (verified against data/master_players.json). Monetising archetypes are
// franchise-specific: COD=BLACKCELL_WHALE, WOW=AZERITE_COLLECTOR,
// DIABLO4=SANCTUARY_COLLECTOR, OVERWATCH2=MYTHIC_COLLECTOR, CANDYCRUSH=BOOSTER_WHALE.
const COHORT_FILTERS_BY_GAME: Record<GameFranchise, { value: string; label: string }[]> = {
  ALL: [
    { value: "ALL", label: "All Players (Macro Galaxy)" },
    { value: "COMPETITIVE_GRINDER", label: "Competitive Grinders" },
    { value: "RANKED_SWEAT", label: "Ranked Sweats" },
    { value: "CASUAL_SOCIALIZER", label: "Casual Socializers" },
    { value: "CASUAL_WARRIOR", label: "Casual Warriors" },
    { value: "LORE_SEEKER", label: "Lore & Campaign Purists" },
  ],
  COD: [
    { value: "ALL", label: "All Call of Duty Cohorts" },
    { value: "BLACKCELL_WHALE", label: "BlackCell Pass Whales" },
    { value: "COMPETITIVE_GRINDER", label: "Warzone Resurgence Grinders" },
    { value: "RANKED_SWEAT", label: "Ranked Play Sweats" },
    { value: "CASUAL_SOCIALIZER", label: "Co-op & Social Squads" },
    { value: "CASUAL_WARRIOR", label: "Casual Multiplayer Warriors" },
    { value: "LORE_SEEKER", label: "Campaign Purists" },
  ],
  WOW: [
    { value: "ALL", label: "All World of Warcraft Cohorts" },
    { value: "AZERITE_COLLECTOR", label: "Mount & Pet Collectors" },
    { value: "COMPETITIVE_GRINDER", label: "Mythic+ Key Grinders" },
    { value: "RANKED_SWEAT", label: "Arena & RBG Sweats" },
    { value: "CASUAL_SOCIALIZER", label: "Casual Guild Socializers" },
    { value: "CASUAL_WARRIOR", label: "Casual Questing Warriors" },
    { value: "LORE_SEEKER", label: "Lore & Quest Purists" },
  ],
  DIABLO4: [
    { value: "ALL", label: "All Diablo IV Cohorts" },
    { value: "SANCTUARY_COLLECTOR", label: "Sanctuary Cosmetic Collectors" },
    { value: "COMPETITIVE_GRINDER", label: "The Pit & Infernal Grinders" },
    { value: "RANKED_SWEAT", label: "Leaderboard Sweats" },
    { value: "CASUAL_SOCIALIZER", label: "World Boss & Legion Stacks" },
    { value: "CASUAL_WARRIOR", label: "Seasonal Casual Warriors" },
    { value: "LORE_SEEKER", label: "Campaign & Sanctuary Purists" },
  ],
  OVERWATCH2: [
    { value: "ALL", label: "All Overwatch 2 Cohorts" },
    { value: "MYTHIC_COLLECTOR", label: "Mythic Skin Prism Collectors" },
    { value: "COMPETITIVE_GRINDER", label: "Competitive Grandmasters" },
    { value: "RANKED_SWEAT", label: "Role Queue Sweats" },
    { value: "CASUAL_SOCIALIZER", label: "5v5 Social Stacks" },
    { value: "CASUAL_WARRIOR", label: "Stadium & Arcade Stompers" },
    { value: "LORE_SEEKER", label: "Hero Lore Followers" },
  ],
  CANDYCRUSH: [
    { value: "ALL", label: "All Candy Crush Cohorts" },
    { value: "BOOSTER_WHALE", label: "Booster & Lives Whales" },
    { value: "COMPETITIVE_GRINDER", label: "Level 1,000+ Grinders" },
    { value: "RANKED_SWEAT", label: "Leaderboard Sweats" },
    { value: "CASUAL_SOCIALIZER", label: "Casual Commuters (Daily)" },
    { value: "CASUAL_WARRIOR", label: "Casual Session Warriors" },
    { value: "LORE_SEEKER", label: "Episode Story Followers" },
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
