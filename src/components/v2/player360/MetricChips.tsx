"use client";

/**
 * The three signal cards that land after the social bloom:
 * Churn exposure · Crew centrality · Players like you bought.
 * One idea per card, numbers first.
 */
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Ticker, STAGGER, ease, springs } from "@/components/v2/motion";
import type { Player360Response } from "@/lib/v2/player360";

export function MetricChips({
  data,
  reduce,
  onAct,
}: {
  data: Player360Response;
  reduce: boolean;
  onAct?: () => void;
}) {
  const m = data.metrics;
  const exposurePct = m.churn_exposure.value * 100;
  const pct = m.crew_centrality.percentile;
  const top = pct !== null ? Math.max(1, Math.round(100 - pct)) : null;
  const like = m.players_like_you_bought.slice(0, 3);

  const item = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(14px)", filter: "blur(4px)" },
    animate: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
    exit: { opacity: 0, transition: { duration: 0.15 } },
    transition: { duration: 0.5, ease: ease.out, delay: 0.15 + i * STAGGER * 2 },
  });

  return (
    <div className="pointer-events-auto grid w-full grid-cols-[1fr_1fr_1.5fr_auto] items-stretch gap-3">
      <motion.div {...item(0)} className="v2-card px-4 py-3">
        <Label>Churn exposure</Label>
        <div className="mt-1 flex items-baseline gap-2">
          <Ticker
            value={exposurePct}
            decimals={0}
            suffix="%"
            delay={0.25}
            className="text-[28px] font-semibold tracking-[-0.02em]"
          />
        </div>
        <Sub>
          <span className="v2-tabular" style={{ color: m.churn_exposure.churned_14d > 0 ? "var(--bad)" : undefined }}>
            {m.churn_exposure.churned_14d}
          </span>{" "}
          of {m.churn_exposure.coplay_neighbors} co-players churned, 14d
        </Sub>
      </motion.div>

      <motion.div {...item(1)} className="v2-card px-4 py-3">
        <Label>Crew centrality</Label>
        <div className="mt-1 flex items-baseline gap-2">
          {m.crew_centrality.value !== null ? (
            <Ticker value={m.crew_centrality.value} decimals={2} delay={0.3} className="text-[28px] font-semibold tracking-[-0.02em]" />
          ) : (
            <span className="text-[28px] font-semibold text-[var(--text-faint)]">n/a</span>
          )}
          {top !== null && (
            <span className="v2-tabular text-[12px] font-medium text-[var(--accent)]">Top {top}%</span>
          )}
        </div>
        <Sub>{m.crew_centrality.crew ?? "No active crew"}</Sub>
      </motion.div>

      <motion.div {...item(2)} className="v2-card min-w-0 px-4 py-3">
        <Label>Players like you bought</Label>
        <ul className="mt-1.5 space-y-1">
          {like.length === 0 && <li className="text-[12px] text-[var(--text-faint)]">No neighbor purchases</li>}
          {like.map((it, i) => (
            <motion.li
              key={it.item_id}
              className="flex min-w-0 items-center gap-2 text-[12.5px]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateX(-6px)" }}
              animate={{ opacity: 1, transform: "translateX(0px)" }}
              transition={{ ...(springs.snappy as object), delay: 0.45 + i * STAGGER }}
            >
              <span className="v2-tabular w-4 shrink-0 text-[var(--text-faint)]">{i + 1}</span>
              <span className="min-w-0 truncate text-[var(--text)]">{it.name}</span>
              {it.brand_name && <span className="shrink-0 text-[var(--text-faint)]">{it.brand_name}</span>}
              <span className="v2-tabular ml-auto shrink-0 text-[var(--text-dim)]">
                {it.buyers_1hop}
                <span className="text-[var(--text-faint)]"> + {it.buyers_2hop}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {onAct && (
        <motion.button
          {...item(3)}
          type="button"
          onClick={onAct}
          className="v2-press flex items-center gap-2 self-center rounded-[var(--radius-pill)] bg-[var(--accent)] px-5 py-3 text-[13px] font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)]"
        >
          Act
          <ArrowRight size={15} strokeWidth={2.4} />
        </motion.button>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-faint)]">{children}</div>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 truncate text-[12px] text-[var(--text-dim)]">{children}</div>;
}
