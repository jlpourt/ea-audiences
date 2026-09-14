"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, Loader2 } from "lucide-react";

export type SpannerHealth = {
  ok: boolean;
  database: string;
  playerCount?: number;
  latencyMs: number;
  error?: string;
};

type Phase = "checking" | "live" | "down";

/**
 * Live connection indicator for Cloud Spanner.
 *
 * This replaces the old local/live *toggle*. That control let a presenter pick
 * a data source, which meant the green "Live Spanner" state was an assertion of
 * intent rather than of fact — it stayed green while the app served numbers
 * from a local JSON file. There is now only one source of truth, so the only
 * honest control here is a read-only probe of whether it is reachable.
 *
 * Click to re-check immediately; otherwise it polls quietly.
 */
const POLL_INTERVAL_MS = 30_000;

export default function SpannerStatusPill({ className = "" }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [health, setHealth] = useState<SpannerHealth | null>(null);
  // Guards against a slow in-flight probe resolving after unmount, and against
  // a manual re-check racing the interval.
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const probe = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/health/spanner", { cache: "no-store" });
      const data: SpannerHealth = await res.json();
      if (!mounted.current) return;
      setHealth(data);
      setPhase(data.ok ? "live" : "down");
    } catch (e: any) {
      if (!mounted.current) return;
      setHealth({
        ok: false,
        database: "unknown",
        latencyMs: 0,
        error: e?.message || "health probe failed",
      });
      setPhase("down");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    probe();
    const id = setInterval(probe, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [probe]);

  const label =
    phase === "checking"
      ? "Checking Spanner"
      : phase === "live"
      ? "Live Spanner"
      : "Spanner Unreachable";

  const detail =
    phase === "live" && health
      ? `${health.database} · ${health.playerCount?.toLocaleString() ?? "?"} players · ${health.latencyMs}ms`
      : phase === "down" && health
      ? health.error || "no connection"
      : "probing connection…";

  const tone =
    phase === "live"
      ? "border-emerald-400/30 text-emerald-300"
      : phase === "down"
      ? "border-red-400/40 text-red-300"
      : "border-white/10 text-zinc-400";

  return (
    <button
      type="button"
      onClick={probe}
      title={`${label} — ${detail}\nClick to re-check`}
      aria-label={`${label}. ${detail}. Click to re-check.`}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono
        bg-black/40 backdrop-blur-xl border transition-colors duration-200
        active:scale-[0.97] active:brightness-110 motion-reduce:active:scale-100
        ${tone} ${className}`}
    >
      <span className="relative flex items-center justify-center">
        {phase === "checking" ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : phase === "live" ? (
          <>
            <Cloud className="w-3 h-3 text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping motion-reduce:animate-none" />
          </>
        ) : (
          <CloudOff className="w-3 h-3 text-red-400" />
        )}
      </span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{phase === "live" ? "Spanner" : phase === "down" ? "Down" : "…"}</span>
    </button>
  );
}
