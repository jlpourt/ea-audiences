"use client";

import React, { useState } from "react";
import { FRANCHISE_GROUPS, GameFranchise } from "@/lib/types";
import { GlassPanel, TabularNumber } from "@/components/brand";
import { LiveCountTicker } from "./LiveCountTicker";
import { GqlDisclosure } from "./GqlDisclosure";
import { Plus, Search, Target, X } from "lucide-react";

export interface ConditionChip {
  id: string;
  field: string;
  op: string;
  value: string;
  label: string;
  rawFragment?: string;
}

export interface AudienceBuilderProps {
  initialQuery?: string;
  selectedFranchise: GameFranchise;
  onFranchiseChange: (f: GameFranchise) => void;
  onRunQuery: (
    query: string,
    franchise: GameFranchise,
    excludeConditionIds?: string[]
  ) => void;
  isSearching?: boolean;
  matchedCount: number;
  renderedCount?: number;
  executionMs?: number;
  translateMs?: number;
  modelUsed?: string;
  generatedGql?: string;
  whereClause?: string;
  matchPattern?: string;
  conditions?: ConditionChip[];
  errorMessage?: string | null;
  onOpenGraph?: () => void;
  onPressureTest?: () => void;
  onSaveAudience?: () => void;
}

const QUICK_PREDICATES: Array<{ label: string; snippet: string }> = [
  {
    label: "MyPLAYER OVR < 85",
    snippet: "with MyPLAYER OVR below 85",
  },
  {
    label: "90d VC Spend ≥ $50",
    snippet: "who spent $50+ on VC in the last 90 days",
  },
  {
    label: "Inactive ≥ 7 days",
    snippet: "who haven't logged in for 7+ days",
  },
  {
    label: "Active Crew Mates",
    snippet: "and are in a Crew with active teammates",
  },
  {
    label: "Season Pass = HoF",
    snippet: "with Hall of Fame Season Pass",
  },
  {
    label: "Galaxy Opals ≥ 10",
    snippet: "holding 10+ MyTEAM Galaxy Opals",
  },
  {
    label: "Rockstar Social Club Linked",
    snippet: "with a linked Rockstar Social Club account and GTA Online spend",
  },
  {
    label: "No GTA VI Pre-Order",
    snippet: "who have not pre-ordered GTA VI",
  },
];

export function AudienceBuilder({
  initialQuery = "",
  selectedFranchise,
  onFranchiseChange,
  onRunQuery,
  isSearching = false,
  matchedCount,
  renderedCount,
  executionMs,
  translateMs,
  modelUsed,
  generatedGql,
  whereClause,
  matchPattern,
  conditions = [],
  errorMessage,
  onOpenGraph,
  onPressureTest,
  onSaveAudience,
}: AudienceBuilderProps) {
  const [queryText, setQueryText] = useState(
    initialQuery ||
      "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates"
  );
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [showAddPopover, setShowAddPopover] = useState(false);

  React.useEffect(() => {
    if (initialQuery && initialQuery !== queryText) {
      setQueryText(initialQuery);
      setExcludedIds([]);
    }
  }, [initialQuery]);

  const activeGroupId =
    FRANCHISE_GROUPS.find((g) => g.franchises.includes(selectedFranchise))?.id ||
    "all";

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!queryText.trim()) return;
    setExcludedIds([]);
    onRunQuery(queryText.trim(), selectedFranchise, []);
  };

  const handleRemoveCondition = (condId: string) => {
    const nextExcluded = [...excludedIds, condId];
    setExcludedIds(nextExcluded);
    onRunQuery(queryText.trim(), selectedFranchise, nextExcluded);
  };

  const handleAppendPredicate = (snippet: string) => {
    const next = `${queryText.trim()} ${snippet}`.trim();
    setQueryText(next);
    setShowAddPopover(false);
    setExcludedIds([]);
    onRunQuery(next, selectedFranchise, []);
  };

  const visibleConditions = conditions.filter((c) => !excludedIds.includes(c.id));
  const cohortRcsValue = Math.round((matchedCount || 0) * 185);

  return (
    <GlassPanel weight="heavy" className="p-5 border border-white/12">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-5">
        {/* Left: Segmented Franchise Bar + NL Prompt + Condition Chips */}
        <div className="flex flex-col justify-between space-y-3.5">
          {/* Top Bar: Franchise Group Segmented Control */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-court-black/80 p-1 border border-white/[0.08]">
              {FRANCHISE_GROUPS.map((group) => {
                const isActive = activeGroupId === group.id;
                const primaryFranchise = group.franchises[0];
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onFranchiseChange(primaryFranchise)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                      isActive
                        ? "bg-twok-red text-chalk font-semibold"
                        : "text-chalk-dim hover:text-chalk hover:bg-white/[0.04]"
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-vc-gold/30 bg-vc-gold/10 px-2.5 py-1 font-mono text-[11px] tabular">
                <span className="text-chalk-dim">Cohort RCS Value:</span>
                <span className="font-semibold text-vc-gold">
                  $<TabularNumber value={cohortRcsValue} />
                </span>
              </div>
              {onSaveAudience && (
                <button
                  type="button"
                  onClick={onSaveAudience}
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-chalk hover:bg-white/[0.08]"
                >
                  Save Segment
                </button>
              )}
            </div>
          </div>

          {/* Prompt Textarea (Enter submits, Shift+Enter newline; zero keystroke motion) */}
          <form onSubmit={handleSubmit} className="relative">
            <label htmlFor="courtside-nl-input" className="sr-only">
              Describe your target audience in natural language
            </label>
            <textarea
              id="courtside-nl-input"
              rows={3}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Describe the Take-Two audience segment (e.g., NBA 2K27 MyCAREER builds below 85 OVR with active Crew mates)…"
              className="w-full resize-none rounded-xl border border-white/12 bg-court-black/80 px-4 py-3 pr-36 text-sm text-chalk placeholder:text-chalk-dim focus:border-twok-red focus:outline-none leading-relaxed"
            />
            <button
              type="submit"
              disabled={isSearching || !queryText.trim()}
              className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-twok-red px-3.5 py-2 font-mono text-xs uppercase tracking-wider font-semibold text-chalk hover:bg-twok-red/90 disabled:opacity-40"
            >
              <Target className="h-3.5 w-3.5" />
              <span>{isSearching ? "Running…" : "Build Segment"}</span>
            </button>
          </form>

          {/* Parsed Condition Chips + "+ Add Condition" Popover */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-chalk-dim mr-1">
              Predicates:
            </span>
            {visibleConditions.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-0.5 font-mono text-[11px] text-chalk"
              >
                <span>{c.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCondition(c.id)}
                  aria-label={`Remove condition ${c.label}`}
                  className="text-chalk-dim hover:text-loss-red"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddPopover((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/20 bg-white/[0.02] px-2.5 py-0.5 font-mono text-[11px] text-chalk-dim hover:border-twok-red/50 hover:text-chalk"
              >
                <Plus className="h-3 w-3" />
                <span>Add condition</span>
              </button>

              {showAddPopover && (
                <div className="absolute left-0 top-7 z-40 w-64 rounded-xl border border-white/15 bg-court-ink p-2 shadow-2xl">
                  <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                    Append Graph Predicate
                  </div>
                  <div className="space-y-0.5">
                    {QUICK_PREDICATES.map((qp) => (
                      <button
                        key={qp.label}
                        type="button"
                        onClick={() => handleAppendPredicate(qp.snippet)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-[11px] text-chalk hover:bg-white/[0.06]"
                      >
                        <span>{qp.label}</span>
                        <Plus className="h-3 w-3 text-twok-red" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible GQL Disclosure */}
          {generatedGql && (
            <GqlDisclosure
              gql={generatedGql}
              whereClause={whereClause}
              matchPattern={matchPattern}
              executionMs={executionMs}
            />
          )}
        </div>

        {/* Right: Live Count Ticker */}
        <LiveCountTicker
          status={
            errorMessage
              ? "error"
              : isSearching
                ? "counting"
                : "done"
          }
          matchedCount={matchedCount}
          renderedCount={renderedCount}
          executionMs={executionMs}
          translateMs={translateMs}
          modelUsed={modelUsed}
          errorMessage={errorMessage}
          onOpenGraph={onOpenGraph}
          onPressureTest={onPressureTest}
        />
      </div>
    </GlassPanel>
  );
}
