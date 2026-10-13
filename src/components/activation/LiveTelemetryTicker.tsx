"use client";

import React, { useState, useEffect, useRef } from "react";
import { Radio, Zap, Clock, Activity, Flame, ShieldAlert } from "lucide-react";
import { TabularNumber } from "@/components/brand/TabularNumber";
import { TelemetryTriggerItem } from "@/app/api/simulation/triggers/route";

export interface LiveTelemetryTickerProps {
  onSelectPlayer?: (playerId: string) => void;
  className?: string;
}

export function LiveTelemetryTicker({ onSelectPlayer, className = "" }: LiveTelemetryTickerProps) {
  const [events, setEvents] = useState<TelemetryTriggerItem[]>([]);
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);
  const [step, setStep] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Fetch telemetry stream every 2.4s
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fetchBatch = async () => {
      try {
        const res = await fetch(`/api/simulation/triggers?step=${step}`);
        if (res.ok) {
          const data = await res.json();
          if (data.telemetryItems && data.telemetryItems.length > 0) {
            setEvents((prev) => {
              // Prepend new items, deduplicate by event_id, keep top 10
              const combined = [...data.telemetryItems, ...prev];
              const seen = new Set<string>();
              const deduplicated: TelemetryTriggerItem[] = [];
              for (const item of combined) {
                if (!seen.has(item.event_id)) {
                  seen.add(item.event_id);
                  deduplicated.push(item);
                  if (deduplicated.length >= 10) break;
                }
              }
              return deduplicated;
            });
            // Trigger 120ms opacity pulse on the newest item
            setPulseIndex(0);
            setTimeout(() => setPulseIndex(null), 120);
          }
        }
      } catch (err) {
        console.warn("[LiveTelemetryTicker] fetch error:", err);
      }
      setStep((s) => s + 1);
    };

    if (isActive) {
      fetchBatch();
      timer = setInterval(fetchBatch, 2400);
    }
    return () => clearInterval(timer);
  }, [step, isActive]);

  const handleRowClick = (item: TelemetryTriggerItem) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("courtside:select-player", {
          detail: { playerId: item.player_id, gamerTag: item.gamer_tag },
        })
      );
    }
    if (onSelectPlayer) {
      onSelectPlayer(item.player_id);
    }
  };

  const currentItem = events[0];

  return (
    <div
      className={`h-11 w-full bg-[#0A0A0C]/95 border-t border-white/[0.08] px-4 flex items-center justify-between text-xs backdrop-blur-md select-none z-30 font-sans ${className}`}
    >
      {/* Left: Live Clocks & Countdowns */}
      <div className="flex items-center gap-4 shrink-0 pr-4 border-r border-white/[0.08]">
        {/* Season 1 Countdown */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#19C37D] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#19C37D]" />
          </span>
          <span className="font-semibold text-white tracking-tight">NBA 2K27</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#E4002B]/20 text-[#E4002B] font-mono font-medium">
            Season 1 · 14d left · Oct 16
          </span>
        </div>

        {/* GTA VI Launch Countdown */}
        <div className="hidden sm:flex items-center gap-1.5 text-white/70">
          <Clock className="w-3.5 h-3.5 text-[#FCAF17]" />
          <span className="text-[11px] font-mono text-[#FCAF17] font-medium">
            GTA VI · T−48d · Nov 19
          </span>
        </div>
      </div>

      {/* Middle: Active High-Frequency Telemetry Event with 120ms Opacity Pulse (Zero Row Sliding) */}
      <div className="flex-1 px-4 overflow-hidden">
        {currentItem ? (
          <div
            onClick={() => handleRowClick(currentItem)}
            className={`flex items-center gap-3 cursor-pointer group transition-opacity duration-120 ${
              pulseIndex === 0 ? "opacity-100 scale-[1.002]" : "opacity-85 hover:opacity-100"
            }`}
          >
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase bg-white/[0.06] text-white/90 group-hover:bg-[#E4002B]/20 group-hover:text-[#E4002B] transition-colors">
              {currentItem.event_label}
            </span>

            <span className="font-semibold text-white group-hover:text-[#E4002B] transition-colors">
              {currentItem.gamer_tag}
            </span>

            <span className="text-white/40 text-[11px] font-mono">
              {currentItem.dma_market}
              {currentItem.myplayer_ovr ? ` · ${currentItem.myplayer_ovr} OVR` : ""}
            </span>

            <span className="text-white/30 text-[10px]">→</span>

            <span className="text-[#F5B400] font-medium text-[11px]">
              {currentItem.offer_title} (${currentItem.price_usd})
            </span>

            <span className="text-[10px] text-white/50 truncate max-w-xs hidden md:inline">
              "{currentItem.reason}"
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-white/40 text-[11px]">
            <Activity className="w-3.5 h-3.5 animate-pulse text-[#19C37D]" />
            <span>Streaming Take-Two live telemetry triggers from 2K Telemetry...</span>
          </div>
        )}
      </div>

      {/* Right: Live Stream Pulse Status Pill */}
      <div className="flex items-center gap-2.5 shrink-0 pl-4 border-l border-white/[0.08]">
        <button
          onClick={() => setIsActive(!isActive)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-colors ${
            isActive
              ? "bg-[#19C37D]/15 text-[#19C37D] border border-[#19C37D]/30"
              : "bg-white/[0.06] text-white/40 border border-white/10"
          }`}
        >
          <Radio className={`w-3 h-3 ${isActive ? "text-[#19C37D] animate-pulse" : "text-white/40"}`} />
          <span>{isActive ? "LIVE TELEMETRY" : "PAUSED"}</span>
        </button>
      </div>
    </div>
  );
}

export default LiveTelemetryTicker;
