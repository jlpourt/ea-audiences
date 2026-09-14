"use client";

import React from "react";
import { DeepSonaReaction } from "@/lib/types";

interface PersonaDebateFeedProps {
  reactions: DeepSonaReaction[];
}

export default function PersonaDebateFeed({ reactions }: PersonaDebateFeedProps) {
  const getArchetypeMeta = (archetype: string) => {
    switch (archetype) {
      case "COMPETITIVE_GRINDER":
        return {
          name: "Ranked_Grind_Alt (Competitive Grinder)",
          avatar: "⚔️",
          color: "text-alert-red border-alert-red/30 bg-alert-red/10",
        };
      case "LORE_SEEKER":
        return {
          name: "Lore_Archivist (Campaign & Story Purist)",
          avatar: "📋",
          color: "text-cyber-cyan border-cyber-cyan/30 bg-cyber-cyan/10",
        };
      case "CASUAL_SOCIALIZER":
        return {
          name: "Friday_Night_Stack (Social Squad Player)",
          avatar: "⚽",
          color: "text-neon-green border-neon-green/30 bg-neon-green/10",
        };
      case "BLACKCELL_WHALE":
        return {
          name: "Vault_Collector_01 (BlackCell Pass Whale)",
          avatar: "💎",
          color: "text-hud-gold border-hud-gold/30 bg-hud-gold/10",
        };
      default:
        return {
          name: archetype,
          avatar: "🎮",
          color: "text-gray-300 border-surface-border bg-surface-raised",
        };
    }
  };

  return (
    <div className="space-y-3 font-mono text-xs max-h-[340px] overflow-y-auto pr-1">
      {reactions.map((r, idx) => {
        const meta = getArchetypeMeta(r.archetype as string);
        return (
          <div
            key={idx}
            className="p-3.5 rounded-xl bg-surface-raised border border-surface-border space-y-2 hover:border-gray-500 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{meta.avatar}</span>
                <span className="font-bold text-white text-xs">{meta.name}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.color}`}>
                  {r.final_fsm_state}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-hud-gold font-bold">WTP: ${r.willingness_to_pay_usd.toFixed(2)}</span>
                <span className="text-gray-400">Authenticity: {(r.authenticity_rating * 100).toFixed(0)}%</span>
              </div>
            </div>

            <p className="text-gray-300 font-sans text-xs italic bg-surface/60 p-2.5 rounded-lg border border-surface-border">
              &ldquo;{r.verbatim_quote}&rdquo;
            </p>

            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
              <span>Churn Risk Score: <strong className="text-ea-orange">{(r.churn_risk_score * 100).toFixed(0)}%</strong></span>
              <span>Sentiment Score: <strong className={r.sentiment_score > 0 ? "text-neon-green" : "text-alert-red"}>{(r.sentiment_score * 100).toFixed(0)}</strong></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
