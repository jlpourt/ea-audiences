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
}: SaveAudienceSheetProps) {
  const [name, setName] = useState("");
  const [channels, setChannels] = useState<ActivationChannel[]>([
    "IN_GAME_INBOX",
    "2K_ACCOUNT_EMAIL",
  ]);
  const [expansionPct, setExpansionPct] = useState(0);
  const [lookalikeResult, setLookalikeResult] = useState<any | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseCount = cohortContext?.matchedCount || 284;
  const totalCount = lookalikeResult
    ? lookalikeResult.expanded_total
    : Math.round(baseCount * (1 + expansionPct / 100));

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
    setIsExpanding(true);
    try {
      const res = await fetch("/api/audiences/lookalike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dominant_archetype: cohortContext?.dominantArchetype || "CROSS_LABEL_NOMAD",
          query: cohortContext?.query || "Take-Two audience segment",
          matched_count: baseCount,
          expansion_pct: pct,
        }),
      });
      const data = await res.json();
      if (data.ok) setLookalikeResult(data);
    } catch {
      // Keep slider estimate
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
                  <span>Scoring 3,072-d player similarity...</span>
                </div>
              )}

              {lookalikeResult && !isExpanding && (
                <div className="rounded-lg border border-white/[0.06] bg-court-black/60 p-2.5 font-mono text-[11px] space-y-1">
                  <div className="flex justify-between text-chalk">
                    <span>Added lookalikes: +{lookalikeResult.added_count}</span>
                    <span className="text-win-green tabular">
                      cos={lookalikeResult.avg_cosine_similarity}
                    </span>
                  </div>
                  <div className="text-[10px] text-chalk-dim truncate">
                    Top match:{" "}
                    {lookalikeResult.sample_players
                      ?.slice(0, 3)
                      .map((p: any) => p.gamer_tag)
                      .join(", ")}
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
