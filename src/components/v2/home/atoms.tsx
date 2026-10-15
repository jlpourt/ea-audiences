"use client";

/** Small shared Home atoms: card shell, section heading, error + n/a pills. */
import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import type { LiveError } from "./useLiveJson";

export function SectionHeading({
  icon,
  title,
  meta,
  action,
}: {
  icon?: ReactNode;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-[var(--text-faint)]">{icon}</span>}
        <h2 className="text-[13px] font-medium tracking-[-0.005em] text-[var(--text)]" style={{ fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>
          {title}
        </h2>
        {meta && <span className="truncate text-[12px] text-[var(--text-faint)]">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

export function LiveErrorNote({ error, onRetry, compact }: { error: LiveError; onRetry?: () => void; compact?: boolean }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--bad-soft)] bg-[var(--bad-soft)] ${compact ? "p-3" : "p-4"} text-[12.5px] text-[var(--text)]`}
    >
      <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--bad)]" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {error.service ? `${error.service} error` : "Request failed"}
          {error.status ? <span className="ml-1.5 text-[var(--text-faint)] v2-tabular">HTTP {error.status}</span> : null}
        </div>
        <div className="mt-0.5 line-clamp-2 break-words text-[var(--text-dim)]">{error.message}</div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="v2-press inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <RotateCw size={12} strokeWidth={1.75} />
          Retry
        </button>
      )}
    </div>
  );
}

export function NaPill({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-faint)] v2-tabular"
    >
      n/a
    </span>
  );
}
