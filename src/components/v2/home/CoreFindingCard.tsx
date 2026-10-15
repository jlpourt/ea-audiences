"use client";

/**
 * Core Finding: Section A leads with this (contract section 5).
 * Live from GET /api/insights/core-finding (Spanner Graph + Gemini).
 * Prefers the crew churn-contagion finding because it opens the storyline.
 *
 * Motion: the number ticks in (state indication), the contagion motif draws
 * its edges then flows from the departing node to the ego (explanation).
 */
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Layers } from "lucide-react";
import { AnimatedEdge, Magnetic, Ticker, curvedPath, ease, layoutIds, springs } from "../motion";
import { LiveErrorNote } from "./atoms";
import { useLiveJson } from "./useLiveJson";

interface Finding {
  id: string;
  category: string;
  title: string;
  summary: string;
  base?: string;
  metrics: { cohortSize: number; avgSpend?: number; avgChurn?: number };
  queryToRun: string;
  franchise: string;
}

interface CoreFindingResponse {
  finding: Finding;
  findings: Finding[];
  executive_summary: string;
  model_used: string;
  play_counts: { total: number };
  execution_ms: number;
  cache?: "hit" | "miss";
  computed_at?: string;
}

/** "Live · computed 12:01" unless this request itself was fast (<3s). */
function freshness(r: CoreFindingResponse): string {
  if (r.cache === "miss" && r.execution_ms < 3000) return `Live · ${(r.execution_ms / 1000).toFixed(1)}s`;
  const t = r.computed_at ? new Date(r.computed_at) : new Date();
  return `Live · computed ${t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function pickFinding(r: CoreFindingResponse): Finding {
  return r.findings.find((f) => f.category === "churn_contagion") ?? r.finding;
}

function stripLeadingCount(title: string): string {
  const t = title.replace(/^[\d,]+\s+/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function CoreFindingCard({
  onOpenPlayer,
  onLoadCohort,
}: {
  onOpenPlayer: () => void;
  onLoadCohort: (query: string, franchise: string) => void;
}) {
  const { data, error, loading, reload } = useLiveJson<CoreFindingResponse>("/api/insights/core-finding?franchise=NBA2K");
  const f = data ? pickFinding(data) : null;

  return (
    <motion.section
      layoutId={layoutIds.coreFinding}
      transition={springs.gentle}
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
    >
      {/* Corner glow: static, tinted to the accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-[340px] w-[440px] rounded-full opacity-90"
        style={{ background: "radial-gradient(closest-side, var(--glow-1), transparent)" }}
      />
      <div className="relative grid grid-cols-1 items-center gap-6 p-7 md:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-2.5 text-[12px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">
              <span className="v2-live-dot" style={{ background: "var(--accent)" }} />
              Core finding
            </span>
            {data && (
              <span className="text-[var(--text-faint)] v2-tabular">
                Spanner Graph · {data.play_counts.total.toLocaleString()} players · {freshness(data)}
              </span>
            )}
          </div>

          {loading && !data && <FindingSkeleton />}
          {error && <LiveErrorNote error={error} onRetry={reload} />}

          {f && (
            <>
              <div className="flex items-baseline gap-3">
                <Ticker
                  value={f.metrics.cohortSize}
                  className="text-[64px] font-semibold leading-none tracking-[-0.04em] text-[var(--text)]"
                />
                <span className="text-[15px] text-[var(--text-dim)]">players</span>
              </div>
              <motion.p
                initial={{ opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.5, delay: 0.15, ease: ease.out }}
                className="mt-3 max-w-[58ch] text-[19px] font-medium leading-[1.35] tracking-[-0.012em] text-[var(--text)] line-clamp-2"
              >
                {stripLeadingCount(f.title)}
              </motion.p>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Magnetic inline strength={0.2} max={6}>
                  <button
                    type="button"
                    onClick={onOpenPlayer}
                    className="v2-press group inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)]"
                  >
                    See one player
                    <ArrowRight size={14} strokeWidth={2} className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                  </button>
                </Magnetic>
                <button
                  type="button"
                  onClick={() => onLoadCohort(f.queryToRun, f.franchise)}
                  className="v2-press inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[13px] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                >
                  <Layers size={14} strokeWidth={1.75} />
                  Load cohort
                </button>
              </div>
            </>
          )}
        </div>
        <ContagionMotif active={!!f} />
      </div>
    </motion.section>
  );
}

function FindingSkeleton() {
  return (
    <div aria-busy className="space-y-3">
      <div className="v2-skeleton h-14 w-44" />
      <div className="v2-skeleton h-5 w-[min(520px,100%)]" />
      <div className="v2-skeleton h-5 w-[min(380px,80%)]" />
      <div className="flex gap-2 pt-3">
        <div className="v2-skeleton h-9 w-36 rounded-full" />
        <div className="v2-skeleton h-9 w-32 rounded-full" />
      </div>
    </div>
  );
}

/* Abstract icon-scale illustration of crew churn contagion (not data). */
const NODES = [
  { x: 130, y: 30 },
  { x: 214, y: 70 },
  { x: 206, y: 150 },
  { x: 130, y: 186 },
  { x: 52, y: 150 },
  { x: 44, y: 70 },
];
const C = { x: 130, y: 108 };
const LEAVER = 1;

function ContagionMotif({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="hidden justify-self-end md:block" aria-hidden>
      <svg width="260" height="216" viewBox="0 0 260 216" className="overflow-visible">
        {NODES.map((n, i) => (
          <AnimatedEdge
            key={`e${i}`}
            d={curvedPath(n.x, n.y, C.x, C.y, 0.25)}
            delay={0.1 + i * 0.06}
            duration={0.7}
            stroke={i === LEAVER ? "var(--accent)" : "var(--edge)"}
            opacity={i === LEAVER ? 0.7 : 1}
            flow={active && i === LEAVER}
            speed={700}
          />
        ))}
        {/* ring links between neighbors */}
        {NODES.map((n, i) => {
          const m = NODES[(i + 1) % NODES.length];
          return (
            <AnimatedEdge
              key={`r${i}`}
              d={`M ${n.x} ${n.y} L ${m.x} ${m.y}`}
              delay={0.5 + i * 0.05}
              duration={0.5}
              stroke="var(--grid)"
              strokeWidth={1}
            />
          );
        })}
        {NODES.map((n, i) => (
          <motion.circle
            key={`n${i}`}
            cx={n.x}
            cy={n.y}
            r={i === LEAVER ? 7 : 6}
            fill={i === LEAVER ? "var(--accent)" : "var(--surface-3)"}
            stroke={i === LEAVER ? "var(--accent)" : "var(--border-strong)"}
            strokeWidth={1}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={
              i === LEAVER && active && !reduce
                ? { opacity: [1, 1, 0.35], scale: 1, x: [0, 0, 14], y: [0, 0, -10] }
                : { opacity: 1, scale: 1 }
            }
            transition={
              i === LEAVER && active && !reduce
                ? { duration: 2.4, times: [0, 0.5, 1], ease: ease.inOut, delay: 0.6 }
                : { ...springs.snappy, delay: 0.05 * i }
            }
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
        ))}
        {/* ego */}
        {!reduce && (
          <motion.circle
            cx={C.x}
            cy={C.y}
            r={14}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: [0.5, 0], scale: [1, 2.2] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 1 }}
            style={{ transformOrigin: `${C.x}px ${C.y}px` }}
          />
        )}
        <motion.circle
          cx={C.x}
          cy={C.y}
          r={11}
          fill="var(--text)"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springs.bouncy}
          style={{ transformOrigin: `${C.x}px ${C.y}px` }}
        />
      </svg>
    </div>
  );
}
