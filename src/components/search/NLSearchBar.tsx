"use client";

import React, { useState } from "react";
import { Sparkles, Code, ArrowRight, CheckCircle, Users, Loader2, X, RefreshCw, AlertTriangle } from "lucide-react";
import { GraphData, GameFranchise } from "@/lib/types";

interface NLSearchBarProps {
  selectedGame?: GameFranchise;
  onSearchResults: (graphData: GraphData, summary: string, gql: string, metrics: any, queryPrompt?: string) => void;
  onLaunchDeepSona: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isDeepSonaLoading?: boolean;
  onResetToMacro?: () => void;
}

const SAMPLE_PROMPTS_BY_GAME: Record<GameFranchise, string[]> = {
  ALL: [
    "Warzone players on 3+ loss streaks whose COD clanmates migrated to Diablo IV",
    "High-LTV whales at risk of churn following Scump or FaZe Swagg",
    "Battle.net accounts linked across Call of Duty and World of Warcraft: Midnight",
    "Cross-title whales with spend over $3,500 across Call of Duty and WoW",
  ],
  COD: [
    "Warzone players on 3+ Gulag loss streaks whose COD clanmates migrated to Diablo IV",
    "Whale players ($500+ spend) at risk of churn following Scump or FaZe Swagg",
    "Warzone players with 3+ Gulag losses and high tilt in Los Angeles",
    "BlackCell whales who bought the Black Ops 7 pass ($1,500+ spend)",
  ],
  WOW: [
    "Midnight Season 2 raiders with 3+ wipe streaks",
    "Collectors with 10+ years tenure and 5+ expansions owned",
    "Players holding WoW Tokens with sub lapsing in 30 days",
    "Mists of Pandaria Classic players who never bought Midnight",
  ],
  DIABLO4: [
    "Pit grinders with death slumps and churn risk over 0.65",
    "Sanctuary collectors with $800+ spend on cosmetics",
    "Season 13 players who skipped the Lord of Hatred expansion",
    "Vessel of Hatred owners who have not returned this season",
  ],
  OVERWATCH2: [
    "Competitive players with 3+ demotion losses this season",
    "Mythic Prism whales with spend over $600",
    "Season 4 Heroes of Busan players with low match frequency",
    "Free-to-play accounts that never converted to a battle pass",
  ],
  CANDYCRUSH: [
    "Players stuck out of moves on level 5,000+ with no boosters",
    "Gold bar whales with spend over $1,200",
    "Daily players on 4+ sessions with lapsing Sugar Track progress",
    "Lapsed commuters with high elasticity for extra-moves offers",
  ],
};

export default function NLSearchBar({
  selectedGame = "ALL",
  onSearchResults,
  onLaunchDeepSona,
  isLoading,
  setIsLoading,
  isDeepSonaLoading = false,
  onResetToMacro,
}: NLSearchBarProps) {
  const [query, setQuery] = useState<string>("");
  const [showGql, setShowGql] = useState<boolean>(false);
  const [currentGql, setCurrentGql] = useState<string>("");
  const [summaryText, setSummaryText] = useState<string>("");
  const [metrics, setMetrics] = useState<any>(null);
  // A failed query previously fell through the `if (res.ok)` with no else,
  // leaving the last successful cohort on screen. The presenter had no way to
  // tell a stale result from a fresh one.
  const [errorText, setErrorText] = useState<string>("");

  const currentPrompts = SAMPLE_PROMPTS_BY_GAME[selectedGame] || SAMPLE_PROMPTS_BY_GAME.ALL;

  const handleSearch = async (searchPrompt?: string) => {
    const q = searchPrompt || query;
    if (!q.trim()) return;

    setIsLoading(true);
    setErrorText("");
    try {
      const res = await fetch("/api/audiences/nl-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, game: selectedGame }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSummaryText("");
        setMetrics(null);
        setErrorText(
          data?.error_kind === "SPANNER_UNAVAILABLE"
            ? `Cloud Spanner is unreachable — no results shown rather than estimated ones. ${data.error ?? ""}`
            : data?.error || `Query failed (HTTP ${res.status}).`
        );
        return;
      }

      setCurrentGql(data.generated_gql);
      setSummaryText(data.natural_language_summary);
      setMetrics(data.aggregate_metrics);
      onSearchResults(
        { nodes: data.nodes, links: data.links },
        data.natural_language_summary,
        data.generated_gql,
        data.aggregate_metrics,
        q
      );
    } catch (e: any) {
      console.error("NL Query error:", e);
      setSummaryText("");
      setMetrics(null);
      setErrorText(e?.message || "Could not reach the query service.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSummaryText("");
    setCurrentGql("");
    setMetrics(null);
    if (onResetToMacro) {
      onResetToMacro();
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-2xl flex flex-col items-center gap-2 font-sans">
      {/* Failure banner. Deliberately loud: the alternative to showing this is
          showing numbers we cannot stand behind. */}
      {errorText && (
        <div
          role="alert"
          className="w-full bg-red-950/80 backdrop-blur-2xl p-3 px-4 rounded-2xl border border-red-500/40 shadow-2xl flex items-start gap-3 animate-fade-in"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-red-200">Query could not be completed</div>
            <div className="text-[11px] text-red-300/80 font-mono break-words mt-0.5">{errorText}</div>
          </div>
          <button
            onClick={() => setErrorText("")}
            aria-label="Dismiss error"
            className="ml-auto shrink-0 text-red-300/60 hover:text-red-200 transition-colors active:scale-90 motion-reduce:active:scale-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sleek Segment Summary Banner */}
      {summaryText && (
        <div className="w-full bg-black/80 backdrop-blur-2xl p-3 px-4 rounded-2xl border border-white/10 shadow-2xl flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Cohort Isolated:</span>
                <span className="text-emerald-400 font-mono">
                  {(metrics?.matched_count || 0).toLocaleString()} players matched
                  {metrics?.is_sampled ? ` • showing ${metrics?.rendered_count || 0}` : ""}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-medium border ${
                    metrics?.is_live
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : "bg-white/5 text-gray-400 border-white/10"
                  }`}
                  title={metrics?.spanner_source || ""}
                >
                  {metrics?.is_live ? "LIVE SPANNER" : "LOCAL ENGINE"}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                {summaryText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onLaunchDeepSona}
              disabled={isDeepSonaLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-lg ${
                isDeepSonaLoading
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
            >
              {isDeepSonaLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5 text-black" />
                  <span>Test Focus Group</span>
                  <ArrowRight className="w-3 h-3 text-black" />
                </>
              )}
            </button>

            {onResetToMacro && (
              <button
                onClick={handleClear}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                title="Reset to Macro Galaxy"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* GQL Preview Accordion */}
      {showGql && currentGql && (
        <div className="w-full bg-black/85 backdrop-blur-2xl p-3.5 rounded-2xl border border-white/10 text-left font-mono text-xs text-gray-300 animate-fade-in">
          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2 border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-gray-400" />
              <span>Spanner Graph GQL</span>
            </span>
            <span className="text-gray-400">Vertex AI Gemini</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap py-1 text-gray-300 text-[11px] max-h-32">{currentGql}</pre>
        </div>
      )}

      {/* Minimalist Search Input Bar */}
      <div className="w-full relative flex items-center bg-black/70 backdrop-blur-2xl rounded-2xl border border-white/15 p-1.5 shadow-2xl focus-within:border-white/40 transition-all">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={`Describe an audience (e.g. 'Whales with spend over $1,000' in ${selectedGame === "ALL" ? "any title" : selectedGame})...`}
          className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none px-3.5 font-normal"
        />

        <div className="flex items-center gap-1.5 pr-1">
          {currentGql && (
            <button
              onClick={() => setShowGql(!showGql)}
              className={`p-2 rounded-xl text-xs transition-all ${
                showGql
                  ? "bg-white/20 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
              title="Inspect GQL"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 active:scale-95"
          >
            {isLoading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Segmenting...</span>
              </span>
            ) : (
              <>
                <span>Segment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Preset Chips per Title */}
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5 no-scrollbar">
        {currentPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuery(p);
              handleSearch(p);
            }}
            className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xl hover:bg-white/10 border border-white/10 text-[11px] text-gray-400 hover:text-white whitespace-nowrap transition-all"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
