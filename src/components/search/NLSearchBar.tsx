"use client";

import React, { useState } from "react";
import {
  Code,
  ArrowRight,
  Users,
  Loader2,
  X,
  AlertTriangle,
  Target,
} from "lucide-react";
import { GraphData, GameFranchise } from "@/lib/types";
import { TabularNumber } from "@/components/brand";

interface NLSearchBarProps {
  selectedGame?: GameFranchise;
  onSearchResults: (
    graphData: GraphData,
    summary: string,
    gql: string,
    metrics: any,
    queryPrompt?: string,
    rawResponse?: any
  ) => void;
  onLaunchFocusGroup: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isFocusGroupLoading?: boolean;
  isInspectorOpen?: boolean;
  onResetToMacro?: () => void;
}

const GOLDEN_PLAY_PRESETS: Array<{
  tag: string;
  label: string;
  query: string;
}> = [
  {
    tag: "01",
    label: "2K26 Holdouts w/ 2K27 Crew",
    query:
      "High-spend NBA 2K26 veterans who haven't migrated to NBA 2K27 yet and have Crew mates active in NBA 2K27",
  },
  {
    tag: "02",
    label: "S2 Sub-85 OVR Build Cliff",
    query:
      "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
  },
  {
    tag: "03",
    label: "MyTEAM 10+ Opal Whales",
    query:
      "NBA 2K27 MyTEAM whales with 10+ Galaxy Opals and Hall of Fame Season Pass",
  },
  {
    tag: "04",
    label: "Multi-Title 2K Cross-Play",
    query:
      "Multi-franchise 2K players linked via 2K Account playing NBA 2K27 alongside WWE 2K25, PGA TOUR 2K25, Borderlands 4, or Civilization VII",
  },
];

export default function NLSearchBar({
  selectedGame = "ALL",
  onSearchResults,
  onLaunchFocusGroup,
  isLoading,
  setIsLoading,
  isFocusGroupLoading = false,
  isInspectorOpen = false,
  onResetToMacro,
}: NLSearchBarProps) {
  const [query, setQuery] = useState<string>("");
  const [showGql, setShowGql] = useState<boolean>(false);
  const [currentGql, setCurrentGql] = useState<string>("");
  const [summaryText, setSummaryText] = useState<string>("");
  const [metrics, setMetrics] = useState<any>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [modelUsed, setModelUsed] = useState<string>("live-telemetry-eval");
  const [executionMs, setExecutionMs] = useState<number>(0);
  const [errorText, setErrorText] = useState<string>("");

  const handleSearch = async (
    searchPrompt?: string,
    excludeList: string[] = []
  ) => {
    const q = searchPrompt || query;
    if (!q.trim()) return;

    setIsLoading(true);
    setErrorText("");
    try {
      const res = await fetch("/api/audiences/nl-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          franchise: selectedGame,
          excludeConditions: excludeList,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSummaryText("");
        setMetrics(null);
        setErrorText(data?.error || `Query failed (HTTP ${res.status}).`);
        return;
      }

      setCurrentGql(data.generated_gql);
      setSummaryText(data.natural_language_summary);
      setMetrics(data.aggregate_metrics);
      setConditions(data.conditions || []);
      setModelUsed(data.model_used || "live-telemetry-eval");
      setExecutionMs(data.execution_ms || 0);

      onSearchResults(
        { nodes: data.nodes, links: data.links },
        data.natural_language_summary,
        data.generated_gql,
        data.aggregate_metrics,
        q,
        data
      );
    } catch (e: any) {
      setSummaryText("");
      setMetrics(null);
      setErrorText(e?.message || "Could not reach the query service.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCondition = (id: string) => {
    const next = [...excludedIds, id];
    setExcludedIds(next);
    handleSearch(query, next);
  };

  const handleClear = () => {
    setQuery("");
    setSummaryText("");
    setCurrentGql("");
    setMetrics(null);
    setConditions([]);
    setExcludedIds([]);
    if (onResetToMacro) {
      onResetToMacro();
    }
  };

  const visibleConditions = conditions.filter(
    (c) => !excludedIds.includes(c.id)
  );

  return (
    <div
      className={`absolute bottom-4 left-1/2 ${
        isInspectorOpen ? "lg:left-[calc(50%-190px)]" : ""
      } -translate-x-1/2 transition-all duration-200 z-20 w-[92%] max-w-2xl flex flex-col items-center gap-1.5 font-sans`}
    >
      {errorText && (
        <div
          role="alert"
          className="apple-glass-heavy w-full rounded-2xl border border-loss-red/40 p-2.5 px-3.5 flex items-start gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 text-loss-red shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-loss-red">
              Query could not be completed
            </div>
            <div className="text-[11px] text-chalk-dim font-mono break-words mt-0.5">
              {errorText}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorText("")}
            aria-label="Dismiss error"
            className="ml-auto shrink-0 text-chalk-dim hover:text-chalk"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Compact 1-Line Segment Summary Bar */}
      {(summaryText || metrics) && (
        <div className="apple-glass-heavy glass-enter w-full rounded-2xl px-3.5 py-2 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
            <span className="h-2 w-2 rounded-full bg-win-green shrink-0 animate-pulse" />
            <span className="text-xs font-semibold text-win-green font-mono tabular whitespace-nowrap">
              <TabularNumber value={metrics?.matched_count || 0} /> players
            </span>

            {visibleConditions.length > 0 && (
              <div className="flex items-center gap-1.5 min-w-0">
                {visibleConditions.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-chalk whitespace-nowrap"
                  >
                    <span>{c.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(c.id)}
                      className="text-chalk-dim hover:text-loss-red"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onLaunchFocusGroup}
              disabled={isFocusGroupLoading}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
            >
              {isFocusGroupLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Running…</span>
                </>
              ) : (
                <>
                  <Users className="h-3.5 w-3.5" />
                  <span>Focus Group</span>
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>

            {onResetToMacro && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-1 text-chalk-dim hover:text-chalk"
                title="Reset to Full Graph"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* GQL Preview Accordion */}
      {showGql && currentGql && (
        <div className="apple-glass-heavy w-full rounded-2xl p-3 text-left font-mono text-xs text-chalk">
          <div className="flex items-center justify-between text-[11px] text-chalk-dim mb-1.5 border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5 text-twok-red" />
              <span>2K Courtside Graph GQL</span>
            </span>
            <span className="tabular text-win-green">{executionMs} ms</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap py-1 text-chalk-dim text-[11px] max-h-28">
            {currentGql}
          </pre>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="apple-glass-heavy w-full relative flex items-center rounded-2xl p-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setExcludedIds([]);
              handleSearch(query, []);
            }
          }}
          placeholder="Ask anything across 2K (e.g., NBA 2K26 holdouts with active 2K27 Crew mates)..."
          className="w-full bg-transparent text-xs text-white placeholder:text-gray-400 focus:outline-none px-3"
        />

        <div className="flex items-center gap-1.5 pr-1">
          {currentGql && (
            <button
              type="button"
              onClick={() => setShowGql(!showGql)}
              className={`p-1.5 rounded-xl text-xs ${
                showGql
                  ? "bg-white/15 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
              title="Inspect Graph Query"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setExcludedIds([]);
              handleSearch(query, []);
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Running…</span>
              </span>
            ) : (
              <>
                <Target className="h-3 w-3" />
                <span>Segment</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Compact Quick Suggestion Chips */}
      <div className="flex items-center justify-center gap-1.5 w-full overflow-x-auto py-0.5">
        {GOLDEN_PLAY_PRESETS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setQuery(p.query);
              setExcludedIds([]);
              handleSearch(p.query, []);
            }}
            className="apple-glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-gray-300 hover:text-white whitespace-nowrap"
          >
            <span className="font-mono text-[11px] font-semibold text-twok-red">
              {p.tag} ·
            </span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
