"use client";

/**
 * <ActionDrawer /> Cross-franchise action loop for one play:
 *   1 Audience (live Spanner Graph) -> 2 Plan (Gemini Offer Designer)
 *   -> 3 Pressure test (synthetic personas hydrated from the audience, SSE)
 *   -> 4 Launch (hold to approve; BigQuery manifest + holdout, Pub/Sub dispatch)
 *
 * Every step shows its live source; errors render the real service + message.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Code2, Database, Loader2, Network, RefreshCw, Rocket, ShieldCheck, Sparkles, Users, X, Zap } from "lucide-react";
import {
  FRANCHISE_TITLE,
  PLAYS,
  STUDIO_NAME,
  kpiOf,
  segmentOf,
  type AudienceResponse,
  type LaunchResponse,
  type PersonaVerdict,
  type PlanResponse,
  type PlanVariant,
  type PlayId,
  type PressureEvent,
  type VariantAggregate,
} from "@/lib/v2/plays";
import { Ticker, ease } from "../motion";

const STEPS = ["Audience", "Plan", "Pressure test", "Launch"] as const;
const VCOLOR: Record<"A" | "B" | "C", string> = { A: "var(--accent)", B: "var(--warn)", C: "var(--good)" };
const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;
const int = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`);
const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface ApiErr {
  status: number;
  service?: string;
  message: string;
  detail?: string | null;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({ message: `HTTP ${res.status} with a non-JSON body` }));
  if (!res.ok) throw { status: res.status, service: body.service, message: body.message ?? body.error ?? "request failed", detail: body.gql ?? null } as ApiErr;
  return body as T;
}

function ErrorBox({ err, onRetry }: { err: ApiErr; onRetry?: () => void }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--bad)] bg-[var(--bad-soft)] p-4 text-[12px]">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-[var(--bad)]">
          {err.service ? `${err.service} · ` : ""}HTTP {err.status}
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry} className="v2-press inline-flex items-center gap-1 text-[var(--text-dim)] hover:text-[var(--text)]">
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>
      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11.5px] text-[var(--text)]">{err.message}</pre>
      {err.detail && <pre className="mt-2 whitespace-pre-wrap font-mono text-[10.5px] text-[var(--text-dim)]">{err.detail}</pre>}
    </div>
  );
}

function SourceTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
      <Database size={11} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ step 1 */

function AudienceStep({
  play,
  segment,
  onSegment,
  data,
  err,
  onRetry,
  onOpenPlayer,
  onOpenInGraph,
}: {
  play: PlayId;
  segment: string;
  onSegment: (s: string) => void;
  data: AudienceResponse | null;
  err: ApiErr | null;
  onRetry: () => void;
  onOpenPlayer: (id: string, franchise?: string) => void;
  onOpenInGraph?: (nl: string) => void;
}) {
  const def = PLAYS[play];
  const [gql, setGql] = useState(false);
  const seg = def.segments.find((s) => s.id === segment) ?? def.segments[0];
  return (
    <div className="flex flex-col gap-5">
      {def.segments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {def.segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSegment(s.id)}
              className={`v2-press rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                s.id === segment ? "border-[var(--text)] bg-[var(--surface-2)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="text-[13.5px] leading-snug text-[var(--text-dim)]">{seg.who}</div>
      {err ? (
        <ErrorBox err={err} onRetry={onRetry} />
      ) : !data ? (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 text-[13px] text-[var(--text-dim)]">
          <Loader2 size={16} className="animate-spin" /> Traversing the player graph in Spanner...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between">
                <div className="text-[11.5px] uppercase tracking-[0.08em] text-[var(--text-faint)]">Audience</div>
                <SourceTag>
                  {data.gql.startsWith("GRAPH") ? "Spanner Graph" : "Spanner"} · {(data.latency_ms / 1000).toFixed(1)}s{data.cache === "hit" ? " · cached" : ""}
                </SourceTag>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[48px] font-semibold leading-none tracking-[-0.03em] text-[var(--text)] v2-tabular">
                  <Ticker value={data.count} />
                </span>
                <span className="text-[14px] text-[var(--text-dim)]">players</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
                {data.stats.avg_signal != null && data.stats.signal_label && (
                  <div>
                    <div className="text-[18px] font-semibold text-[var(--text)] v2-tabular">
                      {data.stats.signal_label.includes("drop") ? pct(data.stats.avg_signal) : data.stats.avg_signal.toFixed(1)}
                    </div>
                    <div className="text-[var(--text-faint)]">avg {data.stats.signal_label}</div>
                  </div>
                )}
                <div>
                  <div className="text-[18px] font-semibold text-[var(--text)] v2-tabular">{usd(data.stats.avg_spend_usd)}</div>
                  <div className="text-[var(--text-faint)]">avg lifetime spend</div>
                </div>
                <div>
                  <div className="text-[18px] font-semibold text-[var(--text)] v2-tabular">{pct(data.stats.avg_churn_risk)}</div>
                  <div className="text-[var(--text-faint)]">avg churn risk</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {data.stats.top_home_titles.map((t) => (
                  <span key={t.franchise} className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] text-[var(--text-dim)]">
                    {t.title} {pct(t.share)}
                  </span>
                ))}
                {data.stats.top_archetypes.map((a) => (
                  <span key={a.name} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-faint)]">
                    {pretty(a.name)} {pct(a.share)}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-2 text-[11.5px] uppercase tracking-[0.08em] text-[var(--text-faint)]">Top of the list · open in Player 360</div>
              <div className="divide-y divide-[var(--border)]">
                {data.sample.slice(0, 6).map((m) => (
                  <button
                    key={m.player_id}
                    type="button"
                    onClick={() => onOpenPlayer(m.player_id, m.primary_franchise)}
                    className="group flex w-full items-center justify-between gap-2 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-[var(--text)]">{m.gamer_tag}</span>
                      <span className="block truncate text-[11px] text-[var(--text-faint)]">{FRANCHISE_TITLE[m.primary_franchise] ?? m.primary_franchise}</span>
                    </span>
                    <span className="shrink-0 text-[11.5px] text-[var(--text-dim)] v2-tabular group-hover:text-[var(--text)]">
                      {m.signal != null ? (data.stats.signal_label?.includes("drop") ? pct(m.signal) : m.signal) : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setGql((v) => !v)}
              className="v2-press inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              {gql ? <X size={12} /> : <Code2 size={12} />} {data.gql.startsWith("GRAPH") ? "GQL" : "SQL"}
            </button>
            {onOpenInGraph && (
              <button
                type="button"
                onClick={() => onOpenInGraph(seg.nl)}
                className="v2-press ml-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text)]"
                title="Ask the same audience in the graph workspace (prompt bar, live Gemini to GQL)"
              >
                <Network size={12} /> Open in graph
              </button>
            )}
            <AnimatePresence initial={false}>
              {gql && (
                <motion.pre
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  className="mt-2 overflow-hidden whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-dim)]"
                >
                  {data.gql}
                </motion.pre>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ step 2 */

function VariantCard({ v, selected, agg, onSelect }: { v: PlanVariant; selected?: boolean; agg?: VariantAggregate; onSelect?: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={`flex h-full flex-col rounded-[var(--radius)] border bg-[var(--surface)] p-4 text-left transition-colors ${
        selected ? "border-[var(--text)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: VCOLOR[v.id] }}>
            {v.id}
          </span>
          <span className="text-[14px] font-semibold text-[var(--text)]">{v.name}</span>
        </span>
        <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--text-dim)]">{v.channel.replace(/_/g, " ")}</span>
      </div>
      <div className="mt-2 text-[12.5px] text-[var(--text-dim)]">{v.hook}</div>
      <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-[13px] leading-snug text-[var(--text)]">&ldquo;{v.message}&rdquo;</div>
      <div className="mt-3 space-y-1 text-[11.5px]">
        <div>
          <span className="text-[var(--text-faint)]">Offer </span>
          <span className="text-[var(--text)]">{v.offer}</span>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Reward when </span>
          <span className="text-[var(--text)]">{v.reward_trigger}</span>
        </div>
      </div>
      <div className="mt-3 text-[11.5px] leading-snug text-[var(--text-faint)]">{v.why}</div>
      {agg && (
        <div className="mt-auto pt-3">
          <div className="flex items-baseline justify-between text-[11.5px]">
            <span className="text-[var(--text-faint)]">Panel score</span>
            <span className="text-[var(--text)] v2-tabular">
              <span className="text-[16px] font-semibold">{agg.mean_score.toFixed(0)}</span> ± {agg.ci95.toFixed(0)} · {pct(agg.share)} prefer
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
            <motion.div className="h-full rounded-full" style={{ background: VCOLOR[v.id] }} initial={{ width: 0 }} animate={{ width: `${agg.mean_score}%` }} transition={{ duration: 0.7, ease: ease.out }} />
          </div>
        </div>
      )}
    </motion.button>
  );
}

function PlanStep({ plan, err, loading, onRetry }: { plan: PlanResponse | null; err: ApiErr | null; loading: boolean; onRetry: () => void }) {
  if (err) return <ErrorBox err={err} onRetry={onRetry} />;
  if (!plan || loading)
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 text-[13px] text-[var(--text-dim)]">
        <Sparkles size={16} className="animate-pulse" /> Offer Designer agent is drafting three variants from the live audience...
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] text-[var(--text-dim)]">Three variants drafted for this audience. The panel will score all three.</div>
        <span className="flex items-center gap-3">
          <SourceTag>
            Gemini · {plan.model_used} · {(plan.latency_ms / 1000).toFixed(1)}s
          </SourceTag>
          <button type="button" onClick={onRetry} className="v2-press inline-flex items-center gap-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text)]">
            <RefreshCw size={12} /> Redraft
          </button>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {plan.variants.map((v) => (
          <VariantCard key={v.id} v={v} />
        ))}
      </div>
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-2 text-[11.5px] uppercase tracking-[0.08em] text-[var(--text-faint)]">Guardrails</div>
        <ul className="space-y-1.5 text-[12.5px] text-[var(--text)]">
          {plan.guardrails.map((g) => (
            <li key={g} className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-[var(--good)]" />
              {g}
            </li>
          ))}
        </ul>
        <div className="mt-3 text-[11.5px] text-[var(--text-faint)]">KPI: {plan.kpi}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 3 */

/** Neural-flow view of the synthetic panel: each real player streams into the
 *  variant they prefer as their verdict arrives; variant nodes grow with votes. */
function PanelFlow({
  personas,
  verdicts,
  plan,
  winner,
}: {
  personas: { player_id: string; gamer_tag: string; home_title: string; archetype: string }[];
  verdicts: PersonaVerdict[];
  plan: PlanResponse;
  winner: "A" | "B" | "C" | null;
}) {
  const reduce = useReducedMotion();
  const W = 960;
  const H = 300;
  const byId = new Map(verdicts.map((v) => [v.player_id, v]));
  const n = Math.max(1, personas.length);
  // One column: labels sit to the left so no edge crosses them.
  const px = (_i: number) => 150;
  const py = (i: number) => 28 + (i + 0.5) * ((H - 44) / n);
  const targets: ("A" | "B" | "C" | "NONE")[] = ["A", "B", "C", "NONE"];
  const tx = 740;
  const ty = (k: number) => 62 + k * ((H - 96) / 3);
  const counts = Object.fromEntries(targets.map((t) => [t, verdicts.filter((v) => v.preferred === t).length])) as Record<string, number>;
  const color = (t: string) => (t === "NONE" ? "var(--text-faint)" : VCOLOR[t as "A" | "B" | "C"]);
  const name = (t: string) => (t === "NONE" ? "None of these" : plan.variants.find((v) => v.id === t)?.name ?? t);
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[radial-gradient(ellipse_at_50%_50%,var(--surface)_0%,var(--bg)_75%)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <text x={14} y={16} textAnchor="start" className="fill-[var(--text-faint)] text-[10px] uppercase tracking-[0.1em]">
          Real players from the audience
        </text>
        <text x={tx + 40} y={16} textAnchor="start" className="fill-[var(--text-faint)] text-[10px] uppercase tracking-[0.1em]">
          Preferred variant
        </text>
        {personas.map((p, i) => {
          const v = byId.get(p.player_id);
          if (!v) return null;
          const k = targets.indexOf(v.preferred);
          const x1 = px(i) + 8;
          const y1 = py(i);
          const x2 = tx - 34;
          const y2 = ty(k);
          const d = `M ${x1} ${y1} C ${x1 + 260} ${y1}, ${x2 - 260} ${y2}, ${x2} ${y2}`;
          return (
            <g key={`e-${p.player_id}`}>
              <motion.path
                d={d}
                fill="none"
                stroke={color(v.preferred)}
                strokeWidth={1.25}
                strokeOpacity={0.45}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduce ? 0 : 0.8, ease: ease.out }}
              />
              {!reduce && (
                <motion.path
                  d={d}
                  fill="none"
                  stroke={color(v.preferred)}
                  strokeWidth={2}
                  strokeDasharray="3 18"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 0, opacity: 0 }}
                  animate={{ strokeDashoffset: -210, opacity: 0.9 }}
                  transition={{ strokeDashoffset: { duration: 2.4, repeat: Infinity, ease: "linear" }, opacity: { delay: 0.6 } }}
                />
              )}
            </g>
          );
        })}
        {personas.map((p, i) => {
          const v = byId.get(p.player_id);
          return (
            <g key={`n-${p.player_id}`}>
              {!v && !reduce && (
                <motion.circle
                  cx={px(i)}
                  cy={py(i)}
                  r={6}
                  fill="none"
                  stroke="var(--text-faint)"
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: [0.6, 0], scale: [1, 2] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: (i % 6) * 0.2 }}
                  style={{ transformOrigin: `${px(i)}px ${py(i)}px` }}
                />
              )}
              <motion.circle
                cx={px(i)}
                cy={py(i)}
                r={5.5}
                fill={v ? color(v.preferred) : "var(--surface-3)"}
                stroke="var(--border-strong)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.03 }}
                style={{ transformOrigin: `${px(i)}px ${py(i)}px` }}
              >
                <title>{`${p.gamer_tag} · ${p.home_title}${v ? ` · prefers ${v.preferred}` : " · thinking"}`}</title>
              </motion.circle>
              <text x={px(i) - 10} y={py(i) + 3} textAnchor="end" className="fill-[var(--text-faint)] text-[9px]">
                {p.gamer_tag.length > 18 ? `${p.gamer_tag.slice(0, 17)}…` : p.gamer_tag}
              </text>
            </g>
          );
        })}
        {targets.map((t, k) => {
          const c = counts[t] ?? 0;
          const r = 14 + Math.sqrt(c) * 6;
          const win = winner === t;
          return (
            <g key={`t-${t}`}>
              {win && !reduce && (
                <motion.circle
                  cx={tx}
                  cy={ty(k)}
                  r={r}
                  fill="none"
                  stroke={color(t)}
                  initial={{ opacity: 0.5, scale: 1 }}
                  animate={{ opacity: [0.5, 0], scale: [1, 1.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ transformOrigin: `${tx}px ${ty(k)}px` }}
                />
              )}
              <motion.circle
                cx={tx}
                cy={ty(k)}
                animate={{ r }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                fill={`color-mix(in oklab, ${color(t)} ${win ? 45 : 22}%, var(--surface))`}
                stroke={color(t)}
                strokeWidth={win ? 2 : 1}
              />
              <text x={tx} y={ty(k) + 4} textAnchor="middle" className="fill-[var(--text)] text-[12px] font-semibold">
                {t === "NONE" ? "–" : t}
              </text>
              <text x={tx + 40} y={ty(k) - 2} className="fill-[var(--text)] text-[11px] font-medium">
                {name(t)}
              </text>
              <text x={tx + 40} y={ty(k) + 12} className="fill-[var(--text-faint)] text-[10px]">
                {c} {c === 1 ? "player" : "players"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TestStep({
  plan,
  personas,
  verdicts,
  agg,
  err,
  running,
  selected,
  onSelect,
  model,
}: {
  plan: PlanResponse;
  personas: { player_id: string; gamer_tag: string; home_title: string; archetype: string }[];
  verdicts: PersonaVerdict[];
  agg: { variants: VariantAggregate[]; winner: "A" | "B" | "C"; none_share: number } | null;
  err: ApiErr | null;
  running: boolean;
  selected: "A" | "B" | "C" | null;
  onSelect: (id: "A" | "B" | "C") => void;
  model: string;
}) {
  const reduce = useReducedMotion();
  const byId = useMemo(() => new Map(verdicts.map((v) => [v.player_id, v])), [verdicts]);
  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox err={err} />}
      <div className="flex items-center justify-between text-[12.5px] text-[var(--text-dim)]">
        <span>
          {personas.length ? `${verdicts.length} of ${personas.length} real players from this audience have reacted.` : "Hydrating personas from the audience in Spanner..."}
          {agg ? ` ${pct(agg.none_share)} would ignore all three.` : ""}
        </span>
        <SourceTag>Spanner personas · Gemini{model ? ` ${model}` : ""}</SourceTag>
      </div>
      {personas.length > 0 && <PanelFlow personas={personas} verdicts={verdicts} plan={plan} winner={agg?.winner ?? null} />}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {personas.map((p, i) => {
          const v = byId.get(p.player_id);
          return (
            <motion.div
              key={p.player_id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex min-h-[112px] flex-col rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[12px] font-medium text-[var(--text)]">{p.gamer_tag}</span>
                {v ? (
                  <span
                    className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: v.preferred === "NONE" ? "var(--surface-3)" : VCOLOR[v.preferred], color: v.preferred === "NONE" ? "var(--text-dim)" : "#fff" }}
                  >
                    {v.preferred === "NONE" ? "none" : v.preferred}
                  </span>
                ) : (
                  <Loader2 size={12} className="animate-spin text-[var(--text-faint)]" />
                )}
              </div>
              <div className="truncate text-[10.5px] text-[var(--text-faint)]">
                {p.home_title} · {pretty(p.archetype)}
              </div>
              <AnimatePresence>
                {v && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[11.5px] leading-snug text-[var(--text-dim)]">
                    &ldquo;{v.quote}&rdquo;
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      {agg && (
        <div>
          <div className="mb-2 text-[12.5px] text-[var(--text)]">
            Winner: <span className="font-semibold">Variant {agg.winner}</span>. Pick the one to launch.
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {plan.variants.map((v) => (
              <VariantCard key={v.id} v={v} agg={agg.variants.find((a) => a.id === v.id)} selected={selected === v.id} onSelect={() => onSelect(v.id)} />
            ))}
          </div>
        </div>
      )}
      {running && !agg && !err && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-faint)]">
          <Loader2 size={13} className="animate-spin" /> Panel running...
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ step 4 */

function HoldToApprove({ onApprove, disabled }: { onApprove: () => void; disabled?: boolean }) {
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const stop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setP(0);
  };
  const begin = () => {
    if (disabled) return;
    start.current = performance.now();
    const tick = (t: number) => {
      const v = Math.min(1, (t - start.current) / 1100);
      setP(v);
      if (v >= 1) {
        raf.current = null;
        onApprove();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onApprove()}
      className="relative h-12 w-full select-none overflow-hidden rounded-full bg-[var(--surface-3)] text-[14px] font-semibold text-[var(--text)] disabled:opacity-50"
    >
      <span className="absolute inset-y-0 left-0 bg-[var(--accent)]" style={{ width: `${p * 100}%` }} />
      <span className="relative inline-flex items-center gap-2">
        <Rocket size={16} /> {p > 0 ? "Keep holding..." : "Hold to approve and launch"}
      </span>
    </button>
  );
}

/** Governance line: which labels are involved, whose consent applies, where data lives. */
function Governance({ play, segment }: { play: PlayId; segment: string }) {
  const seg = segmentOf(play, segment);
  if (!seg) return null;
  const consent: Record<string, string> = {
    "2K": "2K Account marketing consent",
    ROCKSTAR: "Rockstar Games Social Club marketing consent",
    ZYNGA: "Zynga Account marketing consent",
  };
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-[var(--text)]">
        <ShieldCheck size={14} className="text-[var(--good)]" /> Governance
      </div>
      <div className="grid grid-cols-1 gap-3 text-[12px] md:grid-cols-3">
        <div>
          <div className="text-[var(--text-faint)]">Labels involved</div>
          <div className="mt-0.5 text-[var(--text)]">{seg.labels.map((l) => STUDIO_NAME[l]).join(" · ")}</div>
        </div>
        <div>
          <div className="text-[var(--text-faint)]">Consent required before dispatch</div>
          <ul className="mt-0.5 space-y-0.5 text-[var(--text)]">
            {seg.labels.map((l) => (
              <li key={l}>{consent[l]}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[var(--text-faint)]">Where the data lives</div>
          <div className="mt-0.5 text-[var(--text)]">Audience: Spanner Graph. Manifest + readout: BigQuery. Message: Pub/Sub. Friend names are never shared.</div>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-[var(--text-faint)]">
        In this demo the consent check is a checklist; in a pilot it is a filter on each label&apos;s consent table before the manifest is written.
      </div>
    </div>
  );
}

function LaunchStep({
  play,
  segment,
  audience,
  variant,
  holdout,
  onHoldout,
  launching,
  result,
  err,
  onLaunch,
}: {
  play: PlayId;
  segment: string;
  audience: AudienceResponse | null;
  variant: PlanVariant | null;
  holdout: number;
  onHoldout: (n: number) => void;
  launching: boolean;
  result: LaunchResponse | null;
  err: ApiErr | null;
  onLaunch: () => void;
}) {
  const def = PLAYS[play];
  if (result) {
    const t = result.balance.find((b) => b.arm === "treatment");
    const c = result.balance.find((b) => b.arm === "control");
    return (
      <div className="flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[var(--radius)] border border-[var(--good)] bg-[var(--good-soft)] p-5"
        >
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
            <Check size={16} className="text-[var(--good)]" /> Launched · {result.action_id}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-[12px] md:grid-cols-4">
            <div>
              <div className="text-[22px] font-semibold text-[var(--text)] v2-tabular">{int(result.treatment_n)}</div>
              <div className="text-[var(--text-faint)]">treatment</div>
            </div>
            <div>
              <div className="text-[22px] font-semibold text-[var(--text)] v2-tabular">{int(result.control_n)}</div>
              <div className="text-[var(--text-faint)]">holdout ({result.holdout_pct}%)</div>
            </div>
            <div>
              <div className="font-mono text-[12px] text-[var(--text)]">{result.pubsub.message_id}</div>
              <div className="text-[var(--text-faint)]">Pub/Sub · {result.pubsub.topic}</div>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[var(--text)]">{result.readout_date}</div>
              <div className="text-[var(--text-faint)]">readout date</div>
            </div>
          </div>
        </motion.div>
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12.5px] font-medium text-[var(--text)]">Balance check · treatment vs. holdout before launch</div>
            <SourceTag>BigQuery · {result.bigquery.assignments_table} ⨝ t2_players</SourceTag>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[12px]">
            <span className="text-[var(--text-faint)]" />
            <span className="text-[var(--text-faint)]">Avg spend</span>
            <span className="text-[var(--text-faint)]">Avg churn risk</span>
            <span className="text-[var(--text-faint)]">Avg minutes, 7d</span>
            {[t, c].map((b) =>
              b ? (
                <div key={b.arm} className="contents">
                  <span className="text-[var(--text)]">
                    {b.arm} <span className="text-[var(--text-faint)]">n={int(b.n)}</span>
                  </span>
                  <span className="text-[var(--text)] v2-tabular">{usd(b.avg_spend_usd)}</span>
                  <span className="text-[var(--text)] v2-tabular">{pct(b.avg_churn_risk, 1)}</span>
                  <span className="text-[var(--text)] v2-tabular">{Math.round(b.avg_session_min_7d)}</span>
                </div>
              ) : null,
            )}
          </div>
          <div className="mt-3 text-[11.5px] text-[var(--text-faint)]">
            KPI measured at readout: {result.kpi.replace(/\.$/, "")}. Lift is read from BigQuery against this holdout; nothing is estimated at launch.
          </div>
          <div className="mt-2 text-[11.5px] text-[var(--text-faint)]">
            Delivery: the activation is on the Pub/Sub topic with the treatment manifest in BigQuery. Each label&apos;s channel adapter (2K inbox and push, Rockstar
            Newswire, Zynga cross-promo) subscribes to that topic in a pilot; in this demo no message reaches a player.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox err={err} />}
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="text-[11.5px] uppercase tracking-[0.08em] text-[var(--text-faint)]">You are launching</div>
        <div className="mt-2 text-[16px] font-semibold text-[var(--text)]">
          {def.name} · {def.segments.find((s) => s.id === segment)?.label}
        </div>
        {variant && (
          <div className="mt-2 text-[13px] text-[var(--text-dim)]">
            Variant {variant.id} · {variant.name} via {variant.channel.replace(/_/g, " ")}: &ldquo;{variant.message}&rdquo;
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="flex justify-between text-[12px]">
              <span className="text-[var(--text-dim)]">Holdout (no message, for measurement)</span>
              <span className="font-semibold text-[var(--text)] v2-tabular">{holdout}%</span>
            </div>
            <input type="range" min={10} max={50} step={5} value={holdout} onChange={(e) => onHoldout(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" />
            {audience && (
              <div className="mt-1 text-[11.5px] text-[var(--text-faint)] v2-tabular">
                about {int(Math.round(audience.count * (1 - holdout / 100)))} treated · {int(Math.round((audience.count * holdout) / 100))} held out
              </div>
            )}
          </div>
          <div className="text-[12px] leading-relaxed text-[var(--text-dim)]">
            On approval: the audience is re-read from Spanner, every player is randomized into treatment or holdout, the manifest is written to BigQuery, and the
            activation is published to Pub/Sub. KPI: {kpiOf(play, segment).replace(/\.$/, "")}.
          </div>
        </div>
      </div>
      <Governance play={play} segment={segment} />
      {launching ? (
        <div className="flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--surface-3)] text-[13px] text-[var(--text-dim)]">
          <Loader2 size={15} className="animate-spin" /> Writing manifest to BigQuery and publishing to Pub/Sub...
        </div>
      ) : (
        <HoldToApprove onApprove={onLaunch} disabled={!variant} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ drawer */

export interface ForPlayerContext {
  gamer_tag: string;
  matches: { play: PlayId; segment: string; label: string; audience_count: number; signal: number | null; signal_label: string | null }[];
  error?: string;
}

/** Why this play is open: the player from Player 360 and the audiences they actually belong to. */
function ForPlayerBanner({ ctx, play, segment, onSwitch }: { ctx: ForPlayerContext; play: PlayId; segment: string; onSwitch: (p: PlayId, s: string) => void }) {
  const here = ctx.matches.find((m) => m.play === play && m.segment === segment);
  const others = ctx.matches.filter((m) => !(m.play === play && m.segment === segment));
  return (
    <div className="mb-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[12.5px]">
      {ctx.error ? (
        <div className="text-[var(--bad)]">Could not check {ctx.gamer_tag}&apos;s audiences: {ctx.error}</div>
      ) : here ? (
        <div className="text-[var(--text)]">
          <span className="font-semibold">{ctx.gamer_tag}</span> is in this audience
          {here.signal != null && here.signal_label ? (
            <span className="text-[var(--text-dim)]">
              {" "}
              · {here.signal_label}: {here.signal_label.includes("drop") ? `${Math.round(here.signal * 100)}%` : here.signal}
            </span>
          ) : null}
          <span className="text-[var(--text-dim)]"> · these are the players like them.</span>
        </div>
      ) : ctx.matches.length === 0 ? (
        <div className="text-[var(--text-dim)]">
          <span className="font-semibold text-[var(--text)]">{ctx.gamer_tag}</span> isn&apos;t in any of today&apos;s play audiences. Showing the warm-intro direction for their label.
        </div>
      ) : (
        <div className="text-[var(--text-dim)]">
          <span className="font-semibold text-[var(--text)]">{ctx.gamer_tag}</span> isn&apos;t in this audience.
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-[var(--text-faint)]">Also in</span>
          {others.map((m) => (
            <button
              key={`${m.play}-${m.segment}`}
              type="button"
              onClick={() => onSwitch(m.play, m.segment)}
              className="v2-press rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              {m.label} · {m.audience_count.toLocaleString()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActionDrawer({
  play,
  initialSegment,
  forPlayer,
  onSwitch,
  onClose,
  onOpenPlayer,
  onOpenInGraph,
  onLaunched,
}: {
  play: PlayId | null;
  initialSegment?: string | null;
  forPlayer?: ForPlayerContext | null;
  onSwitch?: (p: PlayId, segment: string) => void;
  onClose: () => void;
  onOpenPlayer: (id: string, franchise?: string) => void;
  onOpenInGraph?: (nl: string) => void;
  onLaunched?: () => void;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [segment, setSegment] = useState("");
  const [audience, setAudience] = useState<AudienceResponse | null>(null);
  const [audErr, setAudErr] = useState<ApiErr | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [planErr, setPlanErr] = useState<ApiErr | null>(null);
  const [planning, setPlanning] = useState(false);
  const [personas, setPersonas] = useState<{ player_id: string; gamer_tag: string; home_title: string; archetype: string }[]>([]);
  const [verdicts, setVerdicts] = useState<PersonaVerdict[]>([]);
  const [agg, setAgg] = useState<{ variants: VariantAggregate[]; winner: "A" | "B" | "C"; none_share: number } | null>(null);
  const [testErr, setTestErr] = useState<ApiErr | null>(null);
  const [testing, setTesting] = useState(false);
  const [model, setModel] = useState("");
  const [selected, setSelected] = useState<"A" | "B" | "C" | null>(null);
  const [holdout, setHoldout] = useState(20);
  const [launching, setLaunching] = useState(false);
  const [launchErr, setLaunchErr] = useState<ApiErr | null>(null);
  const [result, setResult] = useState<LaunchResponse | null>(null);
  const testAbort = useRef<AbortController | null>(null);

  const resetAfter = useCallback((from: number) => {
    if (from <= 1) {
      setPlan(null);
      setPlanErr(null);
    }
    if (from <= 2) {
      testAbort.current?.abort();
      setPersonas([]);
      setVerdicts([]);
      setAgg(null);
      setTestErr(null);
      setSelected(null);
    }
    setResult(null);
    setLaunchErr(null);
  }, []);

  // Open / switch play.
  useEffect(() => {
    if (!play) return;
    setStep(0);
    setSegment(initialSegment && PLAYS[play].segments.some((s) => s.id === initialSegment) ? initialSegment : PLAYS[play].segments[0].id);
    resetAfter(0);
  }, [play, initialSegment, resetAfter]);

  // Audience.
  const loadAudience = useCallback(() => {
    // Skip the one render where the segment still belongs to the previous play.
    if (!play || !PLAYS[play].segments.some((s) => s.id === segment)) return;
    setAudience(null);
    setAudErr(null);
    call<AudienceResponse>(`/api/v2/actions/audience?play=${play}&segment=${encodeURIComponent(segment)}`)
      .then(setAudience)
      .catch((e) => setAudErr(e));
  }, [play, segment]);
  useEffect(loadAudience, [loadAudience]);

  const draft = useCallback(() => {
    if (!play) return;
    setPlanning(true);
    setPlanErr(null);
    call<PlanResponse>("/api/v2/actions/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ play, segment }) })
      .then((p) => setPlan(p))
      .catch((e) => setPlanErr(e))
      .finally(() => setPlanning(false));
  }, [play, segment]);

  const runTest = useCallback(async () => {
    if (!play || !plan) return;
    testAbort.current?.abort();
    const ac = new AbortController();
    testAbort.current = ac;
    setTesting(true);
    setPersonas([]);
    setVerdicts([]);
    setAgg(null);
    setTestErr(null);
    try {
      const res = await fetch("/api/v2/actions/pressure-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ play, segment, variants: plan.variants, n: 16 }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const b = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw { status: res.status, service: b.service, message: b.message ?? b.error, detail: b.gql ?? null } as ApiErr;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          const ev = JSON.parse(line) as PressureEvent;
          if (ev.type === "cohort") setPersonas(ev.personas);
          else if (ev.type === "verdict") setVerdicts((v) => [...v, ev.verdict]);
          else if (ev.type === "aggregate") {
            setAgg({ variants: ev.variants, winner: ev.winner, none_share: ev.none_share });
            setSelected(ev.winner);
          } else if (ev.type === "done") setModel(ev.model);
          else if (ev.type === "error") setTestErr({ status: 502, service: ev.service, message: `${ev.phase}: ${ev.message}` });
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setTestErr((e as ApiErr).status !== undefined ? (e as ApiErr) : { status: 0, message: String((e as Error)?.message ?? e) });
    } finally {
      setTesting(false);
    }
  }, [play, plan, segment]);

  const launch = useCallback(() => {
    if (!play || !plan || !selected) return;
    const variant = plan.variants.find((v) => v.id === selected)!;
    setLaunching(true);
    setLaunchErr(null);
    call<LaunchResponse>("/api/v2/actions/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ play, segment, variant, holdout_pct: holdout }),
    })
      .then((r) => {
        setResult(r);
        onLaunched?.();
      })
      .catch((e) => setLaunchErr(e))
      .finally(() => setLaunching(false));
  }, [play, plan, selected, segment, holdout, onLaunched]);

  // Step transitions trigger their work once.
  const go = (n: number) => {
    setStep(n);
    if (n === 1 && !plan && !planning) draft();
    if (n === 2 && !agg && !testing) void runTest();
  };

  useEffect(() => {
    if (!play) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [play, onClose]);

  const def = play ? PLAYS[play] : null;
  const canNext = step === 0 ? !!audience && audience.count > 0 : step === 1 ? !!plan && !planning : step === 2 ? !!agg && !!selected : false;
  const nextLabel = step === 0 ? "Draft the plan" : step === 1 ? "Pressure-test with 16 players" : "Review launch";

  return (
    <>
    <AnimatePresence>
      {play && (
        <motion.div
          key="act-scrim"
          className="fixed inset-0 z-[75] bg-[var(--overlay)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        />
      )}
    </AnimatePresence>
      {/* Enter animation only. Layout-animated children (variant cards, flow) can keep an
          exiting AnimatePresence child alive, leaving the scrim stuck; unmount instantly instead. */}
      {play && def && (
        <motion.aside
          key="act-sheet"
          role="dialog"
          aria-label={`${def.name} action`}
          className="fixed bottom-3 right-3 top-3 z-[76] flex w-[min(1040px,calc(100vw-24px))] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)]"
          initial={reduce ? { opacity: 0 } : { x: "104%" }}
          animate={reduce ? { opacity: 1 } : { x: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                <Zap size={12} /> Cross-franchise action
              </div>
              <div className="mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                {def.name} <span className="font-normal text-[var(--text-dim)]">· {def.hook}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close action"
              className="v2-press grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <X size={16} />
            </button>
          </div>

          {/* stepper */}
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-6 py-3">
            {STEPS.map((s, i) => {
              const done = i < step || (i === 3 && !!result);
              const active = i === step;
              const reachable = i <= step;
              return (
                <div key={s} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => reachable && setStep(i)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${
                      active ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]" : reachable ? "text-[var(--text-dim)] hover:text-[var(--text)]" : "text-[var(--text-faint)]"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-semibold ${
                        done ? "bg-[var(--good)] text-white" : active ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--surface-3)] text-[var(--text-dim)]"
                      }`}
                    >
                      {done ? <Check size={11} /> : i + 1}
                    </span>
                    {s}
                  </button>
                  {i < STEPS.length - 1 && <span className="h-px w-6 bg-[var(--border)]" />}
                </div>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {forPlayer && step === 0 && onSwitch && <ForPlayerBanner ctx={forPlayer} play={play} segment={segment} onSwitch={onSwitch} />}
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: ease.out }}>
              {step === 0 && (
                <AudienceStep
                  play={play}
                  segment={segment}
                  onSegment={(s) => {
                    setSegment(s);
                    resetAfter(1);
                  }}
                  data={audience}
                  err={audErr}
                  onRetry={loadAudience}
                  onOpenPlayer={onOpenPlayer}
                  onOpenInGraph={onOpenInGraph}
                />
              )}
              {step === 1 && <PlanStep plan={plan} err={planErr} loading={planning} onRetry={() => { resetAfter(2); draft(); }} />}
              {step === 2 && plan && (
                <TestStep plan={plan} personas={personas} verdicts={verdicts} agg={agg} err={testErr} running={testing} selected={selected} onSelect={setSelected} model={model} />
              )}
              {step === 3 && (
                <LaunchStep
                  play={play}
                  segment={segment}
                  audience={audience}
                  variant={plan?.variants.find((v) => v.id === selected) ?? null}
                  holdout={holdout}
                  onHoldout={setHoldout}
                  launching={launching}
                  result={result}
                  err={launchErr}
                  onLaunch={launch}
                />
              )}
            </motion.div>
          </div>

          {step < 3 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-3">
              <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-faint)]">
                <Users size={12} />
                {audience ? `${int(audience.count)} players in the audience` : "Loading audience"}
              </div>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => go(step + 1)}
                className="v2-press inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--surface-3)] disabled:text-[var(--text-faint)] disabled:shadow-none"
              >
                {nextLabel}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </motion.aside>
      )}
    </>
  );
}

export default ActionDrawer;
