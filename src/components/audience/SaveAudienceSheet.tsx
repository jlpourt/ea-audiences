"use client";

import React, { useState } from "react";
import { ActivationChannel, CohortContext } from "@/lib/types";
import { GlassPanel, ModelBadge, TabularNumber } from "@/components/brand";
import { Bookmark, Check, Loader2, X } from "lucide-react";

export interface SaveAudienceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cohortContext?: CohortContext | null;
  generatedGql?: string;
  /** Player ids of the cohort on the canvas; seeds for the live lookalike. */
  seedPlayerIds?: string[];
  onSaved?: () => void;
}

const CHANNEL_OPTIONS: Array<{ id: ActivationChannel; label: string; sub: string }> = [
  {
    id: "IN_GAME_INBOX",
    label: "NBA 2K27 Daily Login Tile",
    sub: "MyCAREER / The City Courtside Message",
  },
  {
    id: "2K_ACCOUNT_EMAIL",
    label: "2K Account Lifecycle Email",
    sub: "Verified 2K Account CRM Spine",
  },
  {
    id: "ROCKSTAR_NEWSWIRE",
    label: "2K Locker Code Feed",
    sub: "In-game Locker Code & 2K Newsroom tile",
  },
  {
    id: "PUSH_2K_MOBILE",
    label: "MyNBA 2K Companion Push",
    sub: "iOS / Android companion notification",
  },
  {
    id: "ZYNGA_CROSS_PROMO",
    label: "2K Companion Cross-Promo",
    sub: "MyNBA2K & WWE SuperCard companion reward bridge",
  },
  {
    id: "PAID_SOCIAL",
    label: "Paid Social Suppression / Lookalike",
    sub: "YouTube / TikTok / Meta custom audience",
  },
];

export function SaveAudienceSheet({
  isOpen,
  onClose,
  cohortContext,
  generatedGql,
  onSaved,
  seedPlayerIds,
}: SaveAudienceSheetProps) {
  const [name, setName] = useState("");
  const [channels, setChannels] = useState<ActivationChannel[]>([
    "IN_GAME_INBOX",
    "2K_ACCOUNT_EMAIL",
  ]);
  const [expansionPct, setExpansionPct] = useState(0);
  const [lookalikeResult, setLookalikeResult] = useState<any | null>(null);
  const [lookalikeError, setLookalikeError] = useState<string | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseCount = cohortContext?.matchedCount ?? 0;
  // Only show an expanded total once the live lookalike has returned one.
  const totalCount =
    lookalikeResult && typeof lookalikeResult.expanded_total === "number"
      ? lookalikeResult.expanded_total
      : baseCount;

  const toggleChannel = (id: ActivationChannel) => {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleRunLookalike = async (pct: number) => {
    setExpansionPct(pct);
    if (pct === 0) {
      setLookalikeResult(null);
      return;
    }
    if (!seedPlayerIds || seedPlayerIds.length === 0) {
      setLookalikeError("Graph Twins needs the cohort's players on the canvas as seeds.");
      return;
    }
    setIsExpanding(true);
    setLookalikeError(null);
    try {
      const res = await fetch("/api/audiences/lookalike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed_player_ids: seedPlayerIds,
          matched_count: baseCount || seedPlayerIds.length,
          expansion_pct: pct,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLookalikeResult(null);
        setLookalikeError(`Graph Twins failed (HTTP ${res.status}): ${data?.error || "unknown error"}`);
        return;
      }
      setLookalikeResult(data);
    } catch (e: any) {
      setLookalikeResult(null);
      setLookalikeError(`Graph Twins request failed: ${e?.message || String(e)}`);
    } finally {
      setIsExpanding(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/audiences/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:
            name.trim() ||
            cohortContext?.suggestedCampaign ||
            "2K Courtside Custom Segment",
          nl_query: cohortContext?.query || "Custom TakeTwoPlayerGraph cohort",
          gql:
            generatedGql ||
            "GRAPH TakeTwoPlayerGraph MATCH (p:Player) RETURN p.player_id",
          matched_count: totalCount,
          channels,
          franchise: cohortContext?.franchise || "NBA2K",
          dominant_archetype: cohortContext?.dominantArchetype || "MYCAREER_STORY_CASUAL",
          avg_spend: cohortContext?.avgSpend || 180,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setToastMessage(
          `Saved Cohort · ${data.audience.audience_id}`
        );
        onSaved?.();
        setTimeout(() => {
          setToastMessage(null);
          onClose();
        }, 1400);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <GlassPanel
        weight="heavy"
        enter
        className="h-full w-full max-w-md flex flex-col justify-between rounded-none border-l border-white/12 p-6"
      >
        <div className="overflow-y-auto pr-1 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <span className="text-caption">2K Audience Library</span>
              <h2 className="font-display text-xl font-semibold text-chalk mt-0.5">
                Save Cohort
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

          <form id="save-audience-form" onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-chalk-dim mb-1.5">
                Segment Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  cohortContext?.suggestedCampaign ||
                  "Season 2 Cliff · Active Crew Mates"
                }
                className="w-full rounded-lg border border-white/15 bg-court-black/80 px-3.5 py-2 text-sm text-chalk placeholder:text-chalk-dim focus:border-twok-red focus:outline-none"
              />
            </div>

            {/* Matched + Lookalike Expansion */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                  Lookalike Expansion (3,072-d Vector)
                </span>
                <ModelBadge modelId="vector-similarity" size="xs" />
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-display text-2xl font-semibold text-chalk tabular">
                    <TabularNumber value={totalCount} />
                  </span>
                  <span className="font-mono text-xs text-chalk-dim ml-1.5">
                    total addressable players
                  </span>
                </div>
                <span className="font-mono text-xs tabular text-vc-gold">
                  +{expansionPct}% lookalike
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={expansionPct}
                onChange={(e) => handleRunLookalike(Number(e.target.value))}
                className="w-full accent-twok-red cursor-pointer"
              />

              {isExpanding && (
                <div className="flex items-center gap-2 font-mono text-[11px] text-chalk-dim">
                  <Loader2 className="h-3 w-3 courtside-Transfer-pulse text-twok-red" />
                  <span>Scoring 3,072-d graph-behavioral twins...</span>
                </div>
              )}

              {!lookalikeResult && !isExpanding && expansionPct === 0 && (
                <button
                  type="button"
                  onClick={() => handleRunLookalike(25)}
                  className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-chalk hover:border-twok-red/50 hover:bg-twok-red/10 transition-colors"
                >
                  Find Graph Twins (+25% Lookalike)
                </button>
              )}

              {lookalikeError && (
                <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-[11px] text-rose-100">
                  {lookalikeError}
                </div>
              )}

              {lookalikeResult && !isExpanding && (
                <div className="rounded-lg border border-white/[0.08] bg-court-black/70 p-3 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-win-green font-semibold tabular">
                      {lookalikeResult.similarity_range
                        ? `cosine ${Number(lookalikeResult.similarity_range.min).toFixed(3)}–${Number(lookalikeResult.similarity_range.max).toFixed(3)}`
                        : "no twins"}
                    </span>
                    <span className="text-chalk tabular">
                      +{Number(lookalikeResult.added_count).toLocaleString()} twins
                    </span>
                    {typeof lookalikeResult.twins_avg_spend_usd === "number" && (
                      <span className="text-vc-gold font-semibold tabular">
                        avg ${Math.round(lookalikeResult.twins_avg_spend_usd).toLocaleString()} lifetime
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-chalk-dim">
                      Top graph twins (cosine to seed centroid)
                    </div>
                    {(lookalikeResult.top_twins || lookalikeResult.sample_players || [])
                      .slice(0, 5)
                      .map((twin: any) => {
                        const tag = String(twin.gamer_tag || "").replace(/^@/, "");
                        const crew = twin.crew_name;
                        const matchPct = (Number(twin.cosine_similarity) * 100).toFixed(1);
                        return (
                          <div
                            key={twin.player_id || tag}
                            className="flex items-center justify-between text-[11px] text-chalk/90 py-0.5 border-b border-white/[0.04] last:border-0"
                          >
                            <span className="truncate pr-2">
                              <span className="text-chalk font-medium">@{tag}</span>
                              <span className="text-chalk-dim">
                                {" "}
                                · {String(twin.archetype || "").replace(/_/g, " ").toLowerCase()}
                                {crew ? ` · ${crew}` : ""}
                              </span>
                            </span>
                            <span className="shrink-0 text-win-green tabular">
                              {matchPct}% match
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Activation Channels */}
            <div className="space-y-2">
              <span className="block font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                Target Activation Channels
              </span>
              <div className="space-y-1.5">
                {CHANNEL_OPTIONS.map((ch) => {
                  const checked = channels.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChannel(ch.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs ${
                        checked
                          ? "border-twok-red/50 bg-twok-red/12 text-chalk"
                          : "border-white/[0.08] bg-white/[0.02] text-chalk-dim hover:text-chalk"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-chalk">{ch.label}</div>
                        <div className="font-mono text-[10px] text-chalk-dim">
                          {ch.sub}
                        </div>
                      </div>
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          checked
                            ? "border-twok-red bg-twok-red text-chalk"
                            : "border-white/20"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] pt-4 space-y-2">
          {toastMessage && (
            <div className="rounded-lg border border-win-green/40 bg-win-green/15 px-3 py-2 font-mono text-xs text-win-green">
              {toastMessage}
            </div>
          )}
          <button
            type="submit"
            form="save-audience-form"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-twok-red px-4 py-2.5 font-mono text-xs uppercase tracking-wider font-semibold text-chalk hover:bg-twok-red/90 disabled:opacity-40"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 courtside-Transfer-pulse" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
            <span>
              {isSaving
                ? "Saving Cohort…"
                : "Save Cohort"}
            </span>
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
