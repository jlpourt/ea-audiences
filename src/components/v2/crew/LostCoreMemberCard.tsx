"use client";

/**
 * <LostCoreMemberCard /> Section C: "Which Crews lost a core member this week,
 * and act on it without a separate analytics hop."
 *
 * Data: GET /api/v2/crew/lost-core-member, ONE BigQuery statement that reads
 * live Spanner membership through EXTERNAL_QUERY and joins BigQuery session +
 * bookings history. The "Spanner + BigQuery · 1 query" badge expands to show
 * the exact SQL that ran.
 *
 * Motion: rows rise in with a 40ms stagger; sparklines draw; the SQL drawer is
 * an accordion (height + opacity, 260ms drawer curve). Reduced motion: fades.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, ArrowRight, Database } from "lucide-react";
import { Pressable, Reveal, Ticker, ease, springs } from "@/components/v2/motion";
import { useOptionalStoryline } from "@/components/v2/shell/StorylineProvider";
import type { LostCoreMemberResponse } from "@/lib/v2/crew";
import { useLive, fmtUsd, fmtAsOf } from "./api";
import { CrewActButtons } from "./CrewActButtons";
import styles from "./crew.module.css";

export interface LostCoreMemberCardProps {
  days?: number;
  /** Called with the selected crew ids. Default: storyline goTo("ACT", { crewIds }). */
  onAct?: (crewIds: string[]) => void;
  className?: string;
}

function Sparkline({ values, delay = 0 }: { values: number[]; delay?: number }) {
  const reduce = !!useReducedMotion();
  if (values.length < 2) return <span className="text-[11px] text-[var(--text-faint)]">n/a</span>;
  const w = 64;
  const h = 20;
  const max = Math.max(...values, 0.01);
  const min = Math.min(...values);
  const span = Math.max(0.05, max - min);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const falling = values[values.length - 1] < values[0];
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`Weekly active rate ${values.map((v) => Math.round(v * 100)).join(", ")}%`}>
      <motion.path
        d={d}
        fill="none"
        stroke={falling ? "var(--bad)" : "var(--good)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : delay, ease: ease.inOut }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r={2.2}
        fill={falling ? "var(--bad)" : "var(--good)"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: reduce ? 0 : delay + 0.55 }}
      />
    </svg>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  // Light highlighting: the federated hop + SQL keywords.
  const parts = sql.split(/(EXTERNAL_QUERY|WITH|SELECT|FROM|JOIN|LEFT JOIN|WHERE|GROUP BY|ORDER BY|CROSS JOIN|UNNEST|AS|ON|AND)\b/g);
  return (
    <pre className={`${styles.sql} max-h-[320px] overflow-auto rounded-[var(--radius-md)] bg-[var(--bg)] p-3 text-[var(--text-dim)]`}>
      {parts.map((p, i) =>
        p === "EXTERNAL_QUERY" ? (
          <span key={i} className="rounded bg-[var(--accent-soft)] px-1 font-semibold text-[var(--accent)]">
            {p}
          </span>
        ) : /^(WITH|SELECT|FROM|JOIN|LEFT JOIN|WHERE|GROUP BY|ORDER BY|CROSS JOIN|UNNEST|AS|ON|AND)$/.test(p) ? (
          <span key={i} className="text-[var(--accent-2)]">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </pre>
  );
}

export function LostCoreMemberCard({ days = 7, onAct, className }: LostCoreMemberCardProps) {
  const reduce = !!useReducedMotion();
  const story = useOptionalStoryline();
  const { data, error, loading } = useLive<LostCoreMemberResponse>(`/api/v2/crew/lost-core-member?days=${days}`);
  const [showSql, setShowSql] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inlineAct, setInlineAct] = useState(false);

  useEffect(() => {
    if (data) setSelected(new Set(data.crews.map((c) => c.clan_id)));
  }, [data]);

  const crewIds = useMemo(() => (data ? data.crews.filter((c) => selected.has(c.clan_id)).map((c) => c.clan_id) : []), [data, selected]);
  const sel = data ? data.crews.filter((c) => selected.has(c.clan_id)) : [];
  const selAtRisk = sel.reduce((s, c) => s + c.members_at_risk, 0);
  const selBookings = sel.reduce((s, c) => s + c.bookings_at_risk_usd, 0);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const act = () => {
    if (crewIds.length === 0) return;
    if (onAct) onAct(crewIds);
    else if (story) story.goTo("ACT", { crewIds });
    else setInlineAct(true);
  };

  return (
    <section className={`v2-card flex flex-col gap-4 p-5 text-[var(--text)] ${className ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-[var(--text-faint)]">Section C</div>
          <h3 className="mt-1 text-[18px] font-semibold tracking-tight">
            Crews that lost a core member {days === 7 ? "this week" : `in ${days} days`}
          </h3>
          {data?.as_of && <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">{fmtAsOf(data.as_of)}</div>}
        </div>
        <motion.button
          type="button"
          layout
          transition={springs.snappy}
          onClick={() => setShowSql((s) => !s)}
          className="v2-press flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px]"
          aria-expanded={showSql}
        >
          <span className={styles.liveDot} />
          <Database size={12} className="text-[var(--accent-2)]" />
          <span>Spanner + BigQuery · 1 query</span>
          {data && <span className="v2-tabular text-[var(--text-faint)]">{data.latency_ms} ms</span>}
          <motion.span animate={{ rotate: showSql ? 180 : 0 }} transition={springs.snappy} className="flex">
            <ChevronDown size={13} />
          </motion.span>
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {showSql && data && (
          <motion.div
            key="sql"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: ease.drawer }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              <SqlBlock sql={data.query_sql} />
              <div className="v2-tabular flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-faint)]">
                <span>engines: {data.engines.join(" + ")}</span>
                <span>@days = {data.query_params.days}</span>
                <span>connection: {data.connection}</span>
                {data.bigquery_job_id && <span>job: {data.bigquery_job_id}</span>}
                <span>{(data.bytes_processed / 1e6).toFixed(1)} MB scanned</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="rounded-[var(--radius-md)] bg-[var(--bad-soft)] px-3 py-2 text-[12px] text-[var(--bad)]">
          <div className="font-medium">
            {error.service ?? "error"} · HTTP {error.status}
          </div>
          <div className="mt-1 break-words opacity-90">{error.message}</div>
          {error.missingResource && <div className="mt-1 opacity-80">Missing: {error.missingResource}</div>}
        </div>
      )}

      {!data && loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="v2-skeleton h-10" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[26px] font-semibold leading-none">
                <Ticker value={data.totals.crews} />
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-faint)]">crews</div>
            </div>
            <div>
              <div className="text-[26px] font-semibold leading-none text-[var(--warn)]">
                <Ticker value={data.totals.members_at_risk} />
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-faint)]">crewmates fading</div>
            </div>
            <div>
              <div className="text-[26px] font-semibold leading-none text-[var(--accent)]">
                <Ticker value={data.totals.bookings_at_risk_usd} format={fmtUsd} />
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-faint)]">90d bookings at risk</div>
            </div>
          </div>

          <div className="grid grid-cols-[18px_minmax(0,1.5fr)_minmax(0,1.2fr)_64px_64px_72px] items-center gap-3 px-2 text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            <span />
            <span>Crew</span>
            <span>Core member lost</span>
            <span className="text-right">At risk</span>
            <span>6 wk</span>
            <span className="text-right">Bookings</span>
          </div>

          <Reveal className="-mt-2 flex max-h-[380px] flex-col overflow-y-auto" stagger={0.04} y={6}>
            {data.crews.map((c, i) => {
              const on = selected.has(c.clan_id);
              return (
                <div key={c.clan_id}>
                  <motion.button
                    type="button"
                    onClick={() => toggle(c.clan_id)}
                    aria-pressed={on}
                    className={`${styles.row} grid w-full grid-cols-[18px_minmax(0,1.5fr)_minmax(0,1.2fr)_64px_64px_72px] items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-[5px] border transition-[background-color,border-color] duration-150 ${
                        on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-strong)]"
                      }`}
                    >
                      {on && <Check size={11} strokeWidth={3} className="text-[var(--text-on-accent)]" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">{c.name}</span>
                      <span className="block truncate text-[11px] text-[var(--text-faint)]">
                        {c.tier ?? "Crew"} · {c.crewmates} crewmates
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] text-[var(--text-dim)]">{c.lost_player.gamer_tag}</span>
                      <span className="v2-tabular block text-[11px] text-[var(--text-faint)]">
                        centrality {c.centrality.toFixed(2)}
                      </span>
                    </span>
                    <span className="v2-tabular text-right text-[13px] text-[var(--warn)]">{c.members_at_risk}</span>
                    <Sparkline values={c.retention_trend} delay={0.25 + i * 0.04} />
                    <span className="v2-tabular text-right text-[13px]">{fmtUsd(c.bookings_at_risk_usd)}</span>
                  </motion.button>
                </div>
              );
            })}
          </Reveal>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <div className="v2-tabular text-[12px] text-[var(--text-dim)]">
              {crewIds.length} selected · {selAtRisk} fading · {fmtUsd(selBookings)}
            </div>
            <Pressable
              onClick={act}
              disabled={crewIds.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] disabled:opacity-50"
            >
              Act
              <motion.span
                className="flex"
                initial={false}
                whileHover={reduce ? undefined : { transform: "translateX(2px)" }}
                transition={springs.snappy}
              >
                <ArrowRight size={14} />
              </motion.span>
            </Pressable>
          </div>

          <AnimatePresence initial={false}>
            {inlineAct && (
              <motion.div
                key="inline-act"
                initial={{ opacity: 0, transform: "translateY(6px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: ease.out }}
              >
                <CrewActButtons kind="crews" ids={crewIds} label={`Crews that lost a core member (${crewIds.length})`} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </section>
  );
}
