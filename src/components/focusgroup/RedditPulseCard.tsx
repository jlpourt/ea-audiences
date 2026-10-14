"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { TabularNumber } from "@/components/brand/TabularNumber";
import type { RedditEchoItem } from "@/lib/types";

interface RedditItem {
  subreddit: string;
  title: string;
  url?: string;
  sentiment: "BULLISH" | "MIXED" | "BACKLASH";
  score: number;
  snippet: string;
  flair?: string;
  comment_count?: number;
  swarm_echo_count?: number;
  r2_flips_driven?: number;
}

interface RedditPulseData {
  items: RedditItem[];
  model_used: string;
  citations: Array<{ title: string; uri: string; domain: string }>;
  generated_at: string;
  cached?: boolean;
}

export interface RedditPulseCardProps {
  echoThreads?: RedditEchoItem[];
}

export function RedditPulseCard({ echoThreads }: RedditPulseCardProps = {}) {
  const [data, setData] = useState<RedditPulseData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubFilter, setActiveSubFilter] = useState<string>("ALL");

  const fetchPulse = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social/reddit-pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`Community pulse unavailable (${res.status})`);
      }
      const json: RedditPulseData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Unable to load community threads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPulse();
  }, []);

  const sentimentDot = (s: string) => {
    if (s === "BULLISH") return "bg-win-green";
    if (s === "BACKLASH") return "bg-loss-red";
    return "bg-vc-gold";
  };

  const sentimentText = (s: string) => {
    if (s === "BULLISH") return "text-win-green";
    if (s === "BACKLASH") return "text-loss-red";
    return "text-vc-gold";
  };

  const allItems: RedditItem[] = echoThreads && echoThreads.length > 0 ? echoThreads : data?.items || [];
  const filteredItems = allItems.filter((item) => {
    if (activeSubFilter === "ALL") return true;
    const sub = (item.subreddit || "").toLowerCase();
    if (activeSubFilter === "2K_CATALOG") {
      return sub.includes("wwe") || sub.includes("pga") || sub.includes("borderlands");
    }
    return sub === activeSubFilter.toLowerCase();
  });

  const subFilters = [
    { id: "ALL", label: `All (${allItems.length || 0})` },
    { id: "r/NBA2K", label: "r/NBA2K" },
    { id: "r/MyTEAM", label: "r/MyTEAM" },
    { id: "r/NBA2kTeamUp", label: "r/NBA2kTeamUp" },
    { id: "2K_CATALOG", label: "WWE · PGA · BL4" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 flex flex-col min-h-0 flex-1 font-sans">
      <div className="flex items-center justify-between pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold text-white/90 tracking-tight shrink-0">
            Community Pulse
          </span>
          <span className="text-[9.5px] text-white/40 font-mono truncate">
            r/NBA2K · r/MyTEAM · r/NBA2kTeamUp · 2K Catalog
          </span>
        </div>
        <button
          type="button"
          onClick={fetchPulse}
          disabled={isLoading}
          title="Refresh community threads"
          className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all disabled:opacity-40 shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "opacity-40" : ""}`} />
        </button>
      </div>

      {allItems.length > 0 && (
        <div className="flex items-center gap-1 pb-2 overflow-x-auto no-scrollbar">
          {subFilters.map((f) => {
            const active = activeSubFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveSubFilter(f.id)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors shrink-0 border ${
                  active
                    ? "bg-white/[0.12] text-white border-white/25 font-semibold"
                    : "bg-white/[0.02] text-white/45 border-white/[0.06] hover:text-white/75"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {isLoading && !data && (
        <div className="space-y-2 py-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg bg-white/[0.025] border border-white/[0.04] p-2.5 space-y-1.5 animate-pulse"
            >
              <div className="h-2.5 w-24 rounded bg-white/10" />
              <div className="h-3 w-full rounded bg-white/[0.07]" />
            </div>
          ))}
        </div>
      )}

      {error && !data && (
        <div className="rounded-lg bg-loss-red/10 border border-loss-red/20 p-2.5 text-[11px] text-loss-red">
          {error}
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="space-y-1.5 overflow-y-auto pr-0.5 flex-1 min-h-0 max-h-[260px]">
          {filteredItems.map((item, idx) => {
            const matchedEcho =
              echoThreads?.find(
                (t) =>
                  t.title.toLowerCase() === item.title.toLowerCase() ||
                  (t.url && item.url && t.url === item.url)
              ) || echoThreads?.[idx];
            const echoCount = item.swarm_echo_count ?? matchedEcho?.swarm_echo_count;
            const flipsDriven = item.r2_flips_driven ?? matchedEcho?.r2_flips_driven;
            const flair = item.flair ?? matchedEcho?.flair;
            const commentCount = item.comment_count ?? matchedEcho?.comment_count;
            const hasEchoBadge =
              (typeof echoCount === "number" && echoCount > 0) ||
              (typeof flipsDriven === "number" && flipsDriven > 0);

            return (
              <a
                key={`${item.subreddit}-${idx}`}
                href={item.url || `https://reddit.com/${item.subreddit || "r/NBA2K"}`}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-lg border border-white/[0.05] bg-black/30 px-2.5 py-2 hover:bg-white/[0.04] hover:border-white/[0.12] active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white/65 font-semibold truncate">{item.subreddit}</span>
                    {flair && (
                      <span className="px-1 py-0.2 rounded bg-white/[0.05] border border-white/[0.08] text-[8.5px] text-white/50 truncate">
                        {flair}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasEchoBadge && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-400/10 border border-cyan-400/20 text-cyan-400/90 text-[9px] font-mono font-semibold tabular">
                        {flipsDriven && flipsDriven > 0
                          ? `${echoCount || flipsDriven} echoed · +${flipsDriven} flips`
                          : `${echoCount} echoed`}
                      </span>
                    )}
                    <span className="text-white/40 tabular">
                      <TabularNumber value={item.score || 1200} /> pts
                    </span>
                    {typeof commentCount === "number" && commentCount > 0 && (
                      <span className="text-white/30 tabular text-[9px]">
                        · {commentCount}c
                      </span>
                    )}
                    <span className="text-white/20">·</span>
                    <span className="flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${sentimentDot(item.sentiment)}`}
                      />
                      <span
                        className={`text-[9px] font-semibold ${sentimentText(item.sentiment)}`}
                      >
                        {item.sentiment}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-medium text-white/90 group-hover:text-white line-clamp-1">
                    {item.title}
                  </span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 text-white/30 group-hover:text-white/70 transition-colors" />
                </div>
                <p className="mt-0.5 text-[10px] text-white/50 line-clamp-1 leading-snug">
                  {item.snippet}
                </p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
