"use client";

import React, { useState } from "react";
import { CampaignBrief } from "@/lib/types";
import { X, Download, Copy, Check } from "lucide-react";

interface CampaignBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: CampaignBrief | null;
}

export default function CampaignBriefModal({
  isOpen,
  onClose,
  brief,
}: CampaignBriefModalProps) {
  const [copied, setCopied] = useState(false);

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
    element.download = `ABK_Campaign_Brief_${brief.franchise.replace(/\s+/g, "_")}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-6 animate-fade-in font-sans">
      <div className="w-full max-w-2xl bg-[#0E1015]/95 border border-white/10 rounded-3xl p-6 space-y-4 max-h-[88vh] flex flex-col justify-between overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div>
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
              Campaign Plan Summary
            </span>
            <h3 className="text-base font-semibold text-white mt-0.5 tracking-tight">{brief.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Franchise: {brief.franchise} • Target Group: {brief.target_segment}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-gray-400 block uppercase">Audience Reach</span>
            <span className="text-base font-semibold text-white font-mono mt-0.5 block">
              {brief.audience_size.toLocaleString()}
            </span>
            <span className="text-[10px] text-gray-500 block mt-0.5">targeted players</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-gray-400 block uppercase">Sales Boost</span>
            <span className="text-base font-semibold text-emerald-400 font-mono mt-0.5 block">
              +{brief.predicted_conversion_lift}%
            </span>
            <span className="text-[10px] text-gray-500 block mt-0.5">predicted increase</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-gray-400 block uppercase">Return on Spend</span>
            <span className="text-base font-semibold text-amber-300 font-mono mt-0.5 block">
              {brief.projected_roi}x
            </span>
            <span className="text-[10px] text-gray-500 block mt-0.5">expected ROI</span>
          </div>
        </div>

        {/* Trigger Rules */}
        <div className="space-y-2 text-xs">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
            When to Show This Offer
          </span>
          <div className="space-y-1.5 bg-black/40 p-3.5 rounded-2xl border border-white/5 text-gray-300">
            {brief.trigger_rules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DeepSona Consensus */}
        <div className="space-y-1.5 text-xs">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
            Player Focus Group Findings
          </span>
          <p className="bg-black/40 p-3.5 rounded-2xl border border-white/5 text-gray-300 leading-relaxed font-normal">
            {brief.deepsona_consensus}
          </p>
        </div>

        {/* Recommended Copy Hooks */}
        <div className="space-y-2 text-xs">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
            Recommended In-Game Action
          </span>
          <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 space-y-2 text-gray-300">
            <p className="font-medium text-white">{brief.recommended_action}</p>
            <div className="pt-2 border-t border-white/5 space-y-1">
              <span className="text-[10px] text-gray-500 uppercase block">In-Game Message Text:</span>
              {brief.creative_hooks.map((h, idx) => (
                <div key={idx} className="text-xs text-gray-300 italic">&ldquo;{h}&rdquo;</div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3.5">
          <div className="text-[11px] text-gray-500">
            Generated: {new Date(brief.generated_at).toLocaleString()}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-medium transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy JSON"}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-semibold shadow-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Brief</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
