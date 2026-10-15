"use client";

/**
 * Weekly Executive Briefing: three live WoW KPIs from BigQuery plus a Gemini
 * headline. A KPI whose v2 source table is not loaded shows an honest "n/a"
 * pill (with the missing table names on hover), never an estimate.
 */
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Minus } from "lucide-react";
import { Reveal, Ticker, ease } from "../motion";
import { LiveErrorNote, NaPill, SectionHeading } from "./atoms";
import { useLiveJson } from "./useLiveJson";

interface Kpi {
  id: string;
  label: string;
  value: number | null;
  previous: number | null;
  delta_pct: number | null;
  status: "ok" | "n/a";
  unit: "count" | "pct" | "vc";
  good_direction: "up" | "down";
  definition: string;
  missing_tables?: string[];
}

interface Briefing {
  week_of: string;
  as_of: string | null;
  kpis: Kpi[];
  headline: string | null;
  model_used: string | null;
  latency_ms: number;
}

function formatWeek(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function compactVC(n: number) {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function WeeklyBriefingCard() {
  const { data, error, loading, reload } = useLiveJson<Briefing>("/api/insights/weekly-briefing");

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <SectionHeading
        icon={<CalendarDays size={14} strokeWidth={1.75} />}
        title="Weekly executive briefing"
        meta={
          data
            ? `Week of ${formatWeek(data.week_of)}${data.as_of ? ` · data as of ${formatWeek(data.as_of.slice(0, 10))}` : ""} · BigQuery`
            : undefined
        }
      />

      {error && <LiveErrorNote error={error} onRetry={reload} />}

      {loading && !data && (
        <div aria-busy className="space-y-5">
          <div className="v2-skeleton h-5 w-2/3" />
          <div className="grid grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="v2-skeleton h-3 w-28" />
                <div className="v2-skeleton h-9 w-24" />
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          {data.headline && (
            <motion.p
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.45, ease: ease.out }}
              className="mb-5 max-w-[70ch] text-[17px] font-medium leading-[1.4] tracking-[-0.01em] text-[var(--text)]"
            >
              {data.headline}
            </motion.p>
          )}
          <Reveal
            className="grid grid-cols-1 divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
            itemClassName="py-3 sm:px-5 first:sm:pl-0 last:sm:pr-0"
            stagger={0.07}
            y={8}
          >
            {data.kpis.map((k) => (
              <KpiTile key={k.id} k={k} />
            ))}
          </Reveal>
        </>
      )}
    </section>
  );
}

function KpiTile({ k }: { k: Kpi }) {
  const na = k.status === "n/a" || k.value == null;
  return (
    <div title={k.definition}>
      <div className="text-[12.5px] text-[var(--text-dim)]">{k.label}</div>
      <div className="mt-2 flex items-end gap-2.5">
        {na ? (
          <div className="flex h-[38px] items-center gap-2">
            <NaPill title={k.missing_tables?.length ? `Not loaded yet: ${k.missing_tables.join(", ")}` : "Feed unavailable"} />
            <span className="text-[11.5px] text-[var(--text-faint)]">Feed not loaded yet</span>
          </div>
        ) : (
          <>
            <Ticker
              value={k.value as number}
              decimals={k.unit === "pct" ? 1 : 0}
              format={
                k.unit === "pct"
                  ? (n) => `${n.toFixed(1)}%`
                  : k.unit === "vc"
                    ? (n) => compactVC(n)
                    : (n) => Math.round(n).toLocaleString("en-US")
              }
              className="text-[34px] font-semibold leading-none tracking-[-0.03em] text-[var(--text)]"
            />
            {k.unit === "vc" && <span className="mb-1 text-[12px] text-[var(--text-faint)]">VC</span>}
            <DeltaPill delta={k.delta_pct} goodDirection={k.good_direction} previous={k.previous} value={k.value} />
          </>
        )}
      </div>
    </div>
  );
}

function DeltaPill({
  delta,
  goodDirection,
  previous,
  value,
}: {
  delta: number | null;
  goodDirection: "up" | "down";
  previous: number | null;
  value: number | null;
}) {
  // Prior week was zero: a % change is undefined, so show the absolute move.
  if (delta == null && previous === 0 && value != null && value !== 0) {
    const good = (value > 0 && goodDirection === "up") || (value < 0 && goodDirection === "down");
    return (
      <span
        className="mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium v2-tabular"
        style={{ color: good ? "var(--good)" : "var(--bad)", background: good ? "var(--good-soft)" : "var(--bad-soft)" }}
        title="Last week: 0"
      >
        <ArrowUpRight size={12} strokeWidth={2} />
        from 0
      </span>
    );
  }
  if (delta == null) {
    return (
      <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-faint)]">
        <Minus size={11} /> no prior
      </span>
    );
  }
  const up = delta > 0;
  const flat = delta === 0;
  const good = flat ? null : (up && goodDirection === "up") || (!up && goodDirection === "down");
  const color = good == null ? "var(--text-faint)" : good ? "var(--good)" : "var(--bad)";
  const bg = good == null ? "var(--surface-2)" : good ? "var(--good-soft)" : "var(--bad-soft)";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium v2-tabular"
      style={{ color, background: bg }}
    >
      <Icon size={12} strokeWidth={2} />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}
