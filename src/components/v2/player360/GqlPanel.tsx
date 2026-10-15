"use client";

/**
 * "Show query" drawer: the exact GQL statements the endpoint ran against
 * Spanner, with per-statement latency and row counts.
 */
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { ease } from "@/components/v2/motion";
import type { P360QueryStep } from "@/lib/v2/player360";

export function GqlPanel({
  steps,
  latencyMs,
  database,
  onClose,
  reduce,
}: {
  steps: P360QueryStep[];
  latencyMs: number;
  database: string;
  onClose: () => void;
  reduce: boolean;
}) {
  return (
    <motion.aside
      className="v2-glass pointer-events-auto absolute bottom-3 right-3 top-3 z-30 flex w-[440px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]"
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateX(24px)" }}
      animate={{ opacity: 1, transform: "translateX(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateX(24px)" }}
      transition={{ duration: 0.26, ease: ease.drawer }}
      role="dialog"
      aria-label="Live GQL"
    >
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="v2-live-dot" />
        <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-[var(--text)]">Spanner Graph</span>
        <span className="v2-tabular min-w-0 truncate text-[12px] text-[var(--text-faint)]">
          {database} · {steps.length} statements · {latencyMs} ms
        </span>
        <button
          type="button"
          onClick={onClose}
          className="v2-press ml-auto rounded-[var(--radius-sm)] p-1 text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {steps.map((s, i) => (
          <section key={i} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-2 px-3 pt-2 text-[11.5px]">
              <span className="font-medium text-[var(--text)]">{s.label}</span>
              <span className="v2-tabular ml-auto text-[var(--text-faint)]">
                {s.rows} rows · {s.ms} ms
              </span>
            </div>
            <pre className="overflow-x-auto px-3 pb-2.5 pt-1.5 font-mono text-[11px] leading-[1.5] text-[var(--text-dim)]">
              {s.gql}
            </pre>
          </section>
        ))}
      </div>
    </motion.aside>
  );
}
