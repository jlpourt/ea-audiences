"use client";

import React from "react";

interface PlaystyleRadarProps {
  spend: number;
  churnRisk: number;
  tilt: number;
  archetype: string;
}

export default function PlaystyleRadar({ spend, churnRisk, tilt, archetype }: PlaystyleRadarProps) {
  const metrics = [
    { label: "LTV / Spend", value: Math.min(100, Math.round((spend / 1500) * 100)), raw: `$${spend.toFixed(0)}`, color: "bg-hud-gold" },
    { label: "Tilt Sensitivity", value: Math.round(tilt * 100), raw: `${(tilt * 100).toFixed(0)}%`, color: "bg-alert-red" },
    { label: "Churn Risk Score", value: Math.round(churnRisk * 100), raw: `${(churnRisk * 100).toFixed(0)}%`, color: "bg-ea-orange" },
    { label: "Session APM", value: archetype.includes("COMPETITIVE") ? 88 : 45, raw: archetype.includes("COMPETITIVE") ? "185 APM" : "95 APM", color: "bg-cyber-cyan" },
    { label: "Social Co-Play", value: archetype.includes("CASUAL") ? 92 : 35, raw: archetype.includes("CASUAL") ? "High" : "Solo", color: "bg-neon-green" },
  ];

  return (
    <div className="space-y-2.5 font-mono text-xs">
      <div className="text-[11px] text-gray-400 uppercase tracking-wider">Playstyle & Behavioral Profile</div>
      <div className="space-y-2">
        {metrics.map((m, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-300">{m.label}</span>
              <span className="font-bold text-white">{m.raw}</span>
            </div>
            <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden border border-surface-border">
              <div
                className={`h-full ${m.color} rounded-full transition-all duration-500`}
                style={{ width: `${m.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
