"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ContextualViewType, GameFranchise, SegmentationLens } from "@/lib/types";
import { STUDIOS, STUDIO_NAMES, type Studio } from "@/lib/studios";

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
  { id: "FRANCHISE", label: "Studio & title" },
  { id: "ARCHETYPE", label: "Archetype" },
  { id: "SOCIAL_HOPS", label: "Social hops (1°·2°·3°)" },
  { id: "CATE_UPLIFT", label: "CATE uplift" },
  { id: "PORTFOLIO_RINGS", label: "3-ring portfolio" },
  { id: "TRAJECTORY", label: "Trajectory" },
];

interface FilterOptions {
  games: Array<{ franchise: string; title: string; studio: Studio; lifecycle_status: string | null }>;
  archetypes: Array<{ archetype: string; name: string; studio: Studio; players: number }>;
}

/** Title + archetype options come from Spanner (Games, Players) so new studios appear automatically. */
function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/graph/view?view=filters", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j as FilterOptions;
      })
      .then((j) => !cancelled && setOptions(j))
      .catch((e) => !cancelled && setError(String(e?.message || e)));
    return () => {
      cancelled = true;
    };
  }, []);
  return { options, error };
}

export default function GraphControls({
  currentView,
  onViewChange,
  selectedGame,
  onGameChange,
  archetypeFilter,
  onArchetypeChange,
  segmentationLens = "FRANCHISE",
  onLensChange,
  is3D,
  onToggle3D,
}: GraphControlsProps) {
  const { options, error: optionsError } = useFilterOptions();
  const selectedStudio = useMemo<Studio | null>(() => {
    if (selectedGame === "ALL") return null;
    return options?.games.find((g) => g.franchise === selectedGame)?.studio ?? null;
  }, [options, selectedGame]);

  const views: { id: ContextualViewType; label: string }[] = [
    { id: "audience-cohorts", label: "Cohorts" },
    { id: "marketing-journey", label: "Journeys" },
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
          {optionsError ? (
            <span className="text-[11px] text-rose-300" title={optionsError}>
              Filters unavailable: {optionsError.slice(0, 60)}
            </span>
          ) : (
            <>
              <select
                aria-label="Filter by title"
                value={selectedGame}
                onChange={(e) => {
                  onGameChange(e.target.value as GameFranchise);
                  onArchetypeChange("ALL");
                }}
                className="bg-transparent text-[11px] text-white font-medium focus:outline-none cursor-pointer max-w-[170px]"
              >
                <option value="ALL" className="bg-[#0E1117] text-white">
                  All Take-Two titles
                </option>
                {STUDIOS.map((s) => {
                  const titles = (options?.games || []).filter((g) => g.studio === s);
                  if (titles.length === 0) return null;
                  return (
                    <optgroup key={s} label={STUDIO_NAMES[s]} className="bg-[#0E1117] text-gray-400">
                      {titles.map((g) => (
                        <option key={g.franchise} value={g.franchise} className="bg-[#0E1117] text-white">
                          {g.title}
                          {g.lifecycle_status === "PRE_LAUNCH" ? " (pre-launch, wishlists)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>

              <span className="h-3 w-px bg-white/15 mx-0.5" />
              <select
                aria-label="Filter by archetype"
                value={archetypeFilter}
                onChange={(e) => onArchetypeChange(e.target.value)}
                className="bg-transparent text-[11px] text-white font-medium focus:outline-none cursor-pointer max-w-[150px]"
              >
                <option value="ALL" className="bg-[#0E1117] text-white">
                  All archetypes
                </option>
                {STUDIOS.filter((s) => !selectedStudio || s === selectedStudio).map((s) => {
                  const rows = (options?.archetypes || []).filter((a) => a.studio === s);
                  const merged = new Map<string, { name: string; players: number }>();
                  rows.forEach((a) => {
                    const cur = merged.get(a.archetype) || { name: a.name, players: 0 };
                    cur.players += a.players;
                    merged.set(a.archetype, cur);
                  });
                  if (merged.size === 0) return null;
                  return (
                    <optgroup key={s} label={STUDIO_NAMES[s]} className="bg-[#0E1117] text-gray-400">
                      {Array.from(merged.entries()).map(([id, v]) => (
                        <option key={`${s}-${id}`} value={id} className="bg-[#0E1117] text-white">
                          {v.name} ({v.players.toLocaleString()})
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </>
          )}

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
