"use client";

/**
 * Shared chrome for the Creator / Brand / Social cards.
 *
 * useLiveJson: fetches a live v2 endpoint. On a non-2xx it surfaces the exact
 * service + message returned by the route (never substitutes data).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ease } from "@/components/v2/motion";

export interface LiveState<T> {
  data: T | null;
  error: { message: string; service?: string; resource?: string } | null;
  loading: boolean;
  clientMs: number | null;
  reload: () => void;
}

export function useLiveJson<T>(url: string | null): LiveState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<LiveState<T>["error"]>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [clientMs, setClientMs] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    if (!url) return;
    const id = ++reqId.current;
    const ctrl = new AbortController();
    const t0 = performance.now();
    setLoading(true);
    setError(null);
    fetch(url, { cache: "no-store", signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        if (id !== reqId.current) return;
        if (!res.ok) {
          setError({
            message: body?.message || body?.error || `HTTP ${res.status}`,
            service: body?.service,
            resource: body?.resource,
          });
          setData(null);
        } else {
          setData(body as T);
        }
        setClientMs(Math.round(performance.now() - t0));
      })
      .catch((e) => {
        if (ctrl.signal.aborted || id !== reqId.current) return;
        setError({ message: e?.message || String(e) });
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
    return () => ctrl.abort();
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, clientMs, reload };
}

const ENGINE_LABEL: Record<string, string> = { bigquery: "BigQuery", spanner: "Spanner Graph" };

export function LiveBadge({ engines, ms }: { engines?: string[]; ms?: number | null }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-v2-dim v2-tabular">
      <span className="v2-live-dot" aria-hidden />
      {(engines || []).map((e) => ENGINE_LABEL[e] || e).join(" + ")}
      {typeof ms === "number" && <span className="text-v2-faint">{(ms / 1000).toFixed(2)}s</span>}
    </span>
  );
}

export function CardFrame({
  eyebrow,
  title,
  right,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`v2-card relative overflow-hidden p-6 ${className ?? ""}`}>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-v2-faint">{eyebrow}</p>
          <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.01em] text-v2-text">{title}</h3>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function ErrorPanel({ error, onRetry }: { error: NonNullable<LiveState<unknown>["error"]>; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-v2-md border border-v2-border bg-v2-bad-soft p-4 text-[13px] text-v2-text"
    >
      <p className="font-medium text-v2-bad">
        {error.service === "bigquery" ? "BigQuery" : error.service === "spanner" ? "Spanner Graph" : "Live query"} failed
      </p>
      <p className="mt-1 break-words text-v2-dim">{error.message}</p>
      {error.resource && <p className="mt-1 break-all text-[11px] text-v2-faint">{error.resource}</p>}
      <button onClick={onRetry} className="v2-press mt-3 rounded-v2-sm border border-v2-border px-3 py-1 text-[12px]">
        Retry
      </button>
    </div>
  );
}

export function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy>
      <div className="v2-skeleton h-10 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="v2-skeleton h-6" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

/**
 * Horizontal bar that grows from the left (scaleX, transform only).
 * `value` in [0, 1] relative to `max`.
 */
export function GrowBar({
  value,
  max = 1,
  color = "var(--accent)",
  track = "var(--surface-2)",
  delay = 0,
  height = 10,
}: {
  value: number;
  max?: number;
  color?: string;
  track?: string;
  delay?: number;
  height?: number;
}) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="relative w-full overflow-hidden rounded-v2-pill" style={{ height, background: track }}>
      <motion.div
        className="absolute inset-y-0 left-0 w-full rounded-v2-pill"
        style={{ background: color, transformOrigin: "0% 50%" }}
        initial={reduce ? { opacity: 0, transform: `scaleX(${pct})` } : { transform: "scaleX(0)" }}
        animate={{ opacity: 1, transform: `scaleX(${pct})` }}
        transition={{ duration: reduce ? 0.2 : 0.9, delay, ease: ease.out }}
      />
    </div>
  );
}

export const fmtPct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
export const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");
export const fmtCompact = (v: number) =>
  Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : `${Math.round(v)}`;
export const signed = (v: number) => (v > 0 ? `+${fmtInt(v)}` : v < 0 ? `\u2212${fmtInt(Math.abs(v))}` : "0");
