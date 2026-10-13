"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export interface HoldToConfirmProps {
  label?: string;
  confirmedLabel?: string;
  holdDurationMs?: number;
  tone?: "red" | "gold";
  disabled?: boolean;
  onConfirm: () => void;
  className?: string;
}

/**
 * Hold-to-approve button (Codex §4 rule 13):
 * - Pointer or Space/Enter hold fills an overlay via `clip-path: inset(0 X% 0 0)`
 *   linear over 1.4s while the button scales to 0.97.
 * - Early release snaps back in 180ms `var(--ease-out)`.
 * - Fires `onConfirm` exactly once on completion.
 */
export function HoldToConfirm({
  label = "Hold to approve for activation",
  confirmedLabel = "Approved · Dispatching",
  holdDurationMs = 1400,
  tone = "red",
  disabled = false,
  onConfirm,
  className = "",
}: HoldToConfirmProps) {
  const prefersReducedMotion = useReducedMotion();
  const [holding, setHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmedRef = useRef(false);

  const clearHold = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
  }, []);

  const triggerConfirm = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    setHolding(false);
    setConfirmed(true);
    onConfirm();
  }, [onConfirm]);

  const startHold = useCallback(() => {
    if (disabled || confirmedRef.current) return;
    if (prefersReducedMotion) {
      triggerConfirm();
      return;
    }
    setHolding(true);
    timerRef.current = setTimeout(() => {
      triggerConfirm();
    }, holdDurationMs);
  }, [disabled, holdDurationMs, prefersReducedMotion, triggerConfirm]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const baseTone =
    tone === "gold"
      ? "border-vc-gold/50 bg-vc-gold/12 text-vc-gold"
      : "border-twok-red/60 bg-twok-red/15 text-chalk";

  const fillTone =
    tone === "gold" ? "bg-vc-gold text-court-black" : "bg-twok-red text-chalk";

  return (
    <div className={`relative inline-flex flex-col ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          startHold();
        }}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            clearHold();
          }
        }}
        style={{
          transform: holding ? "scale(0.97)" : "scale(1)",
          transition: "transform 120ms var(--ease-out)",
        }}
        className={`relative overflow-hidden rounded-lg border px-4 py-2.5 text-xs font-mono uppercase tracking-[0.08em] font-semibold select-none ${baseTone} ${
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        {/* Base label */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              confirmed
                ? "bg-win-green"
                : tone === "gold"
                  ? "bg-vc-gold"
                  : "bg-twok-red"
            }`}
          />
          <span>{confirmed ? confirmedLabel : label}</span>
          {!confirmed && (
            <span className="tabular opacity-60 text-[10px]">1.4s</span>
          )}
        </span>

        {/* Clip-path progress overlay */}
        <span
          aria-hidden="true"
          style={{
            clipPath:
              confirmed || holding ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
            transition: holding
              ? `clip-path ${holdDurationMs}ms linear`
              : "clip-path 180ms var(--ease-out)",
          }}
          className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-2 px-4 py-2.5 ${fillTone}`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          <span>{confirmed ? confirmedLabel : label}</span>
          {!confirmed && (
            <span className="tabular opacity-80 text-[10px]">HOLD</span>
          )}
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {confirmed
          ? confirmedLabel
          : holding
            ? "Holding to confirm approval"
            : ""}
      </span>
    </div>
  );
}
