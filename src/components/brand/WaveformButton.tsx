"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export interface WaveformButtonProps {
  src: string;
  label?: string;
  sublabel?: string;
  tone?: "red" | "gold";
  className?: string;
}

const BAR_HEIGHTS = [
  0.32, 0.55, 0.78, 0.44, 0.92, 0.64, 0.38, 0.85, 1.0, 0.58, 0.74, 0.48,
  0.88, 0.62, 0.95, 0.52, 0.72, 0.4, 0.82, 0.68, 0.46, 0.76, 0.54, 0.35,
];

/**
 * Audio player pill with a 24-bar waveform that animates via compositor-only
 * `transform: scaleY()` strictly while audio is playing (no layout animation).
 */
export function WaveformButton({
  src,
  label = "Play Audio",
  sublabel,
  tone = "red",
  className = "",
}: WaveformButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
  }, [src]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => setPlaying(false));
    }
  };

  const accentBar = tone === "gold" ? "bg-vc-gold" : "bg-twok-red";
  const accentBtn =
    tone === "gold"
      ? "bg-vc-gold text-court-black border-vc-gold"
      : "bg-twok-red text-chalk border-twok-red";

  const formatSec = (s: number) => {
    if (!Number.isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const d = e.currentTarget.duration || 1;
          setProgress(Math.min(1, e.currentTarget.currentTime / d));
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${accentBtn}`}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current translate-x-[0.5px]" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="truncate text-xs font-medium text-chalk">
            {label}
          </span>
          <span className="font-mono text-[10px] tabular text-chalk-dim">
            {sublabel ||
              (duration > 0
                ? `${formatSec(progress * duration)} / ${formatSec(duration)}`
                : "WAV · 24kHz")}
          </span>
        </div>

        {/* 24-bar compositor-only waveform */}
        <div className="flex h-5 items-center gap-[2px]" aria-hidden="true">
          {BAR_HEIGHTS.map((baseH, idx) => {
            const played = idx / BAR_HEIGHTS.length <= progress;
            const scale = playing
              ? Math.max(
                  0.22,
                  Math.min(
                    1,
                    baseH * (0.65 + 0.35 * Math.sin(idx * 0.9 + progress * 24))
                  )
                )
              : baseH * 0.65;
            return (
              <span
                key={idx}
                style={{
                  transform: `scaleY(${scale.toFixed(2)})`,
                  transition: "transform 120ms var(--ease-out)",
                }}
                className={`h-full flex-1 rounded-full origin-center ${
                  played || playing ? accentBar : "bg-white/20"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
