"use client";

/**
 * <PortfolioHome /> Take-Two command center (single landing page).
 *
 * The landing stays short and readable:
 *   1. Greeting
 *   2. 2K Core Finding (live, 2K-only) with "See one player" -> Player 360 drawer
 *   3. Prompt bar (live NL -> GQL over the whole portfolio graph)
 *   4. Across Take-Two: the studio constellation + four one-line insights
 *
 * Every analytic stays one click away in the Analytics sheet (right side):
 *   Reach · Friends · Invites · GTA VI · Titles · Overlap
 * Insight rows open the sheet on their tab. Bridge players open Player 360.
 *
 * Everything reads GET /api/v2/portfolio (live Spanner graph). Errors render
 * the real service + message (no fallback numbers).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, ChevronRight, Code2, Database, Gift, Heart, LayoutGrid, Link2, Network, Users, X } from "lucide-react";
import type { FriendPull, PortfolioFranchise, PortfolioResponse, Studio } from "@/app/api/v2/portfolio/route";
import type { RetentionResponse } from "@/app/api/v2/portfolio/retention/route";
import { Reveal, RevealItem, Ticker, ease } from "../motion";
import { ParticleField } from "../home/ParticleField";
import { PromptBar } from "../home/PromptBar";
import { CoreFindingCard } from "../home/CoreFindingCard";
import type { HomeProps } from "../home/Home";
import { T2Mark } from "../shell/LabelSwitcher";
import { PlaysRow, Playbook } from "../actions/PlaysRow";
import { JOURNEY_STEPS, JourneyWorkspace, type JourneyState, type JourneyStep } from "../journey/JourneyWorkspace";
import type { PlayId } from "@/lib/v2/plays";

/* ------------------------------------------------------------------ studio */

const STUDIO_NAME: Record<Studio, string> = { "2K": "2K", ROCKSTAR: "Rockstar Games", ZYNGA: "Zynga" };
const STUDIO_SHORT: Record<Studio, string> = { "2K": "2K", ROCKSTAR: "Rockstar", ZYNGA: "Zynga" };
/** Studio hues as tokens: 2K = accent, Rockstar = warn (gold), Zynga = good. */
const STUDIO_COLOR: Record<Studio, string> = { "2K": "var(--accent)", ROCKSTAR: "var(--warn)", ZYNGA: "var(--good)" };
const STUDIO_ORDER: Studio[] = ["2K", "ROCKSTAR", "ZYNGA"];

const SHORT: Record<string, string> = {
  NBA2K: "2K27",
  NBA2K26: "2K26",
  NBA2KMOBILE: "2K Mob",
  WWE2K: "WWE",
  PGA2K: "PGA",
  TOPSPIN: "TopSpin",
  BL4: "BL4",
  CIV7: "Civ VII",
  MAFIA: "Mafia",
  GTAO: "GTA O",
  RDO: "RDO",
  GTA6: "GTA VI",
  WWF: "WWF",
  MATCHFACTORY: "Match F",
  TOONBLAST: "Toon B",
  CSR2: "CSR2",
  EMPIRES: "E&P",
  ZPOKER: "Poker",
};

const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;
const int = (n: number) => n.toLocaleString("en-US");

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

/* ------------------------------------------------------------------ atoms */

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]">{children}</div>
      {hint && <div className="text-[11.5px] text-[var(--text-faint)]">{hint}</div>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] ${className}`}>{children}</div>
  );
}

function CardTitle({ icon, title, source }: { icon: React.ReactNode; title: string; source?: string }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--text)]">
        <span className="text-[var(--text-faint)]">{icon}</span>
        {title}
      </div>
      {source && (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
          <Database size={11} />
          {source}
        </span>
      )}
    </div>
  );
}

function StudioDot({ s, size = 8 }: { s: Studio; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: STUDIO_COLOR[s] }} />;
}

function StudioMark({ s }: { s: Studio }) {
  if (s === "2K") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brands/2k/2k-logo.svg" alt="" className="h-8 w-8 rounded-[7px]" />;
  }
  return (
    <span
      className="grid h-8 w-8 place-items-center rounded-[7px] text-[13px] font-bold"
      style={{ background: `color-mix(in oklab, ${STUDIO_COLOR[s]} 22%, var(--surface-2))`, color: STUDIO_COLOR[s] }}
    >
      {s === "ROCKSTAR" ? "R" : "Z"}
    </span>
  );
}

function Bar({ value, max, color, delay = 0, h = 6 }: { value: number; max: number; color: string; delay?: number; h?: number }) {
  return (
    <span className="block w-full overflow-hidden rounded-full bg-[var(--surface-3)]" style={{ height: h }}>
      <motion.span
        className="block h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }}
        transition={{ duration: 0.9, ease: ease.out, delay }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ greeting */

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
          <span>2K · Rockstar Games · Zynga</span>
          <span
            className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-dim)]"
            title="Players and relationships are a synthetic Take-Two sample graph (37,500 players). Every query, model call and dispatch runs live on Google Cloud."
          >
            <span className="v2-live-dot" />
            Synthetic sample graph · live Google Cloud
          </span>
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
          One player. Three labels. One graph.
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

/* ------------------------------------------------------------------ pulse */

function Kpi({ label, value, format, sub, delay }: { label: string; value: number; format?: (n: number) => string; sub?: string; delay: number }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] uppercase tracking-[0.08em] text-[var(--text-faint)]">{label}</div>
      <div className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em] text-[var(--text)] v2-tabular">
        <Ticker value={value} delay={delay} format={format} />
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-[var(--text-dim)]">{sub}</div>}
    </div>
  );
}

function Pulse({ data }: { data: PortfolioResponse }) {
  const t = data.totals;
  const asOf = data.as_of ? new Date(data.as_of).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const computed = new Date(data.computed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <Card className="bg-[color-mix(in_oklab,var(--surface)_80%,transparent)] backdrop-blur-xl">
      <div className="mb-5 flex flex-wrap items-center gap-2.5 text-[12px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-3)] px-2.5 py-1 font-medium text-[var(--text)]">
          <span className="v2-live-dot" />
          Portfolio pulse
        </span>
        <span className="text-[var(--text-faint)] v2-tabular">
          Spanner Graph · {data.source.database}
          {asOf ? ` · as of ${asOf}` : ""} · computed {computed} · {(data.latency_ms / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
        <Kpi label="Players in graph" value={t.players} delay={0.05} />
        <Kpi label="Play 2+ studios" value={t.multi_studio_share * 100} format={(n) => `${Math.round(n)}%`} sub={`${int(t.multi_studio_players)} players`} delay={0.1} />
        <Kpi label="Cross-studio friends" value={t.cross_studio_friendships} sub="friend pairs" delay={0.15} />
        <Kpi label="Invites accepted" value={t.invites_accepted} sub="into another studio" delay={0.2} />
        <Kpi label="Lifetime spend" value={t.spend_usd} format={usd} sub="across all titles" delay={0.25} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ studios */

function StudiosRow({ data }: { data: PortfolioResponse }) {
  const max = Math.max(...data.studios.map((s) => s.players), 1);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {data.studios.map((s, i) => {
        const titles = data.franchises.filter((f) => f.studio === s.studio);
        return (
          <motion.div
            key={s.studio}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.05 * i }}
            className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-40"
              style={{ background: `radial-gradient(closest-side, color-mix(in oklab, ${STUDIO_COLOR[s.studio]} 45%, transparent), transparent)` }}
            />
            <div className="relative flex items-center gap-2.5">
              <StudioMark s={s.studio} />
              <div>
                <div className="text-[15px] font-semibold text-[var(--text)]">{STUDIO_NAME[s.studio]}</div>
                <div className="text-[12px] text-[var(--text-faint)]">
                  {s.titles} titles · {titles.filter((t) => t.lifecycle_status === "PRE_LAUNCH").length ? "incl. pre-launch" : "live"}
                </div>
              </div>
            </div>
            <div className="relative mt-4 flex items-end justify-between">
              <div>
                <div className="text-[26px] font-semibold leading-none text-[var(--text)] v2-tabular">
                  <Ticker value={s.players} delay={0.1 + 0.05 * i} />
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-faint)]">players</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-medium text-[var(--text)] v2-tabular">{usd(s.spend_usd)}</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">lifetime spend</div>
              </div>
            </div>
            <div className="relative mt-3">
              <Bar value={s.players} max={max} color={STUDIO_COLOR[s.studio]} delay={0.2 + 0.05 * i} h={4} />
            </div>
            <div className="relative mt-3 flex justify-between text-[11.5px]">
              <span className="text-[var(--text-dim)]">
                <span className="font-semibold text-[var(--text)] v2-tabular">{pct(s.shared_share)}</span> also play another studio
              </span>
              <span className="text-[var(--text-faint)] v2-tabular">{pct(s.churn_rate)} churned</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ constellation */

const POS: Record<Studio, { x: number; y: number }> = {
  "2K": { x: 210, y: 92 },
  ROCKSTAR: { x: 92, y: 300 },
  ZYNGA: { x: 328, y: 300 },
};

function Constellation({ data }: { data: PortfolioResponse }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const pairs = useMemo(() => {
    const shared = (a: Studio, b: Studio) =>
      Object.entries(data.venn)
        .filter(([k]) => k.split("+").includes(a) && k.split("+").includes(b))
        .reduce((s, [, n]) => s + n, 0);
    const inv = (a: Studio, b: Studio) => data.invites.filter((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a)).reduce((s, r) => s + r.accepted, 0);
    const out: { a: Studio; b: Studio; shared: number; invites: number }[] = [];
    for (let i = 0; i < STUDIO_ORDER.length; i++)
      for (let j = i + 1; j < STUDIO_ORDER.length; j++) {
        const a = STUDIO_ORDER[i];
        const b = STUDIO_ORDER[j];
        out.push({ a, b, shared: shared(a, b), invites: inv(a, b) });
      }
    return out;
  }, [data]);
  const maxShared = Math.max(...pairs.map((p) => p.shared), 1);
  const studio = (s: Studio) => data.studios.find((x) => x.studio === s)!;
  const maxPlayers = Math.max(...data.studios.map((s) => s.players), 1);
  const titles = (s: Studio) => data.franchises.filter((f) => f.studio === s);
  const all3 = data.venn["2K+ROCKSTAR+ZYNGA"] ?? 0;

  const hoverPair = pairs.find((p) => `${p.a}|${p.b}` === hover);
  const info = hoverPair
    ? `${int(hoverPair.shared)} players play both ${STUDIO_NAME[hoverPair.a]} and ${STUDIO_NAME[hoverPair.b]} · ${int(hoverPair.invites)} accepted invites between them`
    : `${int(all3)} players play all three studios. Hover a link.`;

  return (
    <Card className="flex flex-col">
      <CardTitle icon={<Network size={15} />} title="Studio constellation" source="PLAYS_GAME · INVITED" />
      <div className="mb-2 min-h-[34px] text-[12.5px] leading-snug text-[var(--text-dim)]">{info}</div>
      <div className="relative mx-auto w-full max-w-[420px]">
        <svg viewBox="0 0 420 380" className="w-full overflow-visible">
          {/* title satellites */}
          {STUDIO_ORDER.map((s) =>
            titles(s).map((t, k, arr) => {
              const c = POS[s];
              const base = s === "2K" ? -Math.PI / 2 : s === "ROCKSTAR" ? Math.PI * 0.85 : Math.PI * 0.15;
              const spread = Math.PI * (arr.length > 5 ? 1.25 : 0.9);
              const ang = base - spread / 2 + (spread * (k + 0.5)) / arr.length;
              const r = 62 + (k % 2) * 12;
              const x = c.x + Math.cos(ang) * r;
              const y = c.y + Math.sin(ang) * r;
              const sz = 2.5 + Math.sqrt(t.players / Math.max(1, maxPlayers)) * 9;
              return (
                <g key={t.franchise}>
                  <motion.line
                    x1={c.x}
                    y1={c.y}
                    x2={x}
                    y2={y}
                    stroke="var(--grid)"
                    strokeWidth={1}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.5 + k * 0.03 }}
                  />
                  <motion.circle
                    cx={x}
                    cy={y}
                    r={sz}
                    fill={t.lifecycle_status === "PRE_LAUNCH" ? "none" : `color-mix(in oklab, ${STUDIO_COLOR[s]} 55%, var(--surface-3))`}
                    stroke={STUDIO_COLOR[s]}
                    strokeWidth={t.lifecycle_status === "PRE_LAUNCH" ? 1.25 : 0.5}
                    strokeDasharray={t.lifecycle_status === "PRE_LAUNCH" ? "2 2" : undefined}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.6 + k * 0.04 }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  >
                    <title>{`${t.title}: ${int(t.players)} players`}</title>
                  </motion.circle>
                  <motion.text
                    x={x}
                    y={y + sz + 10}
                    textAnchor="middle"
                    className="fill-[var(--text-faint)] text-[8.5px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 + k * 0.03 }}
                  >
                    {SHORT[t.franchise] ?? t.franchise}
                  </motion.text>
                </g>
              );
            }),
          )}
          {/* studio links */}
          {pairs.map((p, i) => {
            const A = POS[p.a];
            const B = POS[p.b];
            const w = 2 + (p.shared / maxShared) * 16;
            const key = `${p.a}|${p.b}`;
            const lit = hover === key;
            const d = `M ${A.x} ${A.y} L ${B.x} ${B.y}`;
            return (
              <g key={key} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                <motion.path
                  d={d}
                  stroke={`color-mix(in oklab, ${STUDIO_COLOR[p.a]} 50%, ${STUDIO_COLOR[p.b]})`}
                  strokeOpacity={lit ? 0.55 : 0.28}
                  strokeWidth={w}
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: ease.out, delay: 0.15 + i * 0.1 }}
                />
                {!reduce && p.invites > 0 && (
                  <motion.path
                    d={d}
                    stroke="var(--text)"
                    strokeOpacity={0.55}
                    strokeWidth={1.25}
                    strokeDasharray="2 10"
                    strokeLinecap="round"
                    fill="none"
                    initial={{ strokeDashoffset: 0, opacity: 0 }}
                    animate={{ strokeDashoffset: -240, opacity: 1 }}
                    transition={{ strokeDashoffset: { duration: 6, repeat: Infinity, ease: "linear" }, opacity: { delay: 1.1 } }}
                  />
                )}
                <path d={d} stroke="transparent" strokeWidth={26} fill="none" />
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 + i * 0.1 }}>
                  <rect x={(A.x + B.x) / 2 - 30} y={(A.y + B.y) / 2 - 10} width={60} height={20} rx={10} fill="var(--surface)" stroke={lit ? "var(--border-strong)" : "var(--border)"} />
                  <text x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 + 4} textAnchor="middle" className="fill-[var(--text)] text-[10.5px] font-semibold">
                    {int(p.shared)}
                  </text>
                </motion.g>
              </g>
            );
          })}
          {/* studio nodes */}
          {STUDIO_ORDER.map((s, i) => {
            const c = POS[s];
            const r = 22 + Math.sqrt(studio(s).players / maxPlayers) * 14;
            return (
              <g key={s}>
                {!reduce && (
                  <motion.circle
                    cx={c.x}
                    cy={c.y}
                    r={r}
                    fill="none"
                    stroke={STUDIO_COLOR[s]}
                    strokeWidth={1}
                    initial={{ opacity: 0.4, scale: 1 }}
                    animate={{ opacity: [0.4, 0], scale: [1, 1.6] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: 1.2 + i * 0.5 }}
                    style={{ transformOrigin: `${c.x}px ${c.y}px` }}
                  />
                )}
                <motion.circle
                  cx={c.x}
                  cy={c.y}
                  r={r}
                  fill={`color-mix(in oklab, ${STUDIO_COLOR[s]} 24%, var(--surface))`}
                  stroke={STUDIO_COLOR[s]}
                  strokeWidth={1.5}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.05 + i * 0.08 }}
                  style={{ transformOrigin: `${c.x}px ${c.y}px` }}
                />
                <text x={c.x} y={c.y - 1} textAnchor="middle" className="fill-[var(--text)] text-[11.5px] font-semibold">
                  {STUDIO_SHORT[s]}
                </text>
                <text x={c.x} y={c.y + 12} textAnchor="middle" className="fill-[var(--text-dim)] text-[9.5px] v2-tabular">
                  {int(studio(s).players)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-[11px] text-[var(--text-faint)]">
        <span>Link width = shared players</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-px w-5 border-t border-dashed border-[var(--text-dim)]" /> invite flow
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border border-dashed border-[var(--warn)]" /> pre-launch
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ friend pull */

function FriendPullCard({ rows: raw }: { rows: FriendPull[] }) {
  const rows = [...raw].sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0));
  const max = Math.max(...rows.map((r) => r.with_friend.rate), 0.01);
  return (
    <Card>
      <CardTitle icon={<Heart size={15} />} title="Friend pull" source="FRIENDS_WITH · PLAYS_GAME" />
      <div className="mb-5 text-[12.5px] leading-snug text-[var(--text-dim)]">
        Share of a studio&apos;s players who play the title, with vs. without at least one friend already in it.
      </div>
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={`${r.source}-${r.franchise}`}>
            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-1.5 font-medium text-[var(--text)]">
                <StudioDot s={r.source} />
                <span className="text-[var(--text-dim)]">{STUDIO_SHORT[r.source]} players</span>
                <ArrowRight size={11} className="text-[var(--text-faint)]" />
                <StudioDot s={r.studio} />
                {r.title}
              </span>
              <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--text)] v2-tabular">
                {r.lift ? `${r.lift.toFixed(1)}x` : "n/a"}
              </span>
            </div>
            <div className="grid grid-cols-[86px_1fr_44px] items-center gap-2 text-[11px]">
              <span className="text-[var(--text-dim)]">with a friend</span>
              <Bar value={r.with_friend.rate} max={max} color={STUDIO_COLOR[r.studio]} delay={0.1 + i * 0.06} />
              <span className="text-right text-[var(--text)] v2-tabular">{pct(r.with_friend.rate, 1)}</span>
              <span className="text-[var(--text-faint)]">without</span>
              <Bar value={r.without_friend.rate} max={max} color="var(--text-faint)" delay={0.15 + i * 0.06} />
              <span className="text-right text-[var(--text-dim)] v2-tabular">{pct(r.without_friend.rate, 1)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-[11px] text-[var(--text-faint)]">
        n = {int(rows.reduce((s, r) => s + r.with_friend.n + r.without_friend.n, 0))} player-title pairs. Association, not a causal estimate.
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ invites */

function InvitesCard({ data }: { data: PortfolioResponse }) {
  const rows = data.invites.filter((r) => r.from !== r.to);
  const max = Math.max(...rows.map((r) => r.sent), 1);
  const invite = data.invite_retention.find((r) => r.via === "FRIEND_INVITE");
  const organic = data.invite_retention.find((r) => r.via === "ORGANIC");
  return (
    <Card>
      <CardTitle icon={<Gift size={15} />} title="Cross-studio invites" source="INVITED" />
      <div className="mb-5 text-[12.5px] leading-snug text-[var(--text-dim)]">Who brings whom into another studio&apos;s title.</div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={`${r.from}-${r.to}`} className="grid grid-cols-[150px_1fr_74px] items-center gap-3 text-[12px]">
            <span className="flex items-center gap-1.5 text-[var(--text)]">
              <StudioDot s={r.from} />
              {STUDIO_SHORT[r.from]}
              <ArrowRight size={11} className="text-[var(--text-faint)]" />
              <StudioDot s={r.to} />
              {STUDIO_SHORT[r.to]}
            </span>
            <span className="relative block">
              <Bar value={r.sent} max={max} color="var(--surface-hover)" delay={0.1 + i * 0.05} h={8} />
              <span className="absolute inset-0">
                <Bar value={r.accepted} max={max} color={STUDIO_COLOR[r.to]} delay={0.3 + i * 0.05} h={8} />
              </span>
            </span>
            <span className="text-right text-[var(--text-dim)] v2-tabular">
              <span className="font-semibold text-[var(--text)]">{int(r.accepted)}</span>/{int(r.sent)}
            </span>
          </div>
        ))}
      </div>
      <RetentionCurves />
      {invite && organic && (
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-faint)]">Churn · joined by invite</div>
            <div className="mt-1 text-[22px] font-semibold text-[var(--text)] v2-tabular">{pct(invite.churn_rate, 1)}</div>
            <div className="text-[11px] text-[var(--text-faint)]">{int(invite.players)} players</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-faint)]">Churn · joined organically</div>
            <div className="mt-1 text-[22px] font-semibold text-[var(--text-dim)] v2-tabular">{pct(organic.churn_rate, 1)}</div>
            <div className="text-[11px] text-[var(--text-faint)]">{int(organic.players)} players</div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ retention (BigQuery) */

const VIA_LABEL: Record<string, string> = { FRIEND_INVITE: "Friend invite", ORGANIC: "Organic", CROSS_PROMO: "Cross-promo", CREATOR: "Creator" };
const VIA_COLOR: Record<string, string> = { FRIEND_INVITE: "var(--good)", ORGANIC: "var(--text-dim)", CROSS_PROMO: "var(--warn)", CREATOR: "var(--accent)" };

function RetentionCurves() {
  const [data, setData] = useState<RetentionResponse | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [showSql, setShowSql] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      const res = await fetch("/api/v2/portfolio/retention", { signal: ac.signal, cache: "no-store" });
      const body = await res.json().catch(() => ({ message: `HTTP ${res.status} with a non-JSON body` }));
      if (ac.signal.aborted) return;
      if (!res.ok) return setErr({ status: res.status, service: body.service, resource: body.resource, message: body.message ?? body.error });
      setData(body as RetentionResponse);
    })().catch((e) => e?.name !== "AbortError" && setErr({ status: 0, message: String(e?.message ?? e) }));
    return () => ac.abort();
  }, []);

  const W = 520;
  const H = 150;
  const pad = { l: 34, r: 12, t: 10, b: 22 };
  const days = data?.curves[0]?.points.map((p) => p.day) ?? [1, 7, 14, 21, 28];
  const maxRate = Math.max(0.05, ...(data?.curves.flatMap((c) => c.points.map((p) => p.rate)) ?? [0.5]));
  const x = (d: number) => pad.l + ((d - days[0]) / Math.max(1, days[days.length - 1] - days[0])) * (W - pad.l - pad.r);
  const y = (r: number) => pad.t + (1 - r / maxRate) * (H - pad.t - pad.b);

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[12.5px] font-medium text-[var(--text)]">Still playing the new title, by week</div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
            <Database size={11} />
            BigQuery · t2_sessions_daily
          </span>
          {data && (
            <button
              type="button"
              onClick={() => setShowSql((v) => !v)}
              className="v2-press inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              {showSql ? <X size={11} /> : <Code2 size={11} />}
              SQL
            </button>
          )}
        </div>
      </div>
      {err ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--bad)] bg-[var(--bad-soft)] p-3 text-[11.5px] text-[var(--text)]">
          <div className="font-semibold text-[var(--bad)]">
            BigQuery failed{err.resource ? ` · ${err.resource}` : ""} · HTTP {err.status}
          </div>
          <div className="mt-1 whitespace-pre-wrap font-mono">{err.message}</div>
        </div>
      ) : !data ? (
        <div className="v2-skeleton h-[150px] w-full rounded-[var(--radius-sm)]" />
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(maxRate * t)} y2={y(maxRate * t)} stroke="var(--grid)" strokeWidth={1} />
                <text x={pad.l - 6} y={y(maxRate * t) + 3} textAnchor="end" className="fill-[var(--text-faint)] text-[9px]">
                  {Math.round(maxRate * t * 100)}%
                </text>
              </g>
            ))}
            {days.map((d) => (
              <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="fill-[var(--text-faint)] text-[9px]">
                day {d}
              </text>
            ))}
            {data.curves.map((c, i) => {
              const hi = c.via === "FRIEND_INVITE" || c.via === "ORGANIC";
              const d = c.points.map((p, k) => `${k ? "L" : "M"} ${x(p.day)} ${y(p.rate)}`).join(" ");
              return (
                <g key={c.via} opacity={hi ? 1 : 0.45}>
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={VIA_COLOR[c.via] ?? "var(--text-faint)"}
                    strokeWidth={hi ? 2.25 : 1.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, ease: ease.out, delay: 0.1 + i * 0.08 }}
                  />
                  {c.points.map((p) => (
                    <circle key={p.day} cx={x(p.day)} cy={y(p.rate)} r={hi ? 2.5 : 1.5} fill={VIA_COLOR[c.via] ?? "var(--text-faint)"}>
                      <title>{`${VIA_LABEL[c.via] ?? c.via} · day ${p.day}: ${pct(p.rate, 1)} of ${int(c.cohort)}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {data.curves.map((c) => (
              <span key={c.via} className="inline-flex items-center gap-1.5 text-[var(--text-dim)]">
                <span className="inline-block h-[3px] w-3 rounded-full" style={{ background: VIA_COLOR[c.via] ?? "var(--text-faint)" }} />
                {VIA_LABEL[c.via] ?? c.via}
                <span className="text-[var(--text-faint)] v2-tabular">n={int(c.cohort)}</span>
              </span>
            ))}
            <span className="ml-auto text-[var(--text-faint)] v2-tabular">
              {(data.latency_ms / 1000).toFixed(1)}s{data.bytes_processed ? ` · ${(data.bytes_processed / 1e6).toFixed(1)} MB scanned` : ""}
            </span>
          </div>
          <AnimatePresence initial={false}>
            {showSql && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: ease.out }}
                className="mt-3 max-h-[260px] overflow-auto whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--bg)] p-3 font-mono text-[10.5px] leading-relaxed text-[var(--text-dim)]"
              >
                {data.query_sql}
              </motion.pre>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ GTA VI */

function Gta6Card({ data }: { data: PortfolioResponse }) {
  const [showQuery, setShowQuery] = useState(false);
  const max = Math.max(...data.gta6.by_studio.map((r) => r.rate), 0.01);
  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-50"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--warn) 40%, transparent), transparent)" }}
      />
      <div className="relative">
        <CardTitle icon={<Link2 size={15} />} title="Grand Theft Auto VI intent" source="WISHLISTED" />
        <div className="mb-4 text-[12.5px] text-[var(--text-dim)]">Wishlists by the player&apos;s home studio. Launches Nov 19.</div>
        <div className="flex items-baseline gap-2">
          <span className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-[var(--text)] v2-tabular">
            <Ticker value={data.gta6.total} delay={0.1} />
          </span>
          <span className="text-[13px] text-[var(--text-dim)]">wishlists in the graph</span>
        </div>
        <div className="mt-5 space-y-2.5">
          {data.gta6.by_studio.map((r, i) => (
            <div key={r.studio} className="grid grid-cols-[96px_1fr_92px] items-center gap-3 text-[12px]">
              <span className="flex items-center gap-1.5 text-[var(--text)]">
                <StudioDot s={r.studio} />
                {STUDIO_SHORT[r.studio]} players
              </span>
              <Bar value={r.rate} max={max} color={STUDIO_COLOR[r.studio]} delay={0.15 + i * 0.06} />
              <span className="text-right text-[var(--text-dim)] v2-tabular">
                <span className="font-semibold text-[var(--text)]">{pct(r.rate)}</span> · {int(r.wishlisted)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-faint)]">3-hop graph path · live</div>
              <div className="mt-1 text-[13px] leading-snug text-[var(--text)]">{data.path.label}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowQuery((v) => !v)}
              className="v2-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              {showQuery ? <X size={12} /> : <Code2 size={12} />}
              GQL
            </button>
          </div>
          <div className="mt-3 flex items-baseline gap-5">
            <span className="text-[13px] text-[var(--text-dim)]">
              <span className="text-[22px] font-semibold text-[var(--text)] v2-tabular">{int(data.path.inviters)}</span> NBA 2K inviters
            </span>
            <span className="text-[13px] text-[var(--text-dim)]">
              <span className="text-[22px] font-semibold text-[var(--text)] v2-tabular">{int(data.path.invitees)}</span> friends with GTA VI wishlisted
            </span>
          </div>
          <AnimatePresence initial={false}>
            {showQuery && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: ease.out }}
                className="mt-3 overflow-hidden whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-dim)]"
              >
                {data.path.query}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ reach + bridges */

function ReachCard({ data }: { data: PortfolioResponse }) {
  const maxSpend = Math.max(...data.spend_by_reach.map((r) => r.avg_spend_usd), 1);
  const one = data.spend_by_reach.find((r) => r.studios === 1);
  const multi = data.spend_by_reach.filter((r) => r.studios >= 2);
  const multiPlayers = multi.reduce((s, r) => s + r.players, 0);
  const multiAvg = multiPlayers ? multi.reduce((s, r) => s + r.avg_spend_usd * r.players, 0) / multiPlayers : 0;
  const lift = one && one.avg_spend_usd ? multiAvg / one.avg_spend_usd : null;
  return (
    <Card>
      <CardTitle icon={<Users size={15} />} title="Value by studio reach" source="PLAYS_GAME.spend_usd" />
      <div className="mb-5 text-[12.5px] text-[var(--text-dim)]">
        {lift ? (
          <>
            Multi-studio players spend <span className="font-semibold text-[var(--text)]">{lift.toFixed(1)}x</span> more per head.
          </>
        ) : (
          "Spend and churn per player by number of studios played."
        )}
      </div>
      <div className="space-y-4">
        {data.spend_by_reach.map((r, i) => (
          <div key={r.studios}>
            <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
              <span className="font-medium text-[var(--text)]">
                {r.studios} studio{r.studios > 1 ? "s" : ""}
                <span className="ml-2 font-normal text-[var(--text-faint)] v2-tabular">{int(r.players)} players</span>
              </span>
              <span className="text-[var(--text-dim)] v2-tabular">
                <span className="font-semibold text-[var(--text)]">{usd(r.avg_spend_usd)}</span> / player · {pct(r.churn_rate)} churned
              </span>
            </div>
            <Bar value={r.avg_spend_usd} max={maxSpend} color={r.studios === 1 ? "var(--text-faint)" : r.studios === 2 ? "var(--accent)" : "var(--text)"} delay={0.1 + i * 0.08} h={8} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function BridgesCard({ data, onOpenPlayer }: { data: PortfolioResponse; onOpenPlayer?: (id: string) => void }) {
  return (
    <Card>
      <CardTitle icon={<Link2 size={15} />} title="Bridge players" source="FRIENDS_WITH" />
      <div className="mb-4 text-[12.5px] text-[var(--text-dim)]">Most friends in other studios. The people who carry players across.</div>
      <div className="divide-y divide-[var(--border)]">
        {data.bridges.map((b, i) => (
          <motion.button
            type="button"
            key={b.player_id}
            onClick={() => onOpenPlayer?.(b.player_id)}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.3, ease: ease.out }}
            className="group flex w-full items-center justify-between gap-3 py-2.5 text-left"
            title={`Open ${b.gamer_tag} in Player 360`}
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-[var(--text)]">{b.gamer_tag}</div>
              <div className="truncate text-[11.5px] text-[var(--text-faint)]">{b.primary_title}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex gap-1">
                {b.studios.map((s) => (
                  <StudioDot key={s} s={s} />
                ))}
              </span>
              <span className="text-right text-[11.5px] text-[var(--text-dim)] v2-tabular">
                <span className="text-[14px] font-semibold text-[var(--text)]">{b.other_studio_friends}</span> friends
                {b.invites_accepted > 0 ? ` · ${b.invites_accepted} invites` : ""}
              </span>
              <ArrowUpRight size={13} className="text-[var(--text-faint)] transition-colors group-hover:text-[var(--text)]" />
            </div>
          </motion.button>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ titles */

function FranchiseTile({ f, i, onExplore }: { f: PortfolioFranchise; i: number; onExplore: (f: PortfolioFranchise) => void }) {
  const reduce = useReducedMotion();
  const pre = f.lifecycle_status === "PRE_LAUNCH";
  return (
    <motion.button
      type="button"
      onClick={() => !pre && onExplore(f)}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={pre ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 30, delay: reduce ? 0 : 0.03 * i }}
      className={`group rounded-[var(--radius)] border bg-[var(--surface)] p-4 text-left ${
        pre ? "cursor-default border-dashed border-[var(--border-strong)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
      }`}
      title={pre ? `${f.title} is pre-launch` : `Explore ${f.title} players in the graph workspace`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[var(--text)]">{f.title}</div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-faint)]">
            <StudioDot s={f.studio} size={6} />
            {STUDIO_NAME[f.studio]}
          </div>
        </div>
        {f.lifecycle_status && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
              f.lifecycle_status === "LIVE" ? "bg-[var(--good-soft)] text-[var(--good)]" : pre ? "bg-[var(--warn-soft)] text-[var(--warn)]" : "bg-[var(--surface-3)] text-[var(--text-dim)]"
            }`}
          >
            {f.lifecycle_status.replace("_", " ")}
          </span>
        )}
      </div>
      {pre ? (
        <div className="mt-3 text-[12px] leading-snug text-[var(--text-dim)]">No players yet. Intent is tracked as WISHLISTED edges.</div>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-[22px] font-semibold leading-none text-[var(--text)] v2-tabular">
                <Ticker value={f.players} delay={0.1 + 0.03 * i} />
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-faint)]">players</div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-medium text-[var(--text)] v2-tabular">{usd(f.spend_usd)}</div>
              <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">spend</div>
            </div>
          </div>
          <div className="mt-3 flex justify-between text-[11px]">
            <span className="text-[var(--text-faint)]">From other studios</span>
            <span className="text-[var(--text)] v2-tabular">
              {pct(f.players ? f.from_other_studios / f.players : 0)}
              {f.via_invite ? <span className="text-[var(--text-faint)]"> · {int(f.via_invite)} by invite</span> : null}
            </span>
          </div>
          <div className="mt-1.5">
            <Bar value={f.from_other_studios} max={f.players} color={STUDIO_COLOR[f.studio]} delay={0.25 + 0.03 * i} h={3} />
          </div>
        </>
      )}
    </motion.button>
  );
}

function OverlapHeatmap({ data }: { data: PortfolioResponse }) {
  const reduce = useReducedMotion();
  const { franchises: order, share, counts } = data.overlap;
  const [hover, setHover] = useState<{ a: number; b: number } | null>(null);
  const meta = useMemo(() => new Map(data.franchises.map((f) => [f.franchise, f])), [data.franchises]);
  const n = order.length;
  const info =
    hover && hover.a !== hover.b
      ? `${Math.round(share[hover.a][hover.b] * 100)}% of ${meta.get(order[hover.a])?.title} players (${int(counts[order[hover.a]] ?? 0)}) also play ${meta.get(order[hover.b])?.title}`
      : "Hover a cell: share of the row's players who also play the column's title.";

  return (
    <Card>
      <CardTitle icon={<Database size={15} />} title="Who also plays what" source="Players.franchises_played" />
      <div className="mb-5 min-h-[18px] text-[12.5px] text-[var(--text-dim)]">{info}</div>
      <div className="overflow-x-auto">
        <div className="grid w-full min-w-[820px] gap-1" style={{ gridTemplateColumns: `68px repeat(${n}, minmax(0, 1fr))` }}>
          <span />
          {order.map((f) => {
            const s = meta.get(f)?.studio ?? "2K";
            return (
              <span key={`h-${f}`} className="flex flex-col items-center gap-1 pb-1 text-center text-[9.5px] font-medium text-[var(--text-faint)]">
                <StudioDot s={s} size={5} />
                {SHORT[f] ?? f}
              </span>
            );
          })}
          {order.map((a, i) => (
            <div key={`r-${a}`} className="contents">
              <span className="flex items-center gap-1.5 pr-1 text-[10.5px] font-medium text-[var(--text-dim)]">
                <StudioDot s={meta.get(a)?.studio ?? "2K"} size={5} />
                {SHORT[a] ?? a}
              </span>
              {order.map((b, j) => {
                const v = share[i][j];
                const diag = i === j;
                const sa = meta.get(a)?.studio;
                const sb = meta.get(b)?.studio;
                const cross = sa !== sb;
                return (
                  <motion.span
                    key={`${a}-${b}`}
                    onMouseEnter={() => setHover({ a: i, b: j })}
                    onMouseLeave={() => setHover(null)}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24, delay: reduce ? 0 : 0.012 * (i + j) }}
                    className="grid h-[30px] place-items-center rounded-[6px] text-[10px] font-medium v2-tabular"
                    style={{
                      background: diag
                        ? "var(--surface-2)"
                        : `color-mix(in oklab, ${cross ? STUDIO_COLOR[sb ?? "2K"] : "var(--accent)"} ${Math.round(Math.min(1, v * 1.6) * 100)}%, var(--surface-2))`,
                      color: diag ? "var(--text-faint)" : v > 0.3 ? "#fff" : "var(--text-dim)",
                      outline: hover && hover.a === i && hover.b === j ? "1.5px solid var(--text)" : "none",
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
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="v2-skeleton h-[150px] w-full rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-3 gap-3">
        <div className="v2-skeleton h-[160px] rounded-[var(--radius-lg)]" />
        <div className="v2-skeleton h-[160px] rounded-[var(--radius-lg)]" />
        <div className="v2-skeleton h-[160px] rounded-[var(--radius-lg)]" />
      </div>
      <div className="v2-skeleton h-[420px] w-full rounded-[var(--radius-lg)]" />
    </div>
  );
}

/* ------------------------------------------------------------------ insights */

type Tab = "reach" | "friends" | "invites" | "gta6" | "titles" | "overlap" | "playbook";
const TABS: { id: Tab; label: string }[] = [
  { id: "reach", label: "Reach" },
  { id: "friends", label: "Friends" },
  { id: "invites", label: "Invites" },
  { id: "gta6", label: "GTA VI" },
  { id: "titles", label: "Titles" },
  { id: "overlap", label: "Overlap" },
  { id: "playbook", label: "Playbook" },
];

interface Insight {
  tab: Tab;
  value: string;
  text: string;
  color: string;
}

function buildInsights(d: PortfolioResponse): Insight[] {
  const one = d.spend_by_reach.find((r) => r.studios === 1);
  const multi = d.spend_by_reach.filter((r) => r.studios >= 2);
  const mp = multi.reduce((s, r) => s + r.players, 0);
  const mAvg = mp ? multi.reduce((s, r) => s + r.avg_spend_usd * r.players, 0) / mp : 0;
  const spendLift = one && one.avg_spend_usd ? mAvg / one.avg_spend_usd : null;
  // Strongest friend pull among well-powered pairs (>= 1,000 players without a friend in the title).
  const gtao = [...d.friend_pull].filter((r) => r.lift && r.without_friend.n >= 1000).sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0))[0] ?? d.friend_pull[0];
  const inv = d.invite_retention.find((r) => r.via === "FRIEND_INVITE");
  const org = d.invite_retention.find((r) => r.via === "ORGANIC");
  const twok = d.gta6.by_studio.find((r) => r.studio === "2K");
  const out: Insight[] = [
    {
      tab: "reach",
      value: pct(d.totals.multi_studio_share),
      text: `of players play two or more studios${spendLift ? `, and spend ${spendLift.toFixed(1)}x more per head` : ""}.`,
      color: "var(--text)",
    },
  ];
  if (gtao?.lift) {
    out.push({
      tab: "friends",
      value: `${gtao.lift.toFixed(1)}x`,
      text: `more likely for a ${STUDIO_SHORT[gtao.source]} player to pick up ${gtao.title} when a friend already plays it.`,
      color: STUDIO_COLOR[gtao.studio],
    });
  }
  if (inv && org && org.churn_rate > 0) {
    out.push({
      tab: "invites",
      value: `${Math.round((1 - inv.churn_rate / org.churn_rate) * 100)}%`,
      text: `lower churn when a friend invites them into another studio (${pct(inv.churn_rate)} vs ${pct(org.churn_rate)}).`,
      color: "var(--good)",
    });
  }
  out.push({
    tab: "gta6",
    value: int(d.gta6.total),
    text: `GTA VI wishlists in the graph${twok ? `, ${pct(twok.rate)} of 2K players among them` : ""}.`,
    color: "var(--warn)",
  });
  return out;
}

function InsightRow({ ins, i, onOpen }: { ins: Insight; i: number; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + i * 0.06, duration: 0.35, ease: ease.out }}
      className="group flex w-full items-center gap-5 rounded-[var(--radius)] px-4 py-4 text-left transition-colors hover:bg-[var(--surface-2)]"
    >
      <span className="w-[92px] shrink-0 text-[30px] font-semibold leading-none tracking-[-0.03em] v2-tabular" style={{ color: ins.color }}>
        {ins.value}
      </span>
      <span className="min-w-0 flex-1 text-[15px] leading-snug text-[var(--text)]">{ins.text}</span>
      <ChevronRight size={16} className="shrink-0 text-[var(--text-faint)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
    </motion.button>
  );
}

function AcrossTakeTwo({ data, onOpen }: { data: PortfolioResponse; onOpen: (t: Tab) => void }) {
  const insights = useMemo(() => buildInsights(data), [data]);
  const computed = new Date(data.computed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]">Across Take-Two</div>
        <button
          type="button"
          onClick={() => onOpen("reach")}
          className="v2-press inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
        >
          <LayoutGrid size={13} />
          All analytics
        </button>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] lg:grid-cols-[400px_1fr]">
        <div className="border-b border-[var(--border)] p-5 lg:border-b-0 lg:border-r">
          <ConstellationMini data={data} />
        </div>
        <div className="flex flex-col justify-center p-3">
          {insights.map((ins, i) => (
            <InsightRow key={ins.tab} ins={ins} i={i} onOpen={() => onOpen(ins.tab)} />
          ))}
          <div className="px-4 pb-1 pt-3 text-[11.5px] text-[var(--text-faint)] v2-tabular">
            {int(data.totals.players)} players · 2K, Rockstar Games, Zynga · Spanner Graph · computed {computed}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The constellation without its card chrome, for the landing. */
function ConstellationMini({ data }: { data: PortfolioResponse }) {
  return (
    <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div]:shadow-none">
      <Constellation data={data} />
    </div>
  );
}

/* ------------------------------------------------------------------ sheets */

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

function AnalyticsSheet({
  data,
  tab,
  onTab,
  onClose,
  onOpenPlayer,
  onExploreTitle,
  onAct,
  playbookKey,
}: {
  data: PortfolioResponse;
  tab: Tab | null;
  onTab: (t: Tab) => void;
  onClose: () => void;
  onOpenPlayer: (id: string) => void;
  onExploreTitle: (f: PortfolioFranchise) => void;
  onAct: (p: PlayId) => void;
  playbookKey: number;
}) {
  const reduce = useReducedMotion();
  useEscape(tab !== null, onClose);
  return (
    <AnimatePresence>
      {tab && (
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[70] bg-[var(--overlay)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
      )}
      {tab && (
          <motion.aside
            key="sheet"
            role="dialog"
            aria-label="Take-Two analytics"
            className="fixed bottom-3 right-3 top-3 z-[71] flex w-[min(940px,calc(100vw-24px))] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)]"
            initial={reduce ? { opacity: 0 } : { x: "104%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "104%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-3">
              <div className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTab(t.id)}
                    className={`relative rounded-full px-3 py-1.5 text-[12.5px] transition-[background-color,color,box-shadow] duration-200 ${
                      tab === t.id
                        ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]"
                        : "text-[var(--text-dim)] hover:text-[var(--text)]"
                    }`}
                  >
                    {/* No layoutId pill: shared-layout nodes inside an exiting AnimatePresence child never release, so the sheet would never unmount. */}
                    <span className="relative">{t.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close analytics"
                className="v2-press grid h-8 w-8 place-items-center rounded-full text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {/* Keyed, enter-only: a nested AnimatePresence here blocks the sheet's own exit. */}
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  className="flex flex-col gap-3"
                >
                  {tab === "reach" && (
                    <>
                      <Pulse data={data} />
                      <StudiosRow data={data} />
                      <ReachCard data={data} />
                    </>
                  )}
                  {tab === "friends" && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FriendPullCard rows={data.friend_pull} />
                      <BridgesCard data={data} onOpenPlayer={onOpenPlayer} />
                    </div>
                  )}
                  {tab === "invites" && <InvitesCard data={data} />}
                  {tab === "gta6" && <Gta6Card data={data} />}
                  {tab === "titles" &&
                    STUDIO_ORDER.map((s) => (
                      <div key={s} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 pt-1 text-[12.5px] font-medium text-[var(--text-dim)]">
                          <StudioDot s={s} />
                          {STUDIO_NAME[s]}
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {data.franchises
                            .filter((f) => f.studio === s)
                            .map((f, i) => (
                              <FranchiseTile key={f.franchise} f={f} i={i} onExplore={onExploreTitle} />
                            ))}
                        </div>
                      </div>
                    ))}
                  {tab === "overlap" && <OverlapHeatmap data={data} />}
                  {tab === "playbook" && <Playbook refreshKey={playbookKey} onAct={onAct} />}
                </motion.div>
            </div>
          </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------- page */

export function PortfolioHome({ homeProps }: { homeProps: HomeProps }) {
  const { data, error } = usePortfolio();
  const present = useIsPresent();
  const { onSearch, isSearching, searchError, onDismissSearchError, userName = "Jamie" } = homeProps;
  const [tab, setTab] = useState<Tab | null>(null);
  const [journey, setJourney] = useState<JourneyState>({ open: false, step: "player", playerId: null, play: null, segment: null });
  const patchJourney = useCallback((patch: Partial<JourneyState>) => setJourney((j) => ({ ...j, ...patch })), []);
  /** Every "go deeper", "see one player" and "act" entry point opens the same workspace. */
  const openJourney = (step: JourneyStep, extra: Partial<JourneyState> = {}) =>
    setJourney({ open: true, step, playerId: null, play: null, segment: null, ...extra });
  const openPlay = (p: PlayId, seg: string | null = null) => openJourney("act", { play: p, segment: seg });
  const [playbookKey, setPlaybookKey] = useState(0);

  // Start the live featured-player lookup (and, server-side, its 2-hop graph) as soon
  // as the landing mounts, so "See one player" opens on a warm Spanner result.
  // Failures are not hidden: Player 360 reruns the request and shows its error.
  useEffect(() => {
    fetch("/api/v2/player/featured", { cache: "no-store" }).catch((e) => console.error("[prefetch] featured player", e));
  }, []);
  // The featured player (id null) is the 2K storyline keystone.
  const openPlayer = (id: string | null) => openJourney("player", { playerId: id });

  return (
    <div className="relative">
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, ease: ease.out, delay: 0.15 }}
        className="pointer-events-none absolute inset-x-0 -top-14 h-[1200px]"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
        }}
      >
        <ParticleField className="h-full w-full" palette="mono" active={present && !journey.open} />
      </motion.div>

      <div className="relative mx-auto w-full max-w-[1040px] px-8 pb-24 pt-10">
        <Greeting name={userName} />

        {/* Story order follows Ashmita's 2K agenda with a Take-Two layer:
            A core finding -> ask the graph -> across Take-Two -> act; every deeper view opens the one journey workspace (player -> B -> C -> D -> act). */}
        <Reveal manual className="mt-8 flex flex-col gap-8" delay={0.1} stagger={0.08} y={14}>
          <RevealItem className="flex flex-col gap-3">
            <CoreFindingCard eyebrow="2K core finding" onOpenPlayer={() => openPlayer(null)} onLoadCohort={(q, f) => onSearch(q, f)} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11.5px] font-medium uppercase tracking-[0.1em] text-[var(--text-faint)]">Go deeper</span>
              {JOURNEY_STEPS.filter((t) => t.section).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openJourney(t.id)}
                  className="v2-press inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--surface-3)] text-[9.5px] font-bold text-[var(--text-dim)]">{t.section}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </RevealItem>

          <RevealItem>
            <PromptBar
              intent="all"
              placeholderOverride="Ask the graph across 2K, Rockstar Games and Zynga"
              onSubmit={(q) => onSearch(q)}
              isSearching={isSearching}
              error={searchError}
              onDismissError={onDismissSearchError}
            />
          </RevealItem>

          <RevealItem>
            {error ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--bad)] bg-[var(--bad-soft)] p-6">
                <div className="text-[13px] font-semibold text-[var(--bad)]">
                  Portfolio failed to load{error.service ? ` · ${error.service}` : ""} · HTTP {error.status}
                </div>
                {error.resource && <div className="mt-1 font-mono text-[11.5px] text-[var(--text-dim)]">{error.resource}</div>}
                <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] text-[var(--text)]">{error.message}</pre>
              </div>
            ) : !data ? (
              <div className="v2-skeleton h-[420px] w-full rounded-[var(--radius-lg)]" />
            ) : (
              <AcrossTakeTwo data={data} onOpen={setTab} />
            )}
          </RevealItem>

          <RevealItem>
            <PlaysRow onAct={(p) => openPlay(p)} />
          </RevealItem>
        </Reveal>
      </div>

      {data && (
        <AnalyticsSheet
          data={data}
          tab={tab}
          onTab={setTab}
          onClose={() => setTab(null)}
          onOpenPlayer={(id) => openPlayer(id)}
          onExploreTitle={(x) => {
            setTab(null);
            onSearch(`Highest-value ${x.title} players`, x.franchise);
          }}
          onAct={(p) => {
            setTab(null);
            openPlay(p);
          }}
          playbookKey={playbookKey}
        />
      )}
      <JourneyWorkspace
        state={journey}
        onChange={patchJourney}
        onClose={() => setJourney((j) => ({ ...j, open: false }))}
        onOpenInGraph={(nl) => {
          setJourney((j) => ({ ...j, open: false }));
          onSearch(nl);
        }}
        onLaunched={() => setPlaybookKey((k) => k + 1)}
      />
    </div>
  );
}

export default PortfolioHome;
