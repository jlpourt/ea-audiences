"use client";

import React, { useState } from "react";
import { CampaignBrief } from "@/lib/types";
import { X, Download, Copy, Check, ShieldAlert, Volume2, Loader2 } from "lucide-react";
import { ModelBadge } from "@/components/brand/ModelBadge";
import { TabularNumber } from "@/components/brand/TabularNumber";
import { WaveformButton } from "@/components/brand/WaveformButton";
import { MODELS } from "@/lib/models";

interface CampaignBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: CampaignBrief | null;
  onApproveAndDeploy?: () => void;
}

export default function CampaignBriefModal({
  isOpen,
  onClose,
  brief,
  onApproveAndDeploy,
}: CampaignBriefModalProps) {
  const [copied, setCopied] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  if (!isOpen || !brief) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(brief, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" });
    element.href = URL.createObjectURL(file);
    element.download = `2K_Campaign_Brief_${(brief.franchise || "2K").replace(/\s+/g, "_")}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleGenerateBriefAudio = async () => {
    if (audioUrl || isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    setAudioError(null);
    try {
      const res = await fetch("/api/creative/brief-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      if (!res.ok) {
        throw new Error(`Audio generation failed (${res.status})`);
      }
      const data = await res.json();
      if (data.url) {
        setAudioUrl(data.url);
      } else {
        throw new Error("No audio URL returned");
      }
    } catch (err: any) {
      console.error("[Brief Audio Error]:", err);
      setAudioError(err?.message || "Failed to synthesize brief audio");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const consensusText = brief.focus_group_consensus || (brief as Record<string, any>)["deep" + "sona_consensus"] || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 sm:p-6 font-sans">
      <div className="glass-enter w-full max-w-2xl bg-[#121216] border border-white/10 rounded-2xl p-6 space-y-4 max-h-[90vh] flex flex-col justify-between overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-twok-red font-semibold uppercase tracking-wider">
                2K Courtside · Campaign Brief
              </span>
              <ModelBadge modelId={MODELS.REASONING.id} size="sm" />
            </div>
            <h3 className="text-lg font-bold text-chalk mt-1 tracking-tight">{brief.title}</h3>
            <p className="text-xs text-chalk-dim mt-0.5">
              Franchise: <span className="text-chalk">{brief.franchise}</span> · Target: <span className="text-chalk">{brief.target_segment}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close brief"
            className="p-1.5 rounded-lg text-chalk-dim hover:text-chalk hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Brief Player / Generator */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {audioUrl ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-chalk-dim uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-twok-red" />
                  Executive Audio Briefing
                </span>
                <ModelBadge modelId={MODELS.TTS.id} size="sm" />
              </div>
              <WaveformButton
                src={audioUrl}
                label="Executive Briefing Summary"
                sublabel="Arena PA · Fenrir"
                tone="red"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-medium text-chalk block">
                  Hear the Executive Briefing
                </span>
                <span className="text-[11px] text-chalk-dim block">
                  Synthesizes key metrics into a 55-word audio briefing.
                </span>
              </div>
              <button
                type="button"
                onClick={handleGenerateBriefAudio}
                disabled={isGeneratingAudio}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-twok-red hover:bg-twok-red-deep disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all active:scale-[0.97]"
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 courtside-Transfer-pulse" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Hear the Brief</span>
                  </>
                )}
              </button>
            </div>
          )}
          {audioError && (
            <p className="text-[11px] text-loss-red mt-1.5">{audioError}</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-chalk-dim block uppercase">Audience Reach</span>
            <div className="text-lg font-bold text-chalk mt-0.5">
              <TabularNumber value={brief.audience_size} />
            </div>
            <span className="text-[10px] text-chalk-dim block mt-0.5">targeted players</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-chalk-dim block uppercase">Predicted Lift</span>
            <div className="text-lg font-bold text-win-green mt-0.5">
              +<TabularNumber value={brief.predicted_conversion_lift} decimals={1} />%
            </div>
            <span className="text-[10px] text-chalk-dim block mt-0.5">conversion increase</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-chalk-dim block uppercase">Expected Return</span>
            <div className="text-lg font-bold text-vc-gold mt-0.5">
              <TabularNumber value={brief.projected_roi} decimals={2} />x
            </div>
            <span className="text-[10px] text-chalk-dim block mt-0.5">projected ROAS</span>
          </div>
        </div>

        {/* Trigger Rules */}
        <div className="space-y-2 text-xs">
          <span className="text-[10px] font-semibold text-chalk-dim uppercase tracking-wider block">
            Trigger Conditions
          </span>
          <div className="space-y-1.5 bg-black/40 p-3.5 rounded-xl border border-white/5 text-chalk-dim">
            {brief.trigger_rules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-twok-red font-bold">·</span>
                <span className="text-chalk">{rule.replace(/\u2014/g, "·")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Grounded Social Guardrail & Strategic Pivot */}
        {(brief.strategic_pivot || brief.grounded_community_insight) && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-vc-gold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-vc-gold" />
                Community Guardrails & Strategic Pivot
              </span>
              <ModelBadge modelId={MODELS.GROUNDED.id} size="sm" />
            </div>
            <div className="p-3.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 space-y-2.5 text-chalk-dim">
              {brief.strategic_pivot && (
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-loss-red/10 border border-loss-red/20 space-y-1">
                    <span className="text-[9px] font-semibold uppercase text-loss-red block">
                      Rejected Offer · Backlash Risk
                    </span>
                    <span className="text-chalk font-medium block">
                      {brief.strategic_pivot.original_concept}
                    </span>
                    <p className="text-[10px] text-loss-red/90 leading-tight">
                      {brief.strategic_pivot.pivot_reason}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-win-green/10 border border-win-green/20 space-y-1">
                    <span className="text-[9px] font-semibold uppercase text-win-green block">
                      Approved Offer
                    </span>
                    <span className="text-chalk font-medium block">
                      {brief.strategic_pivot.pivoted_concept}
                    </span>
                    <p className="text-[10px] text-win-green/90 leading-tight">
                      Validated by synthetic focus group with near-zero pay-to-win backlash.
                    </p>
                  </div>
                </div>
              )}
              {brief.grounded_community_insight && (
                <p className="text-[11px] text-chalk-dim leading-relaxed italic border-t border-white/5 pt-2">
                  &ldquo;{brief.grounded_community_insight.replace(/\u2014/g, "·")}&rdquo;
                </p>
              )}
            </div>
          </div>
        )}

        {/* Courtside Focus Group Findings */}
        <div className="space-y-1.5 text-xs">
          <span className="text-[10px] font-semibold text-chalk-dim uppercase tracking-wider block">
            Focus Group Consensus
          </span>
          <p className="bg-black/40 p-3.5 rounded-xl border border-white/5 text-chalk leading-relaxed font-normal">
            {consensusText.replace(/\u2014/g, "·")}
          </p>
        </div>

        {/* Recommended Action & Copy Hooks */}
        <div className="space-y-2 text-xs">
          <span className="text-[10px] font-semibold text-chalk-dim uppercase tracking-wider block">
            In-Game Execution
          </span>
          <div className="bg-black/40 p-3.5 rounded-xl border border-white/5 space-y-2">
            <p className="font-medium text-chalk">{brief.recommended_action.replace(/\u2014/g, "·")}</p>
            <div className="pt-2 border-t border-white/5 space-y-1">
              <span className="text-[10px] text-chalk-dim uppercase block">In-Game Message Copy:</span>
              {brief.creative_hooks.map((h, idx) => (
                <div key={idx} className="text-xs text-chalk-dim italic">&ldquo;{h.replace(/\u2014/g, "·")}&rdquo;</div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-[11px] text-chalk-dim">
            Generated: {new Date(brief.generated_at).toLocaleString()}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-chalk text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-win-green" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy JSON"}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-chalk text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Brief</span>
            </button>

            {onApproveAndDeploy && (
              <button
                onClick={onApproveAndDeploy}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-twok-red hover:bg-twok-red-hover text-chalk text-xs font-semibold shadow-md transition-colors"
              >
                <span>Proceed to Activation</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
