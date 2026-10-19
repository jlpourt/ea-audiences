"use client";

import React from "react";

interface PlaystyleRadarProps {
  spend: number;
  churnRisk: number;
  tilt: number;
  archetype: string;
  telemetry?: Record<string, any>;
}

/**
 * Behavioural bars for one player. Every bar is drawn only when its value is
 * stored on the Spanner row; nothing is defaulted.
 */
export default function PlaystyleRadar({
  spend,
  churnRisk,
  tilt,
  archetype,
  telemetry,
}: PlaystyleRadarProps) {
  const isNum = (v: any) => typeof v === "number" && Number.isFinite(v);
  const metrics: Array<{ label: string; value: number; raw: string; color: string }> = [];

  if (isNum(telemetry?.myplayer_ovr)) {
    const ovr = Number(telemetry!.myplayer_ovr);
    metrics.push({ label: "MyPLAYER OVR", value: Math.min(100, Math.round(ovr)), raw: `${ovr} OVR`, color: "bg-twok-red" });
  }
  if (isNum(telemetry?.park_win_pct)) {
    const w = Number(telemetry!.park_win_pct);
    metrics.push({ label: "Park win rate", value: Math.min(100, Math.round(w * 100)), raw: `${Math.round(w * 100)}%`, color: "bg-win-green" });
  }
  if (isNum(spend)) {
    // Bar scale: $1,000 lifetime = full bar (label shows the exact value).
    metrics.push({ label: "Lifetime spend", value: Math.min(100, Math.round((spend / 1000) * 100)), raw: `$${Math.round(spend).toLocaleString()}`, color: "bg-vc-gold" });
  }
  if (isNum(telemetry?.gravity_score)) {
    const g = Number(telemetry!.gravity_score);
    metrics.push({ label: "Cross-2K gravity", value: Math.min(100, Math.round(g * 100)), raw: `${Math.round(g * 100)}%`, color: "bg-vc-gold" });
  }
  if (isNum(churnRisk)) {
    metrics.push({ label: "Churn risk", value: Math.min(100, Math.round(churnRisk * 100)), raw: `${Math.round(churnRisk * 100)}%`, color: "bg-loss-red" });
  }
  if (isNum(tilt)) {
    metrics.push({ label: "Rage-Quit Index", value: Math.min(100, Math.round(tilt * 100)), raw: `${Math.round(tilt * 100)} / 100`, color: "bg-loss-red" });
  }
  if (metrics.length === 0) return null;

  return (
    <div className="space-y-2.5 font-mono text-xs">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-chalk-dim">
        <span>Behavioral telemetry</span>
        <span className="text-chalk">{archetype.replace(/_/g, " ")}</span>
      </div>
      <div className="space-y-2">
        {metrics.map((m, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-[11px] tabular">
              <span className="text-chalk-dim">{m.label}</span>
              <span className="font-semibold text-chalk">{m.raw}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
              <div
                className={`h-full ${m.color} rounded-full origin-left`}
                style={{
                  transform: `scaleX(${Math.max(0.04, m.value / 100)})`,
                  transition: "transform 300ms var(--ease-out)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
