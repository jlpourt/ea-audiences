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

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 flex flex-col min-h-0 flex-1 font-sans">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white/90 tracking-tight">
            Community Pulse
          </span>
          <span className="text-[10px] text-white/40 font-mono">
            r/NBA2K · r/MyTEAM
          </span>
        </div>
        <button
          type="button"
          onClick={fetchPulse}
          disabled={isLoading}
          title="Refresh community threads"
          className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "opacity-40" : ""}`} />
        </button>
      </div>

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

      {(data?.items || (echoThreads && echoThreads.length > 0)) && (
        <div className="space-y-1.5 overflow-y-auto pr-0.5 flex-1 min-h-0">
          {(data?.items || echoThreads || []).slice(0, 3).map((item, idx) => {
            const matchedEcho =
              echoThreads?.find(
                (t) =>
                  t.title.toLowerCase() === item.title.toLowerCase() ||
                  (t.url && item.url && t.url === item.url)
              ) || echoThreads?.[idx];
            const echoCount = item.swarm_echo_count ?? matchedEcho?.swarm_echo_count;
            const flipsDriven = item.r2_flips_driven ?? matchedEcho?.r2_flips_driven;
            const hasEchoBadge =
              (typeof echoCount === "number" && echoCount > 0) ||
              (typeof flipsDriven === "number" && flipsDriven > 0);

            return (
              <a
                key={idx}
                href={item.url || "https://reddit.com/r/NBA2K"}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-lg border border-white/[0.05] bg-black/30 px-2.5 py-2 hover:bg-white/[0.04] hover:border-white/[0.12] active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="text-white/45 truncate">{item.subreddit}</span>
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
