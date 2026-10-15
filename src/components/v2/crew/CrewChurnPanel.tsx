"use client";

/**
 * <CrewChurnPanel /> Crew · Churn metrics (agenda item "Crew · Churn").
 *
 *  1. Churn exposure: share of a player's co-play neighbors who churned in the
 *     last 14 days (live Spanner GQL over undirected PLAYED_WITH).
 *  2. Anchor dependency: crew retention drop after its most central player
 *     leaves (BigQuery diff-in-diff with a 95% CI).
 *  3. Keystones (Crew MVPs) with declining sessions, "cluster at risk" and a
 *     one-click Pressure-Test -> Dispatch.
 *  4. <CrewTimeline> for the most-split crew: crews split and re-form.
 *
 * Motion: histogram bars grow bar by bar (explanation, once on load, 60ms
 * stagger); the CI whisker draws in then the estimate dot settles; numbers tick;
 * keystone glyphs pulse slowly (CSS, off main thread). Reduced motion: fades only.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Check, RefreshCw } from "lucide-react";
import { Reveal, Ticker, ease } from "@/components/v2/motion";
import type { CrewChurnResponse, CrewFocusGroupHandoff } from "@/lib/v2/crew";
import { useLive, fmtPct, fmtAsOf } from "./api";
import { CrewActButtons, type DispatchResult, type PressureTestResult } from "./CrewActButtons";
import { CrewTimeline } from "./CrewTimeline";
import styles from "./crew.module.css";

export interface CrewChurnPanelProps {
  /** Keystones to list. Default 12. */
  limit?: number;
  onPressureTest?: (handoff: CrewFocusGroupHandoff, result: PressureTestResult) => void;
  onDispatched?: (result: DispatchResult) => void;
  showTimeline?: boolean;
  className?: string;
}

export function KeystoneGlyph({ pulse = true, size = 22 }: { pulse?: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {pulse && (
        <>
          <span className={styles.pulseRing} />
          <span className={`${styles.pulseRing} ${styles.pulseRingDelay}`} />
        </>
      )}
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        {/* keystone: the wedge at the top of an arch */}
        <path d="M6 6 L18 6 L15.5 19 L8.5 19 Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9.5 10.5 L14.5 10.5" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`v2-card flex flex-col gap-4 p-5 ${className ?? ""}`}>{children}</div>;
}

function Eyebrow({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[13px] font-medium text-[var(--text)]">{title}</span>
      {subtitle && <span className="text-[12px] text-[var(--text-faint)]">{subtitle}</span>}
    </div>
  );
}

/* --------------------------- Churn exposure --------------------------- */

function ExposureHistogram({ data }: { data: CrewChurnResponse }) {
  const reduce = !!useReducedMotion();
  const dist = data.churn_exposure_dist;
  const s = data.churn_exposure_summary;
  const maxPlayers = Math.max(1, ...dist.map((d) => d.players));
  const H = 128;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow title="Churn exposure" subtitle="Co-play neighbors churned · last 14d" />
        {s.hazard_ratio !== null && (
          <div className="text-right">
            <div className="text-[28px] font-semibold leading-none text-[var(--accent)]">
              <Ticker value={s.hazard_ratio} decimals={1} suffix="×" />
            </div>
            <div className="v2-tabular mt-1 text-[11px] text-[var(--text-faint)]">
              churn hazard · CI {s.hr_ci_low?.toFixed(1)}–{s.hr_ci_high?.toFixed(1)}
            </div>
          </div>
        )}
      </div>

      <div className="relative flex items-end gap-[6px]" style={{ height: H }}>
        {dist.map((d, i) => {
          const h = d.players === 0 ? 2 : Math.max(4, Math.sqrt(d.players / maxPlayers) * (H - 18));
          const exposed = d.bucket > 0;
          return (
            <div
              key={d.bucket}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${d.label}: ${d.players.toLocaleString("en-US")} active players`}
            >
              <motion.span
                className="v2-tabular text-[10px] text-[var(--text-faint)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: reduce ? 0 : 0.35 + i * 0.06 }}
              >
                {d.players.toLocaleString("en-US")}
              </motion.span>
              <motion.div
                className="w-full rounded-t-[6px]"
                style={{
                  height: h,
                  transformOrigin: "bottom",
                  background: exposed ? "var(--accent-soft)" : "var(--surface-3)",
                  borderTop: exposed ? "1.5px solid var(--accent)" : "1px solid var(--border-strong)",
                }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scaleY(0.04)" }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "scaleY(1)" }}
                transition={{ duration: 0.5, delay: reduce ? 0 : 0.1 + i * 0.06, ease: ease.out }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-[6px]">
        {dist.map((d) => (
          <div key={d.bucket} className="v2-tabular flex-1 text-center text-[10px] text-[var(--text-faint)]">
            {d.label}
          </div>
        ))}
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div>
          <div className="text-[22px] font-semibold leading-none">
            <Ticker value={s.exposed_players} />
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-faint)]">active players exposed now</div>
        </div>
        <div className="v2-tabular text-right text-[11px] text-[var(--text-faint)]">
          {s.events_exposed} / {(s.person_days_exposed / 1000).toFixed(0)}K exposed days
          <br />
          {s.events_unexposed} / {(s.person_days_unexposed / 1000).toFixed(0)}K unexposed
        </div>
      </div>
    </Card>
  );
}

/* --------------------------- Anchor dependency --------------------------- */

function AnchorDependencyCard({ data }: { data: CrewChurnResponse }) {
  const reduce = !!useReducedMotion();
  const a = data.anchor_dependency;
  const lo = Math.min(-60, Math.floor(a.ci_low / 10) * 10);
  const hi = Math.max(10, Math.ceil(a.ci_high / 10) * 10);
  const X = (v: number) => 12 + ((v - lo) / (hi - lo)) * 276;
  const y = 30;

  return (
    <Card>
      <Eyebrow title="Anchor dependency" subtitle="Crew retention drop if they leave" />
      <div className="flex items-end gap-3">
        <div className="text-[44px] font-semibold leading-none tracking-tight text-[var(--text)]">
          <Ticker value={a.lift_pct} decimals={0} format={(n) => fmtPct(n, 0)} />
        </div>
        <div className="v2-tabular pb-1 text-[12px] text-[var(--text-faint)]">
          95% CI {fmtPct(a.ci_low, 0)} to {fmtPct(a.ci_high, 0)}
        </div>
      </div>

      <svg viewBox="0 0 300 56" className="h-auto w-full" role="img" aria-label="Confidence interval">
        <line x1={12} x2={288} y1={y} y2={y} stroke="var(--grid)" strokeWidth="6" strokeLinecap="round" />
        <line x1={X(0)} x2={X(0)} y1={14} y2={46} stroke="var(--border-strong)" strokeDasharray="2 3" />
        <text x={X(0)} y={10} textAnchor="middle" fontSize="9" fill="var(--text-faint)">0</text>
        <motion.path
          d={`M ${X(a.ci_low)} ${y} L ${X(a.ci_high)} ${y}`}
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, delay: reduce ? 0 : 0.2, ease: ease.inOut }}
        />
        {[a.ci_low, a.ci_high].map((v, i) => (
          <motion.line
            key={i}
            x1={X(v)}
            x2={X(v)}
            y1={y - 7}
            y2={y + 7}
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: reduce ? 0 : 0.2 + (i === 0 ? 0.05 : 0.7) }}
          />
        ))}
        <motion.circle
          cx={X(a.lift_pct)}
          cy={y}
          r={6}
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth="2"
          style={{ transformOrigin: `${X(a.lift_pct)}px ${y}px`, transformBox: "view-box" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.6)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "scale(1)" }}
          transition={{ type: "spring", duration: 0.45, bounce: 0.25, delay: reduce ? 0 : 0.9 }}
        />
        <text x={12} y={54} fontSize="9" fill="var(--text-faint)" className="v2-tabular">{lo}%</text>
        <text x={288} y={54} fontSize="9" textAnchor="end" fill="var(--text-faint)" className="v2-tabular">+{hi}%</text>
      </svg>

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2">
          <div className="text-[var(--text-faint)]">Anchor left · baseline → D14</div>
          <div className="v2-tabular text-[var(--text)]">
            {(a.retention_treated_pre * 100).toFixed(0)}% → {(a.retention_treated_post * 100).toFixed(0)}%
          </div>
          <div className="v2-tabular text-[11px] text-[var(--text-faint)]">{a.n_treated} crews</div>
        </div>
        <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2">
          <div className="text-[var(--text-faint)]">Matched · anchor stayed</div>
          <div className="v2-tabular text-[var(--text)]">
            {(a.retention_control_pre * 100).toFixed(0)}% → {(a.retention_control_post * 100).toFixed(0)}%
          </div>
          <div className="v2-tabular text-[11px] text-[var(--text-faint)]">{a.n_control} crews</div>
        </div>
      </div>
      <div className="v2-tabular text-[11px] text-[var(--text-faint)]">
        D14 retention vs matched crews · diff-in-diff {a.did_pp > 0 ? "+" : ""}
        {a.did_pp.toFixed(0)} pts · BigQuery {a.latency_ms} ms
      </div>
    </Card>
  );
}

/* --------------------------- Keystones --------------------------- */

function KeystonesCard({
  data,
  onPressureTest,
  onDispatched,
}: {
  data: CrewChurnResponse;
  onPressureTest?: CrewChurnPanelProps["onPressureTest"];
  onDispatched?: CrewChurnPanelProps["onDispatched"];
}) {
  const ks = data.keystones;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set(ks.map((k) => k.player_id)));
  }, [ks]);
  const ids = useMemo(() => ks.filter((k) => selected.has(k.player_id)).map((k) => k.player_id), [ks, selected]);
  const clusterAtRisk = ks.filter((k) => selected.has(k.player_id)).reduce((s, k) => s + k.cluster_at_risk, 0);
  const toggle = (id: string) =>
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Card className="lg:row-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <KeystoneGlyph />
          <Eyebrow title="Keystone" subtitle="Crew MVP" />
        </div>
        <div className="text-right">
          <div className="text-[22px] font-semibold leading-none text-[var(--accent)]">
            <Ticker value={clusterAtRisk} decimals={1} />
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-faint)]">crewmates at risk</div>
        </div>
      </div>

      <div className="v2-tabular text-[12px] text-[var(--text-dim)]">
        <span className="text-[var(--text)]">{data.keystone_summary.declining}</span> of{" "}
        {data.keystone_summary.keystone_total.toLocaleString("en-US")} keystones fading · sessions down 30%+
      </div>

      <Reveal className="-mx-2 flex max-h-[360px] flex-col overflow-y-auto" stagger={0.04} y={6}>
        {ks.map((k) => {
          const on = selected.has(k.player_id);
          return (
            <div key={`${k.player_id}-${k.clan_id}`}>
              <button
                type="button"
                onClick={() => toggle(k.player_id)}
                className={`${styles.row} flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left`}
                aria-pressed={on}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color] duration-150 ${
                    on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-strong)]"
                  }`}
                >
                  {on && <Check size={11} strokeWidth={3} className="text-[var(--text-on-accent)]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[var(--text)]">{k.gamer_tag}</span>
                  <span className="block truncate text-[11px] text-[var(--text-faint)]">
                    {k.clan_name} · centrality {k.crew_centrality.toFixed(2)}
                  </span>
                </span>
                <span className="v2-tabular w-14 text-right text-[12px] text-[var(--bad)]">
                  {fmtPct((k.session_ratio - 1) * 100, 0)}
                </span>
                <span className="v2-tabular w-12 text-right text-[12px] text-[var(--text)]">{k.cluster_at_risk.toFixed(1)}</span>
              </button>
            </div>
          );
        })}
      </Reveal>
      <div className="flex justify-end gap-[26px] px-2 text-[10px] text-[var(--text-faint)]">
        <span>sessions 7d</span>
        <span>at risk</span>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-[var(--border)] pt-4">
        <div className="text-[12px] text-[var(--text-dim)]">
          {data.retention_offer.title}
        </div>
        <CrewActButtons
          kind="keystones"
          ids={ids}
          label={`Fading keystones (${ids.length})`}
          onPressureTest={onPressureTest}
          onDispatched={onDispatched}
        />
      </div>
    </Card>
  );
}

/* --------------------------- Panel --------------------------- */

export function CrewChurnPanel({ limit = 12, onPressureTest, onDispatched, showTimeline = true, className }: CrewChurnPanelProps) {
  const { data, error, loading, reload } = useLive<CrewChurnResponse>(`/api/v2/crew/churn?limit=${limit}`);

  return (
    <section className={`flex flex-col gap-4 text-[var(--text)] ${className ?? ""}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-[var(--text-faint)]">Crew · Churn</div>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight">Save the keystone, keep the crew.</h2>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[var(--text-dim)]">
          {data && (
            <span className="v2-tabular flex items-center gap-2">
              <Activity size={13} className="text-[var(--good)]" />
              Spanner + BigQuery · {data.latency_ms.total} ms
              <span className="text-[var(--text-faint)]">· {fmtAsOf(data.as_of)}</span>
            </span>
          )}
          <button
            type="button"
            onClick={reload}
            className="v2-press flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-dim)]"
            aria-label="Reload"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="v2-card border-[var(--bad-soft)] p-4 text-[13px] text-[var(--bad)]">
          <div className="font-medium">{error.service ?? "error"} · HTTP {error.status}</div>
          <div className="mt-1 break-words text-[12px] opacity-90">{error.message}</div>
          {error.resource && <div className="mt-1 text-[11px] opacity-70">{error.resource}</div>}
        </div>
      )}

      {!data && loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="v2-skeleton h-[300px]" />
          <div className="v2-skeleton h-[300px]" />
          <div className="v2-skeleton h-[300px]" />
        </div>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ExposureHistogram data={data} />
          <AnchorDependencyCard data={data} />
          <KeystonesCard data={data} onPressureTest={onPressureTest} onDispatched={onDispatched} />
          {showTimeline && (
            <Card className="lg:col-span-2">
              <CrewTimeline
                crewId={data.dynamics.featured_crew_id}
                splits90d={data.dynamics.splits_90d}
                reforms90d={data.dynamics.reforms_90d}
                answer={data.dynamics.answer}
              />
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
