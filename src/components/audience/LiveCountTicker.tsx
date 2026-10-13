"use client";

import React from "react";
import { ModelBadge, TabularNumber } from "@/components/brand";
import { Loader2 } from "lucide-react";

export interface LiveCountTickerProps {
  status: "idle" | "translating" | "counting" | "done" | "error";
  matchedCount: number;
  renderedCount?: number;
  executionMs?: number;
  translateMs?: number;
  modelUsed?: string;
  streamingGql?: string;
  errorMessage?: string | null;
  onOpenGraph?: () => void;
  onPressureTest?: () => void;
}

export function LiveCountTicker({
  status,
  matchedCount,
  renderedCount,
  executionMs,
  translateMs,
  modelUsed = "live-telemetry-eval",
  streamingGql,
  errorMessage,
  onOpenGraph,
  onPressureTest,
}: LiveCountTickerProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-court-black/70 p-4 min-w-[260px]">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
            {status === "translating" || status === "counting" ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin text-twok-red" />
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "error" ? "bg-loss-red" : "bg-win-green"
                }`}
              />
            )}
            <span>
              {status === "translating"
                ? "Translating NL → GQL"
                : status === "counting"
                  ? "Querying 2K Graph"
                  : status === "error"
                    ? "Graph Error"
                    : "2K Graph · LIVE"}
            </span>
          </span>
          {typeof executionMs === "number" && executionMs > 0 && (
            <span className="font-mono text-[10px] tabular text-win-green">
              {executionMs} ms
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <div className="font-display text-4xl font-semibold tracking-tight text-chalk tabular">
            <TabularNumber value={matchedCount} />
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-chalk-dim">
            players
          </span>
        </div>

        {typeof renderedCount === "number" && renderedCount > 0 && (
          <div className="mt-1 font-mono text-[11px] text-chalk-dim tabular">
            Rendering top {renderedCount} by LTV ·{" "}
            <span className="text-vc-gold">TakeTwoPlayerGraph</span>
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className="mt-2 rounded-lg border border-loss-red/40 bg-loss-red/10 p-2 font-mono text-[11px] text-loss-red">
            {errorMessage}
          </div>
        )}

        {streamingGql && (
          <div className="mt-2.5 h-16 overflow-hidden rounded-lg border border-white/[0.06] bg-court-ink/90 p-2 font-mono text-[10px] leading-relaxed text-chalk-dim">
            <pre className="whitespace-pre-wrap break-words">{streamingGql}</pre>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.08] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <ModelBadge modelId={modelUsed} latencyMs={translateMs} size="xs" />
        </div>

        {(onOpenGraph || onPressureTest) && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {onOpenGraph && (
              <button
                type="button"
                onClick={onOpenGraph}
                className="rounded-lg bg-twok-red px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider font-semibold text-chalk hover:bg-twok-red/90"
              >
                Explore Graph
              </button>
            )}
            {onPressureTest && (
              <button
                type="button"
                onClick={onPressureTest}
                className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider font-semibold text-chalk hover:bg-white/10"
              >
                Focus Group
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
