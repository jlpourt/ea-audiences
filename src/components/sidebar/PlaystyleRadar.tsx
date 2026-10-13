"use client";

import React from "react";

interface PlaystyleRadarProps {
  spend: number;
  churnRisk: number;
  tilt: number;
  archetype: string;
  telemetry?: Record<string, any>;
}

export default function PlaystyleRadar({
  spend,
  churnRisk,
  tilt,
  archetype,
  telemetry,
}: PlaystyleRadarProps) {
  const ovr = Number(telemetry?.myplayer_ovr || 84);
  const winPct = Number(telemetry?.park_win_pct || 0.54);
  const gravity = Number(telemetry?.gravity_score || 0.48);

  const metrics = [
    {
      label: "MyPLAYER OVR Rating",
      value: Math.min(100, Math.round(ovr)),
      raw: `${ovr} OVR`,
      color: "bg-twok-red",
    },
    {
      label: "Park Win Rate",
      value: Math.min(100, Math.round(winPct * 100)),
      raw: `${Math.round(winPct * 100)}%`,
      color: "bg-win-green",
    },
    {
      label: "VC Monetization Velocity",
      value: Math.min(100, Math.round((spend / 1000) * 100)),
      raw: `$${Math.round(spend)}`,
      color: "bg-vc-gold",
    },
    {
      label: "Cross-Label Gravity",
      value: Math.min(100, Math.round(gravity * 100)),
      raw: `${Math.round(gravity * 100)}%`,
      color: "bg-rockstar-gold",
    },
    {
      label: "Rage-Quit Index",
      value: Math.min(100, Math.round(tilt * 100)),
      raw: `${Math.round(tilt * 100)} / 100`,
      color: "bg-loss-red",
    },
  ];

  return (
    <div className="space-y-2.5 font-mono text-xs">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-chalk-dim">
        <span>NBA 2K27 Behavioral Telemetry</span>
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
