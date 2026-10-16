"use client";

/**
 * <ReferenceArchitecture /> v2 reference architecture blueprint.
 *
 * Story: BigQuery is the open lakehouse at the center. Snowflake, Databricks
 * and Treasure Data plug into it where their data already lives (BigLake open
 * formats, no copies). Spanner Graph sits beside it as the live player graph;
 * one EXTERNAL_QUERY joins both. Gemini agents (ADK on Vertex AI) reason over
 * both, Pub/Sub activates, and outcomes land back in BigQuery.
 *
 * Same interaction language as the v1 blueprint: Network-icon button, auto-flow
 * step scrubber, highlighted nodes, flowing wires. Static diagram content only
 * (no metrics), so nothing here can drift from live data.
 *
 * Motion: modal springs in, step pills share a layoutId, active wires run a
 * CSS dash flow (off the main thread). No CSS blur/backdrop-filter, because
 * the Home particle field (WebGL) may be underneath. Reduced motion: no
 * auto-flow, no dash animation.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bot, GitBranch, Network, Pause, Play, Radio, Search, X } from "lucide-react";

/* ---------------------------------------------------------------- button */

export function ReferenceArchitectureButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="v2-arch-btn"
      title="Reference architecture: BigQuery lakehouse + Spanner Graph"
      aria-label="Open reference architecture"
      className="v2-press group relative grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
    >
      <Network size={14} strokeWidth={1.75} className="transition-colors group-hover:text-[var(--accent)]" />
      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-80 group-hover:animate-ping" />
    </button>
  );
}

/* ----------------------------------------------------------------- model */

type NodeId = "sf" | "dbx" | "td" | "bq" | "sp" | "ai" | "act";

const C = {
  sf: "#29B5E8",
  dbx: "#FF3621",
  td: "#6E8BFF",
  bq: "#4285F4",
  sp: "#34A853",
  ai: "#A78BFA",
  act: "var(--accent)",
} as const;

interface Step {
  short: string;
  badge: string;
  headline: string;
  nodes: NodeId[];
  wires: string[];
}

const STEPS: Step[] = [
  {
    short: "Open lakehouse",
    badge: "NO RIP-AND-REPLACE",
    headline:
      "Snowflake, Databricks and Treasure Data plug into BigQuery where the data already lives. BigLake reads open Iceberg and Delta tables in place, so nothing gets copied.",
    nodes: ["sf", "dbx", "td", "bq"],
    wires: ["sf-bq", "dbx-bq", "td-bq"],
  },
  {
    short: "BigQuery + Spanner",
    badge: "ONE STATEMENT · NO ANALYTICS HOP",
    headline:
      "Spanner Graph holds the live player graph: crews, co-play and friendships. BigQuery holds the history. One EXTERNAL_QUERY joins them through Data Boost without touching production.",
    nodes: ["bq", "sp"],
    wires: ["bq-sp", "sp-bq"],
  },
  {
    short: "Agents reason",
    badge: "GEMINI ON VERTEX AI",
    headline:
      "Gemini agents built with ADK turn plain questions into GQL and SQL, then pressure-test offers on synthetic players who are grounded in real graph rows.",
    nodes: ["bq", "sp", "ai"],
    wires: ["bq-ai", "sp-ai"],
  },
  {
    short: "Act + learn",
    badge: "CLOSED LOOP",
    headline:
      "Approved offers go out through Pub/Sub to the in-game inbox, 2K mobile push and Google Ads. Every send and outcome is written back to BigQuery to measure lift.",
    nodes: ["ai", "act", "bq"],
    wires: ["ai-act", "act-bq"],
  },
];

/* Design canvas (px). The stage scales this to fit the modal. */
const W = 1240;
const H = 540;
/** Vertical offset for the node row; the band above holds the outcomes loop. */
const OY = 44;

const BOX: Record<NodeId, { x: number; y: number; w: number; h: number }> = {
  sf: { x: 0, y: OY + 70, w: 236, h: 104 },
  dbx: { x: 0, y: OY + 208, w: 236, h: 104 },
  td: { x: 0, y: OY + 346, w: 236, h: 104 },
  bq: { x: 316, y: OY + 52, w: 340, h: 250 },
  sp: { x: 316, y: OY + 356, w: 340, h: 140 },
  ai: { x: 744, y: OY + 160, w: 232, h: 232 },
  act: { x: 1052, y: OY + 150, w: 188, h: 252 },
};

type P = [number, number];
const curve = (a: P, b: P) => {
  const dx = (b[0] - a[0]) * 0.5;
  return `M ${a[0]} ${a[1]} C ${a[0] + dx} ${a[1]}, ${b[0] - dx} ${b[1]}, ${b[0]} ${b[1]}`;
};

const bq = BOX.bq;
const sp = BOX.sp;
const ai = BOX.ai;
const act = BOX.act;

const WIRES: Record<string, { d: string; color: string; reverse?: boolean }> = {
  "sf-bq": { d: curve([236, OY + 122], [bq.x, bq.y + 92]), color: C.sf },
  "dbx-bq": { d: curve([236, OY + 260], [bq.x, bq.y + 140]), color: C.dbx },
  "td-bq": { d: curve([236, OY + 398], [bq.x, bq.y + 188]), color: C.td },
  // Two parallel vertical lanes: history down to the graph, graph up to BigQuery.
  "bq-sp": {
    d: `M ${bq.x + 60} ${bq.y + bq.h} L ${sp.x + 60} ${sp.y}`,
    color: C.bq,
  },
  "sp-bq": {
    d: `M ${sp.x + 280} ${sp.y} L ${bq.x + 280} ${bq.y + bq.h}`,
    color: C.sp,
  },
  "bq-ai": { d: curve([bq.x + bq.w, bq.y + 120], [ai.x, ai.y + 78]), color: C.bq },
  "sp-ai": { d: curve([sp.x + sp.w, sp.y + 60], [ai.x, ai.y + 160]), color: C.sp },
  "ai-act": { d: curve([ai.x + ai.w, ai.y + 116], [act.x, act.y + 126]), color: C.ai },
  // Outcomes loop back over the top into BigQuery.
  "act-bq": {
    d: `M ${act.x + act.w / 2} ${act.y} C ${act.x + act.w / 2} ${OY - 26}, ${bq.x + bq.w / 2 + 40} ${OY - 26}, ${bq.x + bq.w / 2} ${bq.y}`,
    color: "#e4002b",
  },
};

/* ----------------------------------------------------------------- icons */

function SnowflakeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07L19.07 4.93" stroke={C.sf} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function DatabricksMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M12 3L3 8l9 5 9-5-9-5z" stroke={C.dbx} strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 12.5l9 5 9-5M3 17l9 5 9-5" stroke={C.dbx} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TreasureDataMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke={C.td} strokeWidth="2" />
      <path d="M7.5 9h6M10.5 9v7M14.5 9.5v6" stroke={C.td} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function GeminiMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill="url(#v2-arch-gem)" />
      <defs>
        <linearGradient id="v2-arch-gem" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="55%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ----------------------------------------------------------------- nodes */

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--text-dim)]">
      {children}
    </span>
  );
}

function NodeCard({
  id,
  lit,
  onHover,
  children,
  className = "",
}: {
  id: NodeId;
  lit: boolean;
  onHover: (id: NodeId | null) => void;
  children: ReactNode;
  className?: string;
}) {
  const b = BOX[id];
  const color = C[id];
  return (
    <motion.div
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      animate={{ opacity: lit ? 1 : 0.42, scale: lit ? 1 : 0.985 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className={`absolute rounded-[var(--radius)] border bg-[var(--surface)] p-3.5 ${className}`}
      style={{
        left: b.x,
        top: b.y,
        width: b.w,
        height: b.h,
        borderColor: lit ? `color-mix(in oklab, ${color} 70%, transparent)` : "var(--border)",
        boxShadow: lit ? `0 0 0 1px color-mix(in oklab, ${color} 25%, transparent), 0 18px 48px -18px color-mix(in oklab, ${color} 55%, transparent)` : "var(--shadow-sm)",
      }}
    >
      {children}
    </motion.div>
  );
}

function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="whitespace-nowrap rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-wide"
      style={{ color, background: `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      {children}
    </span>
  );
}

function SourceNode({ id, lit, onHover, icon, name, badge, chips }: { id: NodeId; lit: boolean; onHover: (id: NodeId | null) => void; icon: ReactNode; name: string; badge: string; chips: string[] }) {
  return (
    <NodeCard id={id} lit={lit} onHover={onHover}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[13px] font-semibold text-[var(--text)]">{name}</span>
        </div>
        <Badge color={C[id]}>{badge}</Badge>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </div>
    </NodeCard>
  );
}

/* ----------------------------------------------------------------- modal */

export function ReferenceArchitectureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = !!useReducedMotion();
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(!reduce);
  const [hover, setHover] = useState<NodeId | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setAuto(!reduce);
  }, [open, reduce]);

  useEffect(() => {
    if (!open || !auto) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 4600);
    return () => clearInterval(t);
  }, [open, auto]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") {
        e.stopPropagation();
        setAuto(false);
        setStep((s) => Math.min(STEPS.length - 1, s + 1));
      } else if (e.key === "ArrowLeft") {
        e.stopPropagation();
        setAuto(false);
        setStep((s) => Math.max(0, s - 1));
      }
    };
    // Capture so the storyline's arrow-key navigation doesn't also fire.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Leave breathing room inside the stage (matches px-8 / py-5).
    setScale(Math.min((r.width - 64) / W, (r.height - 40) / H, 1.15));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    fit();
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [open, fit]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cur = STEPS[step];
  const lit = (id: NodeId) => hover === id || cur.nodes.includes(id);

  // Portal to <body>: the top bar uses a glass effect, which would otherwise
  // become the containing block for this fixed overlay.
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="v2-arch"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ background: "rgba(5,5,7,0.82)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Reference architecture"
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative flex h-[86vh] max-h-[780px] w-full max-w-[1320px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)]"
          >
            {/* ambient glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 40% 45% at 38% 30%, rgba(66,133,244,0.10), transparent 70%), radial-gradient(ellipse 35% 40% at 40% 85%, rgba(52,168,83,0.07), transparent 70%)",
              }}
            />

            {/* header */}
            <div className="relative z-10 flex items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-2)]">
                  <Network size={15} strokeWidth={1.75} className="text-[var(--accent)]" />
                </span>
                <div>
                  <div className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)]">Reference architecture</div>
                  <div className="text-[12px] text-[var(--text-faint)]">BigQuery lakehouse + Spanner Graph, on Google Cloud</div>
                </div>
              </div>

              {/* step scrubber */}
              <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
                {STEPS.map((s, i) => {
                  const on = i === step;
                  return (
                    <button
                      key={s.short}
                      type="button"
                      onClick={() => {
                        setAuto(false);
                        setStep(i);
                      }}
                      className={`relative rounded-full px-3 py-1.5 text-[12px] transition-colors ${on ? "text-[var(--text)]" : "text-[var(--text-faint)] hover:text-[var(--text-dim)]"}`}
                    >
                      {on && (
                        <motion.span
                          layoutId="v2-arch-step"
                          className="absolute inset-0 rounded-full bg-[var(--surface-3)]"
                          transition={{ type: "spring", stiffness: 420, damping: 36 }}
                        />
                      )}
                      <span className="relative flex items-center gap-1.5">
                        <span className="font-mono text-[10.5px] text-[var(--accent)]">{i + 1}</span>
                        {s.short}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuto((a) => !a)}
                  className={`v2-press inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] ${
                    auto ? "border-[var(--accent-ring)] bg-[var(--accent-soft)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]"
                  }`}
                >
                  {auto ? <Pause size={12} /> : <Play size={12} />}
                  {auto ? "Auto-flow" : "Paused"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close reference architecture"
                  className="v2-press grid h-8 w-8 place-items-center rounded-full text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* stage */}
            <div ref={stageRef} className="relative z-10 min-h-0 flex-1 px-8 py-5">
              <div className="absolute left-1/2 top-1/2" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}>
                {/* column labels */}
                {[
                  { x: 0, t: "Your data, where it lives" },
                  { x: 316, t: "Google Cloud data core" },
                  { x: 744, t: "Agentic decision plane" },
                  { x: 1052, t: "Activation" },
                ].map((l) => (
                  <div key={l.t} className="absolute text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]" style={{ left: l.x, top: OY + 28 }}>
                    {l.t}
                  </div>
                ))}

                {/* wires */}
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 overflow-visible">
                  {Object.entries(WIRES).map(([id, w]) => {
                    const on = cur.wires.includes(id);
                    return (
                      <g key={id}>
                        <path d={w.d} fill="none" stroke="var(--edge)" strokeOpacity={0.35} strokeWidth={1.5} />
                        <motion.path
                          d={w.d}
                          fill="none"
                          stroke={w.color}
                          strokeLinecap="round"
                          initial={false}
                          animate={{ opacity: on ? 0.95 : 0, pathLength: on ? 1 : 0 }}
                          transition={{ duration: reduce ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
                          strokeWidth={2.5}
                        />
                        {on && !reduce && (
                          <path
                            d={w.d}
                            fill="none"
                            stroke="#fff"
                            strokeOpacity={0.85}
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeDasharray="2 22"
                            className="v2-edge-flow"
                            style={{ ["--v2-dash-cycle" as string]: 24, ["--v2-dash-speed" as string]: "700ms" }}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* EXTERNAL_QUERY label between BigQuery and Spanner */}
                <motion.div
                  className="absolute flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10.5px] text-[var(--text)]"
                  style={{ left: bq.x + bq.w / 2, top: bq.y + bq.h + 27, x: "-50%", y: "-50%" }}
                  animate={{ opacity: cur.wires.includes("bq-sp") ? 1 : 0.5 }}
                >
                  EXTERNAL_QUERY · Data Boost
                </motion.div>

                {/* outcomes loop label */}
                <motion.div
                  className="absolute rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[10.5px] text-[var(--text-dim)]"
                  style={{ left: (act.x + act.w / 2 + bq.x + bq.w / 2) / 2 + 20, top: OY - 34, x: "-50%", y: "-50%" }}
                  animate={{ opacity: cur.wires.includes("act-bq") ? 1 : 0.35 }}
                >
                  sends + outcomes logged back
                </motion.div>

                {/* sources */}
                <SourceNode id="sf" lit={lit("sf")} onHover={setHover} icon={<SnowflakeMark />} name="Snowflake" badge="WAREHOUSE" chips={["Iceberg tables", "BigLake", "no copy"]} />
                <SourceNode id="dbx" lit={lit("dbx")} onHover={setHover} icon={<DatabricksMark />} name="Databricks" badge="LAKEHOUSE" chips={["Delta / Iceberg", "Unity Catalog"]} />
                <SourceNode id="td" lit={lit("td")} onHover={setHover} icon={<TreasureDataMark />} name="Treasure Data" badge="CDP" chips={["unified profiles", "audience sync"]} />

                {/* BigQuery: the center */}
                <NodeCard id="bq" lit={lit("bq")} onHover={setHover} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: "color-mix(in oklab, #4285F4 18%, transparent)" }}>
                        <Search size={17} strokeWidth={2} color={C.bq} />
                      </span>
                      <div>
                        <div className="text-[15px] font-semibold text-[var(--text)]">BigQuery</div>
                        <div className="text-[11.5px] text-[var(--text-faint)]">Open lakehouse · system of insight</div>
                      </div>
                    </div>
                    <Badge color={C.bq}>CENTER</Badge>
                  </div>
                  <div className="mt-3.5 space-y-1.5">
                    {[
                      ["BigLake", "open formats, any engine"],
                      ["History", "sessions, purchases, streams"],
                      ["BigQuery ML", "forecasting, lift"],
                      ["Governance", "one catalog, row-level security"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between rounded-[8px] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11.5px]">
                        <span className="font-medium text-[var(--text)]">{k}</span>
                        <span className="text-[var(--text-dim)]">{v}</span>
                      </div>
                    ))}
                  </div>
                </NodeCard>

                {/* Spanner Graph */}
                <NodeCard id="sp" lit={lit("sp")} onHover={setHover} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: "color-mix(in oklab, #34A853 18%, transparent)" }}>
                        <GitBranch size={17} strokeWidth={2} color={C.sp} />
                      </span>
                      <div>
                        <div className="text-[15px] font-semibold text-[var(--text)]">Spanner Graph</div>
                        <div className="text-[11.5px] text-[var(--text-faint)]">Live player graph · system of engagement</div>
                      </div>
                    </div>
                    <Badge color={C.sp}>GQL + SQL</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {["Player", "Crew", "PLAYED_WITH", "FRIENDS_WITH", "multi-hop"].map((c) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </div>
                </NodeCard>

                {/* Gemini + ADK */}
                <NodeCard id="ai" lit={lit("ai")} onHover={setHover} className="p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--surface-2)]">
                      <GeminiMark />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--text)]">Gemini + ADK</div>
                      <div className="text-[11.5px] text-[var(--text-faint)]">Vertex AI agents</div>
                    </div>
                  </div>
                  <div className="mt-3.5 space-y-1.5">
                    {[
                      [Search, "Question to GQL / SQL"],
                      [Bot, "Synthetic focus groups"],
                      [GitBranch, "Explains every hop"],
                    ].map(([Icon, t]) => {
                      const I = Icon as typeof Search;
                      return (
                        <div key={t as string} className="flex items-center gap-2 rounded-[8px] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-dim)]">
                          <I size={12} strokeWidth={2} color={C.ai} />
                          {t as string}
                        </div>
                      );
                    })}
                  </div>
                </NodeCard>

                {/* Activation */}
                <NodeCard id="act" lit={lit("act")} onHover={setHover} className="p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--accent-soft)]">
                      <Radio size={16} strokeWidth={2} className="text-[var(--accent)]" />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--text)]">Pub/Sub</div>
                      <div className="text-[11.5px] text-[var(--text-faint)]">Activation</div>
                    </div>
                  </div>
                  <div className="mt-3.5 space-y-1.5">
                    {["In-game inbox", "2K mobile push", "Google Ads", "Email"].map((t) => (
                      <div key={t} className="rounded-[8px] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-dim)]">
                        {t}
                      </div>
                    ))}
                  </div>
                </NodeCard>
              </div>
            </div>

            {/* narrative footer */}
            <div className="relative z-10 flex items-center gap-4 border-t border-[var(--border)] px-6 py-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="flex min-w-0 items-center gap-4"
                >
                  <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-mono text-[10.5px] font-semibold tracking-wide text-[var(--accent)]">
                    {cur.badge}
                  </span>
                  <p className="text-[14px] leading-snug text-[var(--text)]">{cur.headline}</p>
                </motion.div>
              </AnimatePresence>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span key={i} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === step ? 18 : 6, background: i === step ? "var(--accent)" : "var(--border-strong)" }} />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
