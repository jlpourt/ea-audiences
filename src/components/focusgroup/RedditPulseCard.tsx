"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { TabularNumber } from "@/components/brand/TabularNumber";

interface RedditItem {
  subreddit: string;
  title: string;
  url: string;
  sentiment: "BULLISH" | "MIXED" | "BACKLASH";
  score: number;
  snippet: string;
}

interface RedditPulseData {
  items: RedditItem[];
  model_used: string;
  citations: Array<{ title: string; uri: string; domain: string }>;
  generated_at: string;
  cached?: boolean;
}

export function RedditPulseCard() {
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
        throw new Error(`Reddit pulse unavailable (${res.status})`);
      }
      const json: RedditPulseData = await res.json();
      setData(json);
    } catch (err: any) {
      console.warn("[Reddit Pulse]", err);
      setError(err?.message || "Failed to load live Reddit pulse");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPulse();
  }, []);

  const sentimentColor = (s: string) => {
    if (s === "BULLISH") return "bg-win-green/15 text-win-green border-win-green/30";
    if (s === "BACKLASH") return "bg-loss-red/15 text-loss-red border-loss-red/30";
    return "bg-vc-gold/15 text-vc-gold border-vc-gold/30";
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-twok-red" />
          <span className="text-[11px] font-semibold text-chalk uppercase tracking-wider">
            LIVE REDDIT PULSE
          </span>
          <span className="text-[10px] text-chalk-dim font-mono">
            r/NBA2K · r/MyTEAM
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchPulse}
            disabled={isLoading}
            title="Refresh Reddit pulse"
            className="p-1 rounded text-chalk-dim hover:text-chalk hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "courtside-Transfer-pulse" : ""}`} />
          </button>
        </div>
      </div>

      {isLoading && !data && (
        <div className="flex items-center justify-center py-6 gap-2 text-chalk-dim text-xs">
          <Loader2 className="w-3.5 h-3.5 courtside-Transfer-pulse text-twok-red" />
          <span>Grounding over reddit.com...</span>
        </div>
      )}

      {error && !data && (
        <div className="rounded-lg bg-loss-red/10 border border-loss-red/20 p-2.5 text-[11px] text-loss-red">
          {error}
        </div>
      )}

      {data && data.items && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {data.items.slice(0, 4).map((item, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/5 bg-black/40 p-2 text-xs space-y-1 hover:border-white/15 transition-colors"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-mono text-chalk-dim">
                  {item.subreddit}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${sentimentColor(
                    item.sentiment
                  )}`}
                >
                  {item.sentiment}
                </span>
              </div>
              <a
                href={item.url || "https://reddit.com/r/NBA2K"}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-chalk hover:text-twok-red transition-colors line-clamp-1 flex items-center gap-1"
              >
                <span>{item.title}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
              </a>
              <p className="text-[10px] text-chalk-dim line-clamp-2 leading-relaxed italic">
                &ldquo;{item.snippet}&rdquo;
              </p>
              <div className="text-[9px] text-chalk-dim/70 font-mono flex items-center justify-between pt-0.5">
                <span>
                  <TabularNumber value={item.score || 1200} /> upvotes
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
