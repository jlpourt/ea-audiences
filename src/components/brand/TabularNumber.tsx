"use client";

import React, { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

export interface TabularNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  formatOptions?: Intl.NumberFormatOptions;
}

/**
 * Animated count-up driven by a Framer Motion value (`useMotionValue` +
 * `useTransform`), so the DOM text node updates without re-rendering the React
 * component on every frame. Always wears `tabular-nums`.
 */
export function TabularNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 0.6,
  className = "",
  formatOptions,
}: TabularNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const safeTarget = Number.isFinite(value) ? value : 0;
  const motionValue = useMotionValue(safeTarget);

  const formatter = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        ...formatOptions,
      }),
    [decimals, formatOptions]
  );

  const display = useTransform(motionValue, (latest) => {
    const num = decimals === 0 ? Math.round(latest) : Number(latest.toFixed(decimals));
    return `${prefix}${formatter.format(num)}${suffix}`;
  });

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.set(safeTarget);
      return;
    }
    const controls = animate(motionValue, safeTarget, {
      duration,
      ease: [0.23, 1, 0.32, 1],
    });
    return () => controls.stop();
  }, [safeTarget, duration, motionValue, prefersReducedMotion]);

  return <motion.span className={`tabular ${className}`}>{display}</motion.span>;
}
