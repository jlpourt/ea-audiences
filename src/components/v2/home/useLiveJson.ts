"use client";

/**
 * Minimal live-fetch hook for v2 Home cards. No caching layer, no fallback
 * payloads: a non-2xx response surfaces as `error` with the server's
 * service/message details so the presenter sees exactly what failed.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveError {
  status: number;
  service?: string;
  resource?: string | null;
  message: string;
}

export interface LiveState<T> {
  data: T | null;
  error: LiveError | null;
  loading: boolean;
  reload: () => void;
}

export function useLiveJson<T>(url: string | null): LiveState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<LiveError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [nonce, setNonce] = useState(0);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError(null);
    fetch(url, { cache: "no-store", signal: c.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError({
            status: res.status,
            service: body?.service,
            resource: body?.resource ?? null,
            message:
              body?.message ||
              body?.error ||
              `${res.statusText || "Server error"} (route returned no details; see server log)`,
          });
          setData(null);
          return;
        }
        setData(body as T);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError({ status: 0, message: e.message });
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}
