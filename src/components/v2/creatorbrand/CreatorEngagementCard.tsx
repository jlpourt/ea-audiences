"use client";

/**
 * <CreatorEngagementCard /> Creator · Engagement.
 *
 * Incremental Day-30 retained players per creator vs. matched non-viewers
 * (GET /api/v2/creator/incremental, BigQuery CEM + Spanner creator nodes).
 *
 * Motion (occasional tier, purpose = state indication / explanation):
 *  - treated vs control bars grow in with scaleX, 0.9s strong ease-out, 120ms apart
 *  - incremental-players <Ticker>
 *  - CI whisker draws outward from the estimate
 *  - Creator -> Stream -> Viewer -> Player strip draws edge by edge with a flowing dash
 *  - selecting another creator retargets every value (springs / transitions, interruptible)
 */
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Gamepad2, Eye, MonitorPlay, Radio } from "lucide-react";
import {
  ActiveIndicator,
  AnimatedEdge,
  AnimatePresence,
  Ticker,
  curvedPath,
  ease,
  layoutIds,
  springs,
  STAGGER,
} from "@/components/v2/motion";
import { useOptionalStoryline } from "@/components/v2/shell/StorylineProvider";
import type { CreatorIncrementalResponse, CreatorIncrementalRow } from "@/lib/v2/creatorbrand";
import {
  CardFrame,
  ErrorPanel,
  GrowBar,
  LiveBadge,
  SkeletonBlock,
  fmtCompact,
  fmtInt,
  fmtPct,
  signed,
  useLiveJson,
} from "./shared";

export interface CreatorEngagementCardProps {
  /** Pre-select a creator by handle or creator_id. Defaults to the top incremental creator. */
  initialCreator?: string;
  className?: string;
}

export function CreatorEngagementCard({ initialCreator, className }: CreatorEngagementCardProps) {
  const story = useOptionalStoryline();
  const { data, error, loading, reload } = useLiveJson<CreatorIncrementalResponse>("/api/v2/creator/incremental");
  const [selected, setSelected] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);

  useEffect(() => {
    if (!data || selected) return;
    const want = (initialCreator || story?.focus || "").toLowerCase();
    const hit = data.creators.find(
      (c) => c.handle.toLowerCase() === want || c.creator_id.toLowerCase() === want
    );
    setSelected((hit ?? data.creators[0])?.creator_id ?? null);
  }, [data, selected, initialCreator, story?.focus]);

  const current = useMemo(
    () => data?.creators.find((c) => c.creator_id === selected) ?? null,
    [data, selected]
  );

  return (
    <CardFrame
      className={className}
      eyebrow="Creator · Engagement"
      title="Incremental retained players"
      right={data ? <LiveBadge engines={data.engines} ms={data.latency_ms.total} /> : null}
    >
      {error ? (
        <ErrorPanel error={error} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonBlock rows={4} />
      ) : data && current ? (
        <div className="space-y-6">
          <Headline data={data} current={current} />
          <PathStrip row={current} />
          <ArmBars row={current} />
          <CreatorList rows={data.creators} selected={current.creator_id} onSelect={setSelected} />
          <footer className="flex items-center justify-between gap-3 text-[11px] text-v2-faint">
            <span>Matched on day · archetype · prior activity, alive at t{data.as_of ? ` · as of ${data.as_of}` : ""}</span>
            <button
              onClick={() => setShowMethod((v) => !v)}
              className="v2-press rounded-v2-sm px-2 py-1 text-v2-dim hover:text-v2-text"
              aria-expanded={showMethod}
            >
              Method
            </button>
          </footer>
          <AnimatePresence initial={false}>
            {showMethod && (
              <motion.p
                key="method"
                initial={{ opacity: 0, transform: "translateY(-4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transform: "translateY(-4px)" }}
                transition={{ duration: 0.2, ease: ease.out }}
                className="rounded-v2-md bg-v2-surface-2 p-3 text-[12px] leading-relaxed text-v2-dim"
              >
                {data.method}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      ) : data ? (
        <p className="text-[13px] text-v2-dim">No creator met the minimum treated sample in the live window.</p>
      ) : null}
    </CardFrame>
  );
}

/* ------------------------------------------------------------------ */

function Headline({ data, current }: { data: CreatorIncrementalResponse; current: CreatorIncrementalRow }) {
  const positive = current.incremental_players > 0;
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <motion.p
          layoutId={layoutIds.creator(current.handle)}
          className="text-[12px] text-v2-dim"
          transition={springs.gentle}
        >
          @{current.handle.replace(/^@/, "")}
        </motion.p>
        <div className="mt-1 flex items-baseline gap-2">
          <Ticker
            value={current.incremental_players}
            format={(n) => signed(Math.round(n))}
            className={`v2-tabular text-[44px] font-semibold leading-none tracking-[-0.03em] ${
              positive ? "text-v2-text" : "text-v2-dim"
            }`}
            aria-label={`${current.incremental_players} incremental retained players`}
          />
          <span className="text-[13px] text-v2-dim">D30 players</span>
        </div>
        <p className="mt-2 text-[12px] text-v2-faint v2-tabular">
          95% CI {signed(current.ci_low)} to {signed(current.ci_high)}
          {current.significant ? "" : " · not distinguishable from zero"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] uppercase tracking-[0.12em] text-v2-faint">All creators, first touch</p>
        <Ticker
          value={data.totals.incremental_players}
          format={(n) => signed(Math.round(n))}
          className="v2-tabular text-[22px] font-semibold text-v2-text"
        />
        <p className="text-[11px] text-v2-faint v2-tabular">
          {signed(data.totals.ci_low)} to {signed(data.totals.ci_high)}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const STRIP_W = 560;
const STRIP_H = 64;
const STRIP_X = [28, 196, 364, 532];

function PathStrip({ row }: { row: CreatorIncrementalRow }) {
  const reduce = useReducedMotion();
  const steps = [
    { icon: Radio, label: `@${row.handle.replace(/^@/, "")}`, sub: `${fmtCompact(row.followers)} followers` },
    { icon: MonitorPlay, label: "Offer stream", sub: "20+ min watched" },
    { icon: Eye, label: `${fmtInt(row.treated_n)} viewers`, sub: "linked identity" },
    {
      icon: Gamepad2,
      label: `${signed(row.incremental_players)} players`,
      sub: `retained at D30`,
    },
  ];
  return (
    <div className="relative" aria-label="Creator to Stream to Viewer to Player path">
      <svg viewBox={`0 0 ${STRIP_W} ${STRIP_H}`} className="h-16 w-full" preserveAspectRatio="none">
        {STRIP_X.slice(0, -1).map((x, i) => (
          <AnimatedEdge
            key={`${row.creator_id}-${i}`}
            d={curvedPath(x + 18, STRIP_H / 2, STRIP_X[i + 1] - 18, STRIP_H / 2, 0)}
            flow
            delay={0.15 + i * 0.28}
            duration={0.4}
            speed={1100}
            stroke="var(--border-strong)"
            flowStroke={i === 2 && row.incremental_players <= 0 ? "var(--text-faint)" : "var(--accent)"}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid grid-cols-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={`${row.creator_id}-${i}`}
              className={`flex flex-col ${i === 0 ? "items-start" : i === 3 ? "items-end" : "items-center"}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.92)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              transition={{ ...springs.snappy, delay: i * 0.28 }}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full border ${
                  i === 3 ? "border-v2-accent bg-v2-accent-soft text-v2-accent" : "border-v2-border bg-v2-surface-2 text-v2-dim"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
              </span>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-4 text-[11px]">
        {steps.map((s, i) => (
          <div key={i} className={i === 0 ? "text-left" : i === 3 ? "text-right" : "text-center"}>
            <p className="truncate font-medium text-v2-text v2-tabular">{s.label}</p>
            <p className="truncate text-v2-faint">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ArmBars({ row }: { row: CreatorIncrementalRow }) {
  const max = Math.max(row.d30_treated, row.d30_control, 0.01) * 1.08;
  const arms = [
    { label: "Watched 20+ min", n: row.treated_n, v: row.d30_treated, color: "var(--accent)" },
    { label: "Matched not-yet-viewers", n: row.control_n, v: row.d30_control, color: "var(--text-faint)" },
  ];
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-3">
      {arms.map((a, i) => (
        <div key={a.label} className="contents">
          <div>
            <div className="mb-1.5 flex justify-between text-[12px]">
              <span className="text-v2-dim">{a.label}</span>
              <span className="text-v2-faint v2-tabular">n {fmtInt(a.n)}</span>
            </div>
            <GrowBar key={`${row.creator_id}-${i}`} value={a.v} max={max} color={a.color} delay={0.1 + i * 0.12} />
          </div>
          <Ticker
            value={a.v * 100}
            decimals={1}
            suffix="%"
            className="v2-tabular w-14 text-right text-[15px] font-semibold text-v2-text"
          />
        </div>
      ))}
      <Whisker row={row} />
    </div>
  );
}

/** Lift in percentage points with its 95% CI, drawn outward from the estimate. */
function Whisker({ row }: { row: CreatorIncrementalRow }) {
  const reduce = useReducedMotion();
  const toPp = (players: number) => (row.treated_n > 0 ? (players / row.treated_n) * 100 : 0);
  const lo = toPp(row.ci_low);
  const hi = toPp(row.ci_high);
  const est = row.lift_pp;
  const span = Math.max(Math.abs(lo), Math.abs(hi), 2) * 1.15;
  const x = (v: number) => 50 + (v / span) * 50; // percent across
  const color = row.significant ? (est > 0 ? "var(--good)" : "var(--bad)") : "var(--text-dim)";
  return (
    <div className="col-span-2 mt-1">
      <div className="mb-1.5 flex justify-between text-[11px] text-v2-faint">
        <span>D30 lift, 95% CI</span>
        <span className="v2-tabular" style={{ color }}>
          {est > 0 ? "+" : ""}
          {est.toFixed(1)} pts
        </span>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-px bg-v2-border" />
        <div className="absolute top-0 h-full w-px bg-v2-border-strong" style={{ left: "50%" }} />
        <motion.div
          key={`ci-${row.creator_id}`}
          className="absolute top-1/2 h-[2px] rounded-full"
          style={{
            left: `${x(lo)}%`,
            width: `${x(hi) - x(lo)}%`,
            background: color,
            transformOrigin: `${((x(est) - x(lo)) / Math.max(0.001, x(hi) - x(lo))) * 100}% 50%`,
          }}
          initial={reduce ? { opacity: 0 } : { transform: "translateY(-50%) scaleX(0)", opacity: 1 }}
          animate={{ transform: "translateY(-50%) scaleX(1)", opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.35, ease: ease.out }}
        />
        {[lo, hi].map((v, i) => (
          <motion.div
            key={`cap-${row.creator_id}-${i}`}
            className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full"
            style={{ left: `calc(${x(v)}% - 1px)`, background: color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.95 }}
          />
        ))}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ transform: `translateX(${x(est)}%)` }}
          transition={springs.gentle}
        >
          <span
            className="absolute -ml-[5px] h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: color, background: "var(--surface)", top: "calc(50% - 5px)" }}
          />
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CreatorList({
  rows,
  selected,
  onSelect,
}: {
  rows: CreatorIncrementalRow[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.incremental_players)));
  const TOP = 5;
  const BOTTOM = 3;
  const collapsed = !showAll && rows.length > TOP + BOTTOM + 1;
  const visible = collapsed ? [...rows.slice(0, TOP), ...rows.slice(-BOTTOM)] : rows;
  // Keep the selected creator visible even when collapsed.
  const sel = rows.find((r) => r.creator_id === selected);
  if (collapsed && sel && !visible.includes(sel)) visible.splice(TOP, 0, sel);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.12em] text-v2-faint">Incremental D30 players by creator</p>
        {rows.length > TOP + BOTTOM + 1 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="v2-press rounded-v2-sm px-2 py-0.5 text-[11px] text-v2-dim hover:text-v2-text"
          >
            {showAll ? "Top and bottom" : `All ${rows.length}`}
          </button>
        )}
      </div>
      <ul className="space-y-0.5" role="listbox" aria-label="Creators">
        {visible.map((r, i) => {
          const active = r.creator_id === selected;
          const w = (Math.abs(r.incremental_players) / maxAbs) * 50;
          const neg = r.incremental_players < 0;
          const color = !r.significant ? "var(--text-faint)" : r.lift_pp > 0 ? "var(--good)" : "var(--bad)";
          const gapBefore = collapsed && i === visible.length - BOTTOM;
          return (
            <motion.li
              key={r.creator_id}
              className={gapBefore ? "mt-2 border-t border-v2-border pt-2" : undefined}
              initial={{ opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.35, delay: 0.2 + Math.min(i, 10) * STAGGER, ease: ease.out }}
            >
              <button
                role="option"
                aria-selected={active}
                onClick={() => onSelect(r.creator_id)}
                className="v2-press relative grid w-full grid-cols-[110px_1fr_64px] items-center gap-3 rounded-v2-sm px-2 py-1.5 text-left text-[12px]"
              >
                {active && <ActiveIndicator layoutId="creator-incremental-row" className="rounded-v2-sm bg-v2-surface-2" />}
                <span className={`relative truncate ${active ? "text-v2-text" : "text-v2-dim"}`}>
                  @{r.handle.replace(/^@/, "")}
                </span>
                <span className="relative h-1.5">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-v2-border-strong" />
                  <motion.span
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      background: color,
                      left: !neg ? "50%" : `${50 - w}%`,
                      width: `${w}%`,
                      transformOrigin: !neg ? "0% 50%" : "100% 50%",
                    }}
                    initial={{ transform: "scaleX(0)" }}
                    animate={{ transform: "scaleX(1)" }}
                    transition={{ duration: 0.7, delay: 0.3 + Math.min(i, 10) * STAGGER, ease: ease.out }}
                  />
                </span>
                <span className="relative text-right v2-tabular" style={{ color: active ? "var(--text)" : undefined }}>
                  {signed(r.incremental_players)}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-v2-faint">Grey = 95% CI crosses zero. Lift shown honestly, including flat and negative creators.</p>
    </div>
  );
}

export default CreatorEngagementCard;
