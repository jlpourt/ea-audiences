"use client";

/**
 * StepErrorBoundary: contains a render crash to the step that threw.
 *
 * Without it, one exception inside a step unmounts the whole app and only a
 * browser refresh recovers. With it, the failing step shows the real error
 * (fail loudly, no fallback content) and a Retry button that remounts just
 * that step; the top bar and step navigation keep working.
 *
 * Stale-deploy guard: after a Cloud Run redeploy, an open tab can request a
 * JS chunk that no longer exists (ChunkLoadError). That is not a product
 * error, so we reload the page once to pick up the new build.
 */
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";

const RELOAD_FLAG = "v2-chunk-reload-at";

function isChunkError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  return !!e && (e.name === "ChunkLoadError" || /Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(e.message ?? ""));
}

function reloadOnceForChunk(): boolean {
  if (typeof window === "undefined") return false;
  const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
  if (Date.now() - last < 30_000) return false; // already tried; show the error instead
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  window.location.reload();
  return true;
}

/** Mount once in the shell: reloads on stale-chunk errors from lazy imports. */
export function useStaleChunkReload() {
  useEffect(() => {
    const onRejection = (ev: PromiseRejectionEvent) => {
      if (isChunkError(ev.reason)) reloadOnceForChunk();
    };
    const onError = (ev: ErrorEvent) => {
      if (isChunkError(ev.error)) reloadOnceForChunk();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
}

interface Props {
  stepLabel: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  attempt: number;
}

export class StepErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[v2] step "${this.props.stepLabel}" crashed`, error, info.componentStack);
    if (isChunkError(error)) reloadOnceForChunk();
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    const { error, attempt } = this.state;
    if (error) {
      return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[720px] flex-col items-start justify-center gap-4 px-8">
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[12px] font-medium text-[var(--accent)]">
            {this.props.stepLabel} failed to render
          </span>
          <pre className="w-full overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
            {error.name}: {error.message}
          </pre>
          <button
            type="button"
            onClick={this.retry}
            className="v2-press rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-white"
          >
            Retry this step
          </button>
        </div>
      );
    }
    // key remounts the subtree on Retry so effects (fetches) run fresh.
    return <div key={attempt} className="contents">{this.props.children}</div>;
  }
}
