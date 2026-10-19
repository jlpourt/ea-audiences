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
  Sparkles,
} from "lucide-react";
import { GraphData, GameFranchise, CohortContext } from "@/lib/types";
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
  onFindGraphTwins?: () => void;
  isFindingTwins?: boolean;
  cohortContext?: Partial<CohortContext> | null;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isFocusGroupLoading?: boolean;
  isInspectorOpen?: boolean;
  onResetToMacro?: () => void;
}

const GOLDEN_PLAY_PRESETS: Array<{
  label: string;
  query: string;
}> = [
  {
    label: "2K26 Holdouts",
    query:
      "NBA 2K26 holdout veterans at the Concordia Crew tipping point with active NBA 2K27 Crew mates",
  },
  {
    label: "S2 Build Cliff",
    query:
      "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
  },
  {
    label: "2K → GTA Online invites",
    query: "NBA 2K players who invited a friend into GTA Online",
  },
  {
    label: "GTA VI wishlist crews",
    query: "GTA Online players in a crew who wishlisted GTA VI",
  },
];

export default function NLSearchBar({
  selectedGame = "ALL",
  onSearchResults,
  onLaunchFocusGroup,
  onFindGraphTwins,
  isFindingTwins = false,
  cohortContext,
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

      {/* Unified 1-Line Cohort & Causal Uplift Summary Bar */}
      {(summaryText || metrics || cohortContext) && (
        <div
          data-testid="causal-waterfall-ribbon"
          className="apple-glass-heavy glass-enter w-full rounded-2xl px-3.5 py-2 flex items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar">
            <span className="h-2 w-2 rounded-full bg-win-green shrink-0 animate-pulse" />
            {(() => {
              const matched = Number(metrics?.matched_count ?? cohortContext?.matchedCount ?? 0);
              const rendered = Number(metrics?.rendered_count ?? cohortContext?.renderedCount ?? matched);
              const strata: Array<{ studio: string; matched: number; rendered: number }> =
                metrics?.sample_strata || [];
              return (
                <span
                  className="text-xs font-semibold text-win-green font-mono tabular whitespace-nowrap"
                  data-testid="nl-sample-count"
                  title={
                    strata.length
                      ? `Sample stratified by studio, proportional to matched counts: ${strata
                          .map((x) => `${x.studio === "ROCKSTAR" ? "Rockstar" : x.studio === "ZYNGA" ? "Zynga" : "2K"} ${x.rendered}/${x.matched}`)
                          .join(" · ")}`
                      : undefined
                  }
                >
                  {rendered < matched ? (
                    <>
                      showing <TabularNumber value={rendered} /> of <TabularNumber value={matched} /> matched
                    </>
                  ) : (
                    <>
                      <TabularNumber value={matched} /> matched
                    </>
                  )}
                </span>
              );
            })()}

            {Array.isArray(metrics?.sample_strata) && metrics.sample_strata.length > 1 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-0.5 font-mono text-[11px] text-chalk whitespace-nowrap">
                {metrics.sample_strata.map((x: any) => (
                  <span key={x.studio} className="inline-flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          x.studio === "ROCKSTAR" ? "#F5B400" : x.studio === "ZYNGA" ? "#2FD38A" : "#E4002B",
                      }}
                    />
                    {Number(x.matched).toLocaleString()}
                  </span>
                ))}
              </span>
            )}

            {visibleConditions.length > 0 && (
              <div className="flex items-center gap-1.5 min-w-0">
                {visibleConditions.slice(0, 2).map((c) => (
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
            {onFindGraphTwins && (
              <button
                type="button"
                onClick={onFindGraphTwins}
                disabled={isFindingTwins}
                title="Find the players most similar to this cohort (live cosine similarity over all players in Spanner)"
                className="flex items-center gap-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/35 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
              >
                {isFindingTwins ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Twins…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Graph Twins</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onLaunchFocusGroup}
              disabled={isFocusGroupLoading}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              {isFocusGroupLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 courtside-Transfer-pulse" />
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
          placeholder="Ask across 2K, Rockstar Games and Zynga (e.g., Zynga players who also play NBA 2K Mobile)..."
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
                <Loader2 className="h-3 w-3 courtside-Transfer-pulse" />
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

      {/* Single-Row Consolidated Quick Presets */}
      <div className="flex items-center justify-center gap-1.5 w-full py-0.5 overflow-x-auto no-scrollbar">
        {GOLDEN_PLAY_PRESETS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setQuery(p.query);
              setExcludedIds([]);
              handleSearch(p.query, []);
            }}
            className="apple-glass flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] text-gray-300 hover:text-white hover:border-white/25 transition-all whitespace-nowrap"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-twok-red/80 shrink-0" />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
