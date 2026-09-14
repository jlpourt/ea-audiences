"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, FastForward, RotateCcw, Activity, Zap, AlertTriangle } from "lucide-react";
import { SituationalTrigger } from "@/lib/types";

interface SimulationClockProps {
  onTriggerFired: (triggers: SituationalTrigger[], streams: { playerId: string; offerId: string }[]) => void;
}

export default function SimulationClock({ onTriggerFired }: SimulationClockProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [step, setStep] = useState<number>(0);
  const [currentTimestamp, setCurrentTimestamp] = useState<string>("2026-08-09T18:00:00Z");
  const [recentTriggers, setRecentTriggers] = useState<SituationalTrigger[]>([]);
  const [totalEventsEvaluated, setTotalEventsEvaluated] = useState<number>(0);

  // Simulation tick loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/simulation/triggers?step=${step}`);
          if (res.ok) {
            const data = await res.json();
            setCurrentTimestamp(data.currentTimestamp);
            setTotalEventsEvaluated((prev) => prev + data.batchEventsEvaluated);

            if (data.triggers && data.triggers.length > 0) {
              setRecentTriggers((prev) => [...data.triggers, ...prev].slice(0, 5));
              onTriggerFired(data.triggers, data.activeStreams || []);
            }
          }
        } catch (e) {
          console.error("Simulation tick error:", e);
        }
        setStep((prev) => prev + 1);
      }, 1500 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, step, onTriggerFired]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const handleStep = async () => {
    const nextStep = step + 1;
    setStep(nextStep);
    try {
      const res = await fetch(`/api/simulation/triggers?step=${nextStep}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentTimestamp(data.currentTimestamp);
        setTotalEventsEvaluated((prev) => prev + data.batchEventsEvaluated);
        if (data.triggers && data.triggers.length > 0) {
          setRecentTriggers((prev) => [...data.triggers, ...prev].slice(0, 5));
          onTriggerFired(data.triggers, data.activeStreams || []);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setStep(0);
    setRecentTriggers([]);
    setTotalEventsEvaluated(0);
  };

  return (
    <div className="absolute top-4 right-6 z-20 flex flex-col items-end gap-2">
      {/* Playback Controls HUD */}
      <div className="flex items-center gap-3 bg-surface/90 backdrop-blur-md px-4 py-2 rounded-xl border border-surface-border shadow-xl">
        <div className="flex items-center gap-2 border-r border-surface-border pr-3">
          <button
            onClick={togglePlay}
            className={`p-2 rounded-lg text-white font-bold transition-all ${
              isPlaying
                ? "bg-alert-red shadow-neon-red"
                : "bg-ea-orange shadow-neon-orange hover:bg-ea-orange/80"
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={handleStep}
            disabled={isPlaying}
            className="p-2 rounded-lg bg-surface-raised text-gray-300 hover:text-white hover:bg-surface-border disabled:opacity-40"
            title="Step Forward (1 Tick)"
          >
            <FastForward className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg bg-surface-raised text-gray-400 hover:text-white hover:bg-surface-border"
            title="Reset Simulation Clock"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${
                speed === s
                  ? "bg-cyber-cyan text-background shadow-neon-cyan"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Live Simulation Timestamp */}
        <div className="border-l border-surface-border pl-3 flex flex-col text-right font-mono">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest flex items-center gap-1 justify-end">
            <Activity className="w-3 h-3 text-neon-green animate-pulse" /> SIMULATION CLOCK
          </span>
          <span className="text-xs text-cyber-cyan font-bold">
            {new Date(currentTimestamp).toLocaleDateString()} {new Date(currentTimestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Trigger Live Notification Ticker */}
      {recentTriggers.length > 0 && (
        <div className="w-80 bg-surface/95 backdrop-blur-md p-3 rounded-xl border border-alert-red/40 shadow-neon-red animate-bounce-short">
          <div className="flex items-center justify-between text-xs font-bold text-alert-red mb-1">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-alert-red animate-pulse" />
              SITUATIONAL TRIGGER ACTIVE
            </span>
            <span className="text-[10px] text-gray-400 font-mono">Loss Streak: {recentTriggers[0].loss_streak}</span>
          </div>
          <div className="text-xs text-white font-medium">{recentTriggers[0].player_name}</div>
          <div className="text-[11px] text-gray-300 mt-1 flex items-center justify-between">
            <span className="text-cyber-cyan">{recentTriggers[0].offer_title}</span>
            <span className="bg-alert-red/20 text-alert-red px-1.5 py-0.5 rounded text-[10px] font-bold">
              -{recentTriggers[0].discount_percent}% OFF
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
