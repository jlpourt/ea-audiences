"use client";

import React from "react";
import { PlayerIdentity } from "@/lib/types";
import { CheckCircle2, Link as LinkIcon } from "lucide-react";

interface IdentityTreeProps {
  identities?: PlayerIdentity[];
  masterId: string;
}

const PLATFORM_BADGES: Record<string, { bg: string; label: string }> = {
  "2K Account": {
    bg: "bg-twok-red/15 text-twok-red border-twok-red/35",
    label: "2K Account",
  },
  "PlayStation Network": {
    bg: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    label: "PlayStation Network",
  },
  "Xbox Live": {
    bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    label: "Xbox Live",
  },
  Steam: {
    bg: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    label: "Steam",
  },
  "Nintendo Switch 2": {
    bg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    label: "Nintendo Switch 2",
  },
  "NBA 2K Mobile ID": {
    bg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    label: "NBA 2K Mobile ID",
  },
  "My2K Companion": {
    bg: "bg-vc-gold/15 text-vc-gold border-vc-gold/35",
    label: "My2K Companion",
  },
};

function normalize2KPlatform(platform: string): string {
  const lower = platform.toLowerCase();
  if (lower.includes("2k") && lower.includes("mobile")) return "NBA 2K Mobile ID";
  if (lower.includes("companion") || lower.includes("my2k")) return "My2K Companion";
  if (lower.includes("playstation") || lower.includes("psn") || lower.includes("ps5")) {
    return "PlayStation Network";
  }
  if (lower.includes("xbox")) return "Xbox Live";
  if (lower.includes("steam") || lower.includes("pc")) return "Steam";
  if (lower.includes("switch") || lower.includes("nintendo")) return "Nintendo Switch 2";
  return "2K Account";
}

export default function IdentityTree({ identities = [], masterId }: IdentityTreeProps) {
  const getPlatformBadge = (platform: string) => {
    const cleanPlatform = normalize2KPlatform(platform);
    return (
      PLATFORM_BADGES[cleanPlatform] || {
        bg: "bg-white/[0.05] text-white border-white/10",
        label: cleanPlatform,
      }
    );
  };

  return (
    <div className="space-y-2 font-mono text-xs">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span className="flex items-center gap-1.5 uppercase tracking-wider">
          <LinkIcon className="h-3 w-3 text-twok-red" />
          2K Unified Identity Spine ({masterId})
        </span>
        <span className="tabular text-emerald-400">{identities.length} linked</span>
      </div>

      <div className="space-y-1.5">
        {identities.map((id, idx) => {
          const badge = getPlatformBadge(id.platform);
          const cleanHandle = (id.handle || masterId).replace(/_(RS|ZN)$/i, "_2K");
          return (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.bg}`}
                >
                  {badge.label}
                </span>
                <span className="truncate text-white font-medium">{cleanHandle}</span>
              </div>

              <div className="flex items-center gap-1 text-[11px] tabular">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-gray-400">
                  {(id.confidence_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
