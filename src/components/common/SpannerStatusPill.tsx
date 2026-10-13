"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export type SpannerHealth = {
  ok: boolean;
  database: string;
  graph?: string;
  playerCount?: number;
  latencyMs?: number;
  graphLatencyMs?: number;
  probe?: { ok?: boolean; latencyMs?: number; error?: string };
  error?: string;
};

type Phase = "checking" | "live" | "down";

const POLL_INTERVAL_MS = 30_000;

export default function SpannerStatusPill({ className = "" }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [health, setHealth] = useState<SpannerHealth | null>(null);
  const [refreshPulse, setRefreshPulse] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const probe = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshPulse(true);
    setTimeout(() => {
      if (mounted.current) setRefreshPulse(false);
    }, 140);

    try {
      const res = await fetch("/api/health/spanner", { cache: "no-store" });
      const data: SpannerHealth = await res.json();
      if (!mounted.current) return;
      const latency =
        data?.graphLatencyMs ?? data?.probe?.latencyMs ?? data?.latencyMs ?? 19;
      setHealth({ ...data, latencyMs: latency });
      setPhase(data.ok ? "live" : "down");
    } catch (e: any) {
      if (!mounted.current) return;
      setHealth({
        ok: false,
        database: "twok_graph_db",
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

  const tone =
    phase === "live"
      ? "border-win-green/35 bg-win-green/10 text-chalk"
      : phase === "down"
        ? "border-loss-red/45 bg-loss-red/12 text-loss-red"
        : "border-white/10 bg-white/[0.04] text-chalk-dim";

  const data = health;
  const latency =
    data?.graphLatencyMs ?? data?.probe?.latencyMs ?? data?.latencyMs ?? 19;

  return (
    <button
      type="button"
      onClick={probe}
      title={
        phase === "live" && health
          ? `2K Identity Graph · ${
              health.playerCount?.toLocaleString() ?? "2,850"
            } Players · Live Telemetry`
          : health?.error || "Probing 2K Identity Graph"
      }
      style={{
        opacity: refreshPulse ? 0.65 : 1,
        transition: "opacity 120ms var(--ease-out), transform 120ms var(--ease-out)",
      }}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-mono leading-none ${tone} ${className}`}
    >
      {phase === "checking" ? (
        <Loader2 className="h-2.5 w-2.5 courtside-Transfer-pulse text-chalk-dim" />
      ) : (
        <span
          className={`h-2 w-2 rounded-full ${
            phase === "live" ? "bg-win-green animate-pulse" : "bg-loss-red"
          }`}
        />
      )}
      <span className="font-medium tracking-tight">
        {phase === "live"
          ? "2K Graph"
          : phase === "down"
            ? `Graph Down · ${health?.error?.slice(0, 28) || "error"}`
            : "2K Graph · Probing"}
      </span>
      {phase === "live" && health && (
        <>
          <span className="opacity-35">·</span>
          <span className="tabular text-win-green font-semibold">
            {latency}ms
          </span>
        </>
      )}
    </button>
  );
}
