"use client";

/**
 * <Ticker> tabular-number tween.
 *
 * Purpose: state indication. A live number arriving or changing counts to its
 * new value so the eye registers the change. Writes textContent directly from
 * a motion value; zero React re-renders per frame.
 * Reduced motion: jumps straight to the value.
 *
 * Usage:
 *   <Ticker value={42.7} decimals={1} suffix="%" />
 *   <Ticker value={1234567} format={(n) => `$${(n / 1e6).toFixed(2)}M`} />
 */
import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { ease } from "./springs";

export interface TickerProps {
  value: number;
  /** Starting value on first mount. Default 0. Later changes tween from the current value. */
  from?: number;
  /** Seconds. Default 0.9. */
  duration?: number;
  /** Seconds before the first tween. Default 0. */
  delay?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Custom formatter; overrides decimals/prefix/suffix. */
  format?: (n: number) => string;
  className?: string;
  /** Accessible label; the final value is always exposed via aria-label. */
  "aria-label"?: string;
}

export function Ticker({
  value,
  from = 0,
  duration = 0.9,
  delay = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
  format,
  className,
  ...rest
}: TickerProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(from);
  const fmtRef = useRef<(n: number) => string>(() => "");

  fmtRef.current =
    format ??
    ((n: number) =>
      `${prefix}${n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`);

  useEffect(() => {
    const unsub = mv.on("change", (v) => {
      if (ref.current) ref.current.textContent = fmtRef.current(v);
    });
    return unsub;
  }, [mv]);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (reduce) {
      mv.set(value);
      if (ref.current) ref.current.textContent = fmtRef.current(value);
      return;
    }
    const controls = animate(mv, value, { duration, delay, ease: ease.out });
    return () => controls.stop();
  }, [value, duration, delay, reduce, mv]);

  const finalText = fmtRef.current(value);
  return (
    <span
      ref={ref}
      className={`v2-tabular ${className ?? ""}`}
      aria-label={rest["aria-label"] ?? finalText}
    >
      {fmtRef.current(mv.get())}
    </span>
  );
}
