"use client";

/**
 * Client helpers for the Crew · Churn endpoints. Errors are surfaced, never
 * replaced: a failed live call becomes an explicit error state in the UI.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export class CrewApiError extends Error {
  readonly status: number;
  readonly service: string | null;
  readonly resource: string | null;
  readonly missingResource: string | null;
  constructor(status: number, body: any) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.service = body?.service ?? null;
    this.resource = body?.resource ?? null;
    this.missingResource = body?.missing_resource ?? null;
  }
}

export async function crewFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  let body: any = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text.slice(0, 400) };
  }
  if (!res.ok) throw new CrewApiError(res.status, body);
  return body as T;
}

export interface LiveState<T> {
  data: T | null;
  error: CrewApiError | null;
  loading: boolean;
  reload: () => void;
}

/** Fetch a live endpoint on mount (and whenever `url` changes). */
export function useLive<T>(url: string | null): LiveState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<CrewApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!url) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    crewFetch<T>(url)
      .then((d) => {
        if (id === seq.current) setData(d);
      })
      .catch((e) => {
        if (id === seq.current) setError(e instanceof CrewApiError ? e : new CrewApiError(0, { error: String(e?.message || e) }));
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

export const fmtUsd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n).toLocaleString("en-US")}`;

export const fmtPct = (n: number, d = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}%`;

export const fmtAsOf = (isoStr: string | null | undefined) =>
  isoStr ? `as of ${new Date(isoStr).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : "";
