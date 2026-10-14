"use client";

import React from "react";

export interface ModelBadgeProps {
  modelId: string;
  latencyMs?: number | null;
  size?: "xs" | "sm";
  className?: string;
}

function resolveEngineLabel(rawId: string): string {
  const lower = (rawId || "").toLowerCase();
  if (lower.includes("offer & copy brief")) return "Offer & Copy Brief";
  if (lower.includes("pro") || lower.includes("3.1-pro")) return "Deep Synthesis";
  if (lower.includes("veo") || lower.includes("video")) return "Veo 3.1 Video Synth";
  if (lower.includes("omni")) return "Omni 1.1 Multimodal";
  if (lower.includes("image")) return "4K Key Art Render";
  if (lower.includes("tts")) return "Arena PA Synth";
  if (lower.includes("music") || lower.includes("002") || lower.startsWith("ly")) {
    return "128 BPM Audio Synth";
  }
  return "Live Telemetry Eval";
}

export function ModelBadge({
  modelId,
  latencyMs,
  size = "sm",
  className = "",
}: ModelBadgeProps) {
  const lower = (modelId || "").toLowerCase();
  const label = resolveEngineLabel(modelId);
  const isPro = lower.includes("pro") || lower.includes("brief");
  const isMedia =
    lower.includes("image") ||
    lower.includes("veo") ||
    lower.includes("video") ||
    lower.includes("omni") ||
    lower.includes("tts") ||
    lower.includes("music") ||
    lower.includes("002") ||
    lower.startsWith("ly");

  const toneClass = isPro
    ? "border-vc-gold/35 bg-vc-gold/10 text-vc-gold"
    : isMedia
      ? "border-twok-red/35 bg-twok-red/10 text-chalk"
      : "border-white/12 bg-white/[0.04] text-chalk";

  const sizeClass =
    size === "xs" ? "text-[10px] px-1.5 py-0.5 gap-1" : "text-[11px] px-2 py-0.5 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-mono leading-none select-none ${toneClass} ${sizeClass} ${className}`}
      title={`2K Courtside Engine · ${label}`}
    >
      <span
        aria-hidden="true"
        className="h-[6px] w-[6px] shrink-0 rounded-full bg-current opacity-85"
      />
      <span className="font-medium tracking-tight">{label}</span>
      {typeof latencyMs === "number" && Number.isFinite(latencyMs) && (
        <>
          <span className="opacity-35">·</span>
          <span className="tabular opacity-75">{Math.round(latencyMs)} ms</span>
        </>
      )}
    </span>
  );
}
