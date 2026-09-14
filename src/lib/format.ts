/**
 * Display formatters shared between server routes and client components.
 *
 * These live in one place so a number is never formatted two different ways in
 * two different panels of the same screen.
 */

/** "3200000" reads as noise on a label; "3.2M" reads as reach. */
export function formatFollowers(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * Conversion lift is stored as percentage POINTS (25.4), not a fraction.
 * It used to be the string "+25.4%", which silently became NULL on load.
 */
export function formatLift(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
