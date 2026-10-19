/**
 * Tiny in-process cache for LIVE results (Spanner / BigQuery), with in-flight
 * de-duplication. A miss always runs the real query; errors are never cached and
 * always propagate to the caller (no fallbacks). Results carry `cached_at` so the
 * UI can say "cached" honestly.
 */
type Entry<T> = { at: number; value: T };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function liveCached<T>(key: string, ttlMs: number, run: () => Promise<T>): Promise<{ value: T; cached: boolean; at: number }> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return { value: hit.value, cached: true, at: hit.at };
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) {
    const value = await pending;
    return { value, cached: false, at: Date.now() };
  }
  const p = run()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  const value = await p;
  return { value, cached: false, at: Date.now() };
}

/** Fire-and-forget warm. Errors are logged loudly, never swallowed into data. */
export function warmLive<T>(key: string, ttlMs: number, run: () => Promise<T>): void {
  liveCached(key, ttlMs, run).catch((e) => console.error(`[live-cache] warm ${key} failed:`, e));
}
