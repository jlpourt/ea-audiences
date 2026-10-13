"use client";

import React, { useEffect, useState } from "react";
import { SavedAudience } from "@/lib/types";
import { GlassPanel, TabularNumber } from "@/components/brand";
import { Database, Loader2, Play, Send, X } from "lucide-react";

export interface SavedAudiencesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAudience: (aud: SavedAudience) => void;
  onActivateAudience: (aud: SavedAudience) => void;
}

export function SavedAudiencesDrawer({
  isOpen,
  onClose,
  onSelectAudience,
  onActivateAudience,
}: SavedAudiencesDrawerProps) {
  const [audiences, setAudiences] = useState<SavedAudience[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/audiences/saved", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.audiences)) setAudiences(d.audiences);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <GlassPanel
        weight="heavy"
        enter
        className="h-full w-full max-w-lg flex flex-col justify-between rounded-none border-l border-white/12 p-6"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-win-green">
              <Database className="h-3 w-3" />
              <span>2K Courtside · Saved Cohorts</span>
            </div>
            <h2 className="font-display text-xl font-semibold text-chalk mt-1">
              Saved Audience Segments
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-chalk-dim hover:bg-white/[0.06] hover:text-chalk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 font-mono text-xs text-chalk-dim gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-twok-red" />
              <span>Loading saved cohorts…</span>
            </div>
          ) : audiences.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center text-xs text-chalk-dim">
              No saved segments found. Build a cohort and click &ldquo;Save Cohort&rdquo;.
            </div>
          ) : (
            audiences.map((aud) => (
              <div
                key={aud.audience_id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-semibold text-chalk text-sm">
                      {aud.name}
                    </div>
                    <div className="font-mono text-[10px] text-chalk-dim">
                      {aud.audience_id} · {aud.franchise || "NBA2K"} ·{" "}
                      {aud.status}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular">
                    <div className="text-base font-semibold text-chalk">
                      <TabularNumber value={aud.matched_count} />
                    </div>
                    <div className="text-[10px] text-chalk-dim">players</div>
                  </div>
                </div>

                <p className="text-xs text-chalk-dim line-clamp-2">
                  {aud.nl_query}
                </p>

                <div className="flex flex-wrap gap-1">
                  {(aud.channels || []).map((c) => (
                    <span
                      key={c}
                      className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-chalk-dim border border-white/[0.08]"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectAudience(aud);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 font-mono text-[11px] text-chalk hover:bg-white/10"
                  >
                    <Play className="h-3 w-3 text-twok-red" />
                    <span>Re-Run on Graph</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onActivateAudience(aud);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-twok-red px-3 py-1.5 font-mono text-[11px] font-semibold text-chalk hover:bg-twok-red/90"
                  >
                    <Send className="h-3 w-3" />
                    <span>Activate DAG</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
