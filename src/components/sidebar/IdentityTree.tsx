"use client";

import React from "react";
import { PlayerIdentity } from "@/lib/types";
import { CheckCircle2, ShieldAlert, Link as LinkIcon } from "lucide-react";

interface IdentityTreeProps {
  identities?: PlayerIdentity[];
  masterId: string;
}

export default function IdentityTree({ identities = [], masterId }: IdentityTreeProps) {
  // Keyed to the platforms that actually appear in data/platform_identities.json:
  // BATTLE_NET (all players), STEAM, XBOX_LIVE, PLAYSTATION_NETWORK, KING_MOBILE_ID.
  // The previous map left Battle.net unstyled.
  const PLATFORM_BADGES: Record<string, { bg: string; label: string }> = {
    BATTLE_NET: {
      bg: "bg-sky-950/60 text-sky-400 border-sky-500/30",
      label: "Battle.net",
    },
    KING_MOBILE_ID: {
      bg: "bg-pink-950/60 text-pink-400 border-pink-500/30",
      label: "King Mobile ID",
    },
    PLAYSTATION_NETWORK: {
      bg: "bg-blue-950/60 text-blue-400 border-blue-500/30",
      label: "PlayStation Network",
    },
    XBOX_LIVE: {
      bg: "bg-green-950/60 text-green-400 border-green-500/30",
      label: "Xbox Live",
    },
    STEAM: {
      bg: "bg-slate-800 text-slate-300 border-slate-600",
      label: "Steam",
    },
    TWITCH: {
      bg: "bg-purple-950/60 text-purple-400 border-purple-500/30",
      label: "Twitch",
    },
  };

  const getPlatformBadge = (platform: string) =>
    PLATFORM_BADGES[platform] || {
      bg: "bg-surface-raised text-gray-300 border-surface-border",
      label: platform.replace(/_/g, " "),
    };

  return (
    <div className="space-y-2 font-mono text-xs">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <LinkIcon className="w-3 h-3 text-cyber-cyan" />
          RESOLVED IDENTITY PROVENANCE
        </span>
        <span className="text-neon-green">{identities.length} Linked Nodes</span>
      </div>

      <div className="space-y-1.5">
        {identities.map((id, idx) => {
          const badge = getPlatformBadge(id.platform);
          return (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-surface-raised/70 border border-surface-border"
            >
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                  {badge.label}
                </span>
                <span className="text-gray-200 font-medium">{id.handle}</span>
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" />
                <span className="text-gray-400">{(id.confidence_score * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
