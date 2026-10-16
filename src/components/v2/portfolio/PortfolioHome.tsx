"use client";

/**
 * <PortfolioHome /> Take-Two portfolio command center (label = "t2").
 *
 * Reads GET /api/v2/portfolio (live Spanner graph + one Gemini headline):
 *   1. Greeting + portfolio briefing (Gemini headline, KPI tickers)
 *   2. Prompt bar (same live NL -> GQL path as the 2K Home)
 *   3. Labels: 2K (live, opens the Courtside storyline), Rockstar Games and
 *      Zynga shown as "no data source connected" (nothing is invented)
 *   4. Franchise tiles: primary players, lifetime spend, churn rate, lifecycle
 *   5. Cross-title overlap heatmap: who also plays what
 *
 * Errors render the real service + message (no fallback numbers).
 * Atmosphere: the same particle field as 2K Home in the monochrome palette.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, useIsPresent, useReducedMotion } from "framer-motion";
import { ArrowRight, Database, Lock, Sparkles } from "lucide-react";
import type { PortfolioFranchise, PortfolioResponse } from "@/app/api/v2/portfolio/route";
import { Reveal, RevealItem, Ticker, ease } from "../motion";
import { ParticleField } from "../home/ParticleField";
import { PromptBar } from "../home/PromptBar";
import type { HomeProps } from "../home/Home";
import { T2Mark } from "../shell/LabelSwitcher";

const GROUP_NAME: Record<string, string> = { "2K": "NBA 2K", "2K_SPORTS": "2K Sports", "2K_CORE": "2K Core" };

const SHORT: Record<string, string> = {
  NBA2K: "2K27",
  NBA2K26: "2K26",
  NBA2KMOBILE: "Mobile",
  WWE2K: "WWE",
  PGA2K: "PGA",
  TOPSPIN: "TopSpin",
  BL4: "BL4",
  CIV7: "Civ VII",
  MAFIA: "Mafia",
};

const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`);

interface ApiError {
  status: number;
  service?: string;
  resource?: string | null;
  message: string;
}

function usePortfolio() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      const res = await fetch("/api/v2/portfolio", { signal: ac.signal, cache: "no-store" });
      const body = await res.json().catch(() => ({ message: `HTTP ${res.status} with a non-JSON body` }));
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setError({ status: res.status, service: body.service, resource: body.resource, message: body.message ?? body.error ?? "request failed" });
        return;
      }
      setData(body as PortfolioResponse);
    })().catch((e) => {
      if (e?.name !== "AbortError") setError({ status: 0, message: String(e?.message ?? e) });
    });
    return () => ac.abort();
  }, []);
  return { data, error };
}

/* --------------------------------------------------------------- sections */

function Greeting({ name }: { name: string }) {
  const reduce = useReducedMotion();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: ease.out }}
          className="mb-2 flex items-center gap-2 text-[13px] text-[var(--text-faint)]"
          suppressHydrationWarning
        >
          <span>{today}</span>
          <span className="h-1 w-1 rounded-full bg-[var(--text-faint)]" />
          <span>Take-Two Interactive</span>
        </motion.div>
        <motion.h1
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: ease.out, delay: 0.05 }}
          className="text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--text)]"
        >
          Welcome back, {name}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-2 text-[15px] text-[var(--text-dim)]"
        >
          Portfolio command center. Every number is live from the player graph.
        </motion.p>
      </div>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.9, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.2 }}
        className="hidden md:block"
      >
        <T2Mark src="/brands/t2/t2-logo-full.svg" className="h-[84px] w-[100px]" />
      </motion.div>
    </div>
  );
}

function Kpi({ label, value, format, sub, delay }: { label: string; value: number; format?: (n: number) => string; sub?: string; delay: number }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] uppercase tracking-[0.08em] text-[var(--text-faint)]">{label}</div>
      <div className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.02em] text-[var(--text)] v2-tabular">
        <Ticker value={value} delay={delay} format={format} />
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-[var(--text-dim)]">{sub}</div>}
    </div>
  );
}

function Briefing({ data }: { data: PortfolioResponse }) {
  const t = data.totals;
  const asOf = data.as_of ? new Date(data.as_of).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const computed = new Date(data.computed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_80%,transparent)] p-7 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center gap-2.5 text-[12px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-3)] px-2.5 py-1 font-medium text-[var(--text)]">
          <Sparkles size={12} />
          Portfolio briefing
        </span>
        <span className="text-[var(--text-faint)] v2-tabular">
          Spanner Graph · {t.players.toLocaleString()} players{asOf ? ` · as of ${asOf}` : ""} · computed {computed}
          {data.model_used ? ` · ${data.model_used}` : ""}
        </span>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ease.out }}
        className="max-w-[860px] text-[24px] font-medium leading-snug tracking-[-0.015em] text-[var(--text)]"
      >
        {data.headline}
      </motion.p>
      <div className="mt-7 grid grid-cols-2 gap-6 md:grid-cols-5">
        <Kpi label="Players in graph" value={t.players} delay={0.1} />
        <Kpi label="Play 2+ titles" value={t.multi_title_share * 100} format={(n) => `${Math.round(n)}%`} sub={`${t.multi_title_players.toLocaleString()} players`} delay={0.16} />
        <Kpi label="Cross-label" value={t.cross_label_players} sub="play 2+ publishing groups" delay={0.22} />
        <Kpi label="Lifetime spend" value={t.lifetime_spend_usd} format={usd} delay={0.28} />
        <Kpi label="Churned, 14 days" value={t.churned_14d} sub="before the data as-of" delay={0.34} />
      </div>
    </div>
  );
}

function LabelsRow({ data, onOpen2K }: { data: PortfolioResponse; onOpen2K: () => void }) {
  const max = Math.max(...data.labels.map((l) => l.players), 1);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
      <motion.button
        type="button"
        onClick={onOpen2K}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow)] hover:border-[var(--accent-ring)]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brands/2k/2k-logo.svg" alt="" className="h-7 w-7 rounded-[6px]" />
            <div>
              <div className="text-[15px] font-semibold text-[var(--text)]">2K</div>
              <div className="text-[12px] text-[var(--text-faint)]">Live · {data.franchises.length} titles in the graph</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-white shadow-[var(--shadow-accent)]">
            Open 2K Courtside
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {data.labels.map((l, i) => (
            <div key={l.label} className="grid grid-cols-[88px_1fr_56px] items-center gap-3 text-[12px]">
              <span className="text-[var(--text-dim)]">{GROUP_NAME[l.label] ?? l.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <motion.span
                  className="block h-full rounded-full bg-[var(--accent)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(l.players / max) * 100}%` }}
                  transition={{ duration: 0.9, ease: ease.out, delay: 0.2 + i * 0.08 }}
                />
              </span>
              <span className="text-right text-[var(--text)] v2-tabular">{l.players.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </motion.button>

      {[
        { name: "Rockstar Games", letter: "R" },
        { name: "Zynga", letter: "Z" },
      ].map((l) => (
        <div
          key={l.name}
          className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[color-mix(in_oklab,var(--surface)_50%,transparent)] p-5"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[12px] font-semibold text-[var(--text-faint)]">
              {l.letter}
            </span>
            <div className="text-[15px] font-semibold text-[var(--text-dim)]">{l.name}</div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-[12px] text-[var(--text-faint)]">
            <Lock size={12} />
            No data source connected
          </div>
          <div className="mt-1 text-[11.5px] leading-snug text-[var(--text-faint)]">
            Plugs into the same BigQuery lakehouse and Spanner graph when connected.
          </div>
        </div>
      ))}
    </div>
  );
}

function FranchiseTile({ f, i, onExplore }: { f: PortfolioFranchise; i: number; onExplore: (f: PortfolioFranchise) => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={() => onExplore(f)}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 30, delay: reduce ? 0 : 0.04 * i }}
      className="group rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-[var(--border-strong)]"
      title={`Explore ${f.title} players in the graph workspace`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[var(--text)]">{f.title}</div>
          <div className="text-[11.5px] text-[var(--text-faint)]">{GROUP_NAME[f.label] ?? f.label}</div>
        </div>
        {f.lifecycle_status && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
              f.lifecycle_status === "LIVE" ? "bg-[var(--good-soft)] text-[var(--good)]" : "bg-[var(--surface-3)] text-[var(--text-dim)]"
            }`}
          >
            {f.lifecycle_status}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-[22px] font-semibold leading-none text-[var(--text)] v2-tabular">
            <Ticker value={f.players} delay={0.1 + 0.04 * i} />
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-faint)]">primary players</div>
        </div>
        <div className="text-right">
          <div className="text-[14px] font-medium text-[var(--text)] v2-tabular">{usd(f.lifetime_spend_usd)}</div>
          <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">lifetime spend</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px]">
          <span className="text-[var(--text-faint)]">Churned</span>
          <span className="text-[var(--text-dim)] v2-tabular">{Math.round(f.churn_rate * 100)}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: f.churn_rate >= 0.2 ? "var(--bad)" : "var(--text-dim)" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, f.churn_rate * 100 * 2.5)}%` }}
            transition={{ duration: 0.8, ease: ease.out, delay: 0.25 + 0.04 * i }}
          />
        </div>
      </div>
    </motion.button>
  );
}

function OverlapHeatmap({ data }: { data: PortfolioResponse }) {
  const reduce = useReducedMotion();
  const { franchises: order, share, counts } = data.overlap;
  const [hover, setHover] = useState<{ a: number; b: number } | null>(null);
  const titleOf = useMemo(() => new Map(data.franchises.map((f) => [f.franchise, f.title])), [data.franchises]);
  const n = order.length;
  const cell = 44;
  const info =
    hover && hover.a !== hover.b
      ? `${Math.round(share[hover.a][hover.b] * 100)}% of ${titleOf.get(order[hover.a])} players (${(counts[order[hover.a]] ?? 0).toLocaleString()}) also play ${titleOf.get(order[hover.b])}`
      : "Hover a cell: share of the row's players who also play the column's title.";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[15px] font-semibold text-[var(--text)]">Who also plays what</div>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-faint)]">
          <Database size={12} />
          Spanner · Players.franchises_played
        </span>
      </div>
      <div className="mb-5 min-h-[18px] text-[12.5px] text-[var(--text-dim)]">{info}</div>
      <div className="overflow-x-auto">
        <div className="grid w-full min-w-[560px] gap-1.5" style={{ gridTemplateColumns: `80px repeat(${n}, minmax(0, 1fr))` }}>
          <span />
          {order.map((f) => (
            <span key={`h-${f}`} className="pb-1 text-center text-[10.5px] font-medium text-[var(--text-faint)]">
              {SHORT[f] ?? f}
            </span>
          ))}
          {order.map((a, i) => (
            <div key={`r-${a}`} className="contents">
              <span className="flex items-center pr-2 text-[11px] font-medium text-[var(--text-dim)]">{SHORT[a] ?? a}</span>
              {order.map((b, j) => {
                const v = share[i][j];
                const diag = i === j;
                const lit = hover && (hover.a === i || hover.b === j);
                return (
                  <motion.span
                    key={`${a}-${b}`}
                    onMouseEnter={() => setHover({ a: i, b: j })}
                    onMouseLeave={() => setHover(null)}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24, delay: reduce ? 0 : 0.02 * (i + j) }}
                    className="grid place-items-center rounded-[8px] text-[11.5px] font-medium v2-tabular"
                    style={{
                      height: cell - 8,
                      background: diag ? "var(--surface-2)" : `color-mix(in oklab, var(--accent) ${Math.round(Math.min(1, v * 1.6) * 100)}%, var(--surface-2))`,
                      color: diag ? "var(--text-faint)" : v > 0.3 ? "#fff" : "var(--text-dim)",
                      outline: hover && hover.a === i && hover.b === j ? "1.5px solid var(--text)" : lit ? "1px solid var(--border-strong)" : "none",
                    }}
                  >
                    {diag ? "" : `${Math.round(v * 100)}`}
                  </motion.span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="v2-skeleton h-[230px] w-full rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-3 gap-3">
        <div className="v2-skeleton h-[150px] rounded-[var(--radius-lg)]" />
        <div className="v2-skeleton h-[150px] rounded-[var(--radius-lg)]" />
        <div className="v2-skeleton h-[150px] rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export function PortfolioHome({ homeProps, onOpen2K }: { homeProps: HomeProps; onOpen2K: () => void }) {
  const { data, error } = usePortfolio();
  const present = useIsPresent();
  const { onSearch, isSearching, searchError, onDismissSearchError, userName = "Jamie" } = homeProps;

  return (
    <div className="relative">
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, ease: ease.out, delay: 0.15 }}
        className="pointer-events-none absolute inset-x-0 -top-14 h-[1520px]"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
        }}
      >
        <ParticleField className="h-full w-full" palette="mono" active={present} />
      </motion.div>

      <div className="relative mx-auto w-full max-w-[1120px] px-8 pb-20 pt-10">
        <Greeting name={userName} />

        <div className="mt-8">
          {error ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--bad)] bg-[var(--bad-soft)] p-6">
              <div className="text-[13px] font-semibold text-[var(--bad)]">
                Portfolio failed to load{error.service ? ` · ${error.service}` : ""} · HTTP {error.status}
              </div>
              {error.resource && <div className="mt-1 font-mono text-[11.5px] text-[var(--text-dim)]">{error.resource}</div>}
              <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] text-[var(--text)]">{error.message}</pre>
            </div>
          ) : !data ? (
            <Skeleton />
          ) : (
            <Reveal manual className="flex flex-col gap-8" delay={0.1} stagger={0.08} y={14}>
              <RevealItem>
                <Briefing data={data} />
              </RevealItem>

              <RevealItem>
                <PromptBar
                  intent="all"
                  placeholderOverride="Ask anything across the Take-Two portfolio: players, titles, crews, creators"
                  onSubmit={(q) => onSearch(q)} isSearching={isSearching} error={searchError} onDismissError={onDismissSearchError} />
              </RevealItem>

              <RevealItem className="flex flex-col gap-3">
                <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]">Labels</div>
                <LabelsRow data={data} onOpen2K={onOpen2K} />
              </RevealItem>

              <RevealItem className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]">Titles</div>
                  <div className="text-[11.5px] text-[var(--text-faint)]">Click a title to explore its players</div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {data.franchises.map((f, i) => (
                    <FranchiseTile key={f.franchise} f={f} i={i} onExplore={(x) => onSearch(`Highest-value ${x.title} players`, x.franchise)} />
                  ))}
                </div>
              </RevealItem>

              <RevealItem>
                <OverlapHeatmap data={data} />
              </RevealItem>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}

export default PortfolioHome;
