"use client";

/**
 * <PersonalizationFlow /> · Section D (contract §7), Curtis-style nodal canvas.
 *
 *   [1 Pick user] → [2 Infer preference] → [3 Content pairs + synthetic twins] → [4 Serve]
 *
 * Everything on screen comes from live endpoints:
 *   GET  /api/v2/personalize/users   (Spanner)
 *   POST /api/v2/personalize         (SSE: Spanner + Vertex AI + GCS content library)
 *   POST /api/v2/personalize/serve   (Pub/Sub + BigQuery; Google Ads audience staging)
 *
 * Node labels / layout come from CONCEPT_FLOW_NODES (src/lib/v2/concept.ts).
 * Wow moment: switching the user keeps the previous canvas, re-draws the edges,
 * tweens the preference bars to the new split and crossfades the pairs and
 * channel creatives in place.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Gamepad2,
  Layers,
  Loader2,
  Mail,
  Monitor,
  Send,
  Shuffle,
  Smartphone,
  Sparkles,
  Trophy,
  Tv,
  User,
  Users,
  Youtube,
} from "lucide-react";
import { AnimatedEdge, Ticker, curvedPath, ease, springs } from "@/components/v2/motion";
import { useOptionalStoryline } from "@/components/v2/shell/StorylineProvider";
import { archetypeLabel } from "@/lib/archetypes";
import {
  CHANNELS,
  CHANNEL_IDS,
  CONCEPT_FLOW_NODES,
  HOLDOUT_PCT,
  PREFERENCES,
  PREFERENCE_IDS,
  type ChannelActivation,
  type ChannelId,
  type ContentPair,
  type FlowNodeId,
  type PersonalizeEvent,
  type PersonalizeUser,
  type PersonalizeUsersResponse,
  type PreferenceInference,
  type ServeResponse,
  type Twin,
  type UserSignals,
} from "@/lib/v2/concept";
import { FlowCanvas, worldRect } from "./FlowCanvas";

const N = CONCEPT_FLOW_NODES.nodes;
const WORLD_W = N.serve.x + N.serve.w + 40;
const WORLD_MIN_H = 900;

type Stage = "idle" | FlowNodeId | "done" | "error";
const STAGE_ORDER: Stage[] = ["idle", "user", "preference", "pairs", "serve", "done"];

interface RunState {
  runId: number;
  stage: Stage;
  user: PersonalizeUser | null;
  signals: UserSignals | null;
  database: string | null;
  preference: PreferenceInference | null;
  twins: Twin[];
  pairs: ContentPair[];
  scored: boolean;
  channels: ChannelActivation[];
  latency: { total?: number; phases?: Record<string, number>; model?: string };
  error: { service: string; stage: string; error: string } | null;
}

interface ServeState {
  status: "idle" | "pending" | "ok" | "error";
  res?: ServeResponse;
  error?: string;
}

const EMPTY_RUN: RunState = {
  runId: 0,
  stage: "idle",
  user: null,
  signals: null,
  database: null,
  preference: null,
  twins: [],
  pairs: [],
  scored: false,
  channels: [],
  latency: {},
  error: null,
};

const CHANNEL_ICON: Record<ChannelId, typeof Mail> = {
  twotv: Tv,
  console: Monitor,
  push: Smartphone,
  email: Mail,
  youtube: Youtube,
};

const ASPECT: Record<string, string> = { "16:9": "16 / 9", "9:16": "9 / 16", "1:1": "1 / 1", "4:3": "4 / 3" };
const THUMB_W: Record<string, number> = { "16:9": 150, "9:16": 82, "1:1": 112, "4:3": 136 };

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">{children}</div>
  );
}

function Pill({ children, color = "var(--text-dim)", title }: { children: ReactNode; color?: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-[6px] border px-1.5 py-[2px] font-mono text-[10px] uppercase tracking-wide"
      style={{ color, borderColor: "var(--border-strong)" }}
    >
      {children}
    </span>
  );
}

function NodeCard({
  anchor,
  icon: Icon,
  title,
  pill,
  accent,
  children,
  dim,
  glow,
  className,
}: {
  anchor: string;
  icon: typeof Mail;
  title: ReactNode;
  pill?: ReactNode;
  accent: string;
  children: ReactNode;
  dim?: boolean;
  glow?: string | null;
  className?: string;
}) {
  return (
    <div data-anchor={anchor} data-no-pan className={`relative ${className ?? ""}`}>
      <AnimatePresence>
        {glow && (
          <motion.div
            key="glow"
            aria-hidden
            className="pointer-events-none absolute -inset-[3px] rounded-[calc(var(--radius)+3px)]"
            style={{ boxShadow: `0 0 0 1.5px ${glow}, 0 0 36px -6px ${glow}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: ease.out }}
          />
        )}
      </AnimatePresence>
      <div
        className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
        style={{ opacity: dim ? 0.55 : 1, transition: "opacity 240ms var(--v2-ease-out)" }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
          <Icon size={14} style={{ color: accent }} />
          <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--text)]">{title}</div>
          {pill}
        </div>
        <div className="px-3.5 py-3">{children}</div>
      </div>
    </div>
  );
}

function Skeleton({ h = 12, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="v2-skeleton" style={{ height: h, width: w }} />;
}

/**
 * Library creative. While the real GCS object loads, the frame shows the shared
 * loading shimmer; a failed load is a visible error, never a placeholder image.
 */
function Creative({ url, format, width }: { url: string; format: string; width?: number }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = imgRef.current;
    // Cached images can finish before React attaches onLoad.
    if (img && img.complete) setState(img.naturalWidth > 0 ? "loaded" : "failed");
    else setState("loading");
  }, [url]);
  const w = width ?? THUMB_W[format] ?? 140;
  if (state === "failed") {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--bad)] bg-[var(--bad-soft)] p-2 text-center text-[10px] text-[var(--bad)]"
        style={{ width: w, aspectRatio: ASPECT[format] }}
        title={url}
      >
        <span>
          <AlertTriangle size={14} className="mx-auto mb-1" />
          Missing library asset ({format})
        </span>
      </div>
    );
  }
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] ${state === "loading" ? "v2-skeleton" : ""}`}
      style={{ width: w, aspectRatio: ASPECT[format] }}
    >
      <img
        key={url}
        ref={imgRef}
        src={url}
        alt=""
        loading="eager"
        decoding="async"
        draggable={false}
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: state === "loaded" ? 1 : 0, transition: "opacity 280ms var(--v2-ease-out)" }}
      />
    </div>
  );
}

/** Crossfade wrapper used when a node's content is replaced by a new run. */
function Swap({ k, children }: { k: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={k}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
        transition={{ duration: 0.2, ease: ease.out }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function Bar({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-[var(--surface-3)]" style={{ height }}>
      <motion.div
        className="absolute inset-y-0 left-0 w-full rounded-full"
        style={{ background: color, transformOrigin: "0% 50%" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
        transition={springs.gentle}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PersonalizationFlow() {
  const story = useOptionalStoryline();
  const [users, setUsers] = useState<PersonalizeUsersResponse | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [run, setRun] = useState<RunState>(EMPTY_RUN);
  const [serve, setServe] = useState<Partial<Record<ChannelId, ServeState>>>({});
  const [surprising, setSurprising] = useState(false);
  const [extraUsers, setExtraUsers] = useState<PersonalizeUser[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const runCounter = useRef(0);

  // ---------------- run the flow for a player ----------------
  const start = useCallback(async (playerId: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const runId = ++runCounter.current;
    setSelected(playerId);
    setServe({});
    // Keep the previous canvas on screen (re-flow), mark it stale via `stage`.
    setRun((r) => ({ ...r, runId, stage: "user", error: null, scored: false, latency: {} }));

    const apply = (fn: (r: RunState) => RunState) =>
      setRun((r) => (r.runId === runId ? fn(r) : r));

    try {
      const res = await fetch("/api/v2/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        apply((r) => ({
          ...r,
          stage: "error",
          error: { service: j.service ?? "api", stage: j.stage ?? "user", error: j.details ?? j.error ?? `HTTP ${res.status}` },
        }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!chunk.startsWith("data:")) continue;
          const evt = JSON.parse(chunk.slice(5).trim()) as PersonalizeEvent;
          switch (evt.type) {
            case "user":
              apply((r) => ({ ...r, stage: "preference", user: evt.user, signals: evt.signals, database: evt.database }));
              break;
            case "preference":
              apply((r) => ({ ...r, stage: "pairs", preference: evt.preference }));
              break;
            case "twins":
              apply((r) => ({ ...r, twins: evt.twins }));
              break;
            case "content_pairs":
              apply((r) => ({ ...r, pairs: evt.pairs, scored: evt.scored, stage: evt.scored ? "serve" : "pairs" }));
              break;
            case "activation":
              apply((r) => ({ ...r, channels: evt.channels }));
              break;
            case "done":
              apply((r) => ({ ...r, stage: "done", latency: { total: evt.latency_ms, phases: evt.phases, model: evt.models.fast } }));
              break;
            case "error":
              apply((r) => ({ ...r, stage: "error", error: { service: evt.service, stage: evt.stage, error: evt.error } }));
              break;
            default:
              break;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      apply((r) => ({ ...r, stage: "error", error: { service: "network", stage: "stream", error: String(e) } }));
    }
  }, []);

  // ---------------- picker ----------------
  useEffect(() => {
    let alive = true;
    fetch("/api/v2/personalize/users")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(`${j.service ?? "api"}: ${j.details ?? j.error}`);
        return j as PersonalizeUsersResponse;
      })
      .then((j) => {
        if (!alive) return;
        setUsers(j);
        const initial = story?.playerId && j.users.some((u) => u.player_id === story.playerId)
          ? story.playerId
          : j.presets[0]?.user.player_id;
        if (initial) start(initial);
      })
      .catch((e) => alive && setUsersError(String(e.message ?? e)));
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const surprise = async () => {
    setSurprising(true);
    try {
      const r = await fetch("/api/v2/personalize/users?surprise=1");
      const j = await r.json();
      if (!r.ok) throw new Error(`${j.service ?? "api"}: ${j.details ?? j.error}`);
      setExtraUsers((xs) => [j.user, ...xs.filter((x) => x.player_id !== j.user.player_id)].slice(0, 5));
      start(j.user.player_id);
    } catch (e) {
      setUsersError(String((e as Error).message ?? e));
    } finally {
      setSurprising(false);
    }
  };

  const doServe = async (c: ChannelActivation) => {
    if (!run.user || !run.preference) return;
    setServe((s) => ({ ...s, [c.channel]: { status: "pending" } }));
    try {
      const winner = run.pairs.find((p) => p.winner);
      const r = await fetch("/api/v2/personalize/serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: run.user.player_id,
          gamer_tag: run.user.gamer_tag,
          preference: winner?.preference ?? run.preference.top,
          channel: c.channel,
          pair_id: c.pair_id,
          asset_id: winner?.asset_id ?? "",
          creative_url: c.creative_url,
          headline: c.copy.headline,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`${j.service ?? "api"} · ${j.stage ?? ""}: ${j.details ?? j.error}`);
      setServe((s) => ({ ...s, [c.channel]: { status: "ok", res: j as ServeResponse } }));
    } catch (e) {
      setServe((s) => ({ ...s, [c.channel]: { status: "error", error: String((e as Error).message ?? e) } }));
    }
  };

  // ---------------- edge measurement ----------------
  const worldRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const measure = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const next: Record<string, { x: number; y: number; w: number; h: number }> = {};
    w.querySelectorAll<HTMLElement>("[data-anchor]").forEach((el) => {
      next[el.dataset.anchor!] = worldRect(el, w);
    });
    setRects((prev) => {
      const keys = Object.keys(next);
      if (
        keys.length === Object.keys(prev).length &&
        keys.every((k) => prev[k] && ["x", "y", "w", "h"].every((p) => Math.abs((prev as any)[k][p] - (next as any)[k][p]) < 0.5))
      )
        return prev;
      return next;
    });
  }, []);
  const roRef = useRef<ResizeObserver | null>(null);
  useLayoutEffect(() => {
    if (!roRef.current) roRef.current = new ResizeObserver(() => measure());
    worldRef.current?.querySelectorAll<HTMLElement>("[data-anchor]").forEach((el) => roRef.current!.observe(el));
    measure();
  });
  useEffect(() => () => roRef.current?.disconnect(), []);

  const stageIdx = STAGE_ORDER.indexOf(run.stage === "error" ? "idle" : run.stage);
  const reached = (s: FlowNodeId) => run.stage === "done" || stageIdx > STAGE_ORDER.indexOf(s);
  const active = (s: FlowNodeId) => run.stage === s;
  const busy = run.stage !== "done" && run.stage !== "error" && run.stage !== "idle";

  const winner = run.pairs.find((p) => p.winner) ?? null;

  // Warm every format of every candidate pair as soon as pairs stream in, so the
  // channel cards (9:16 / 4:3 / 1:1) paint instantly when the activation lands.
  const preloaded = useRef<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    for (const p of run.pairs) {
      for (const url of Object.values(p.creatives)) {
        if (!preloaded.current.has(url)) {
          const img = new Image();
          img.decoding = "async";
          img.src = url;
          preloaded.current.set(url, img);
        }
      }
    }
  }, [run.pairs]);

  // World height follows the tallest column so Reset / auto-fit always shows everything.
  const worldH = useMemo(() => {
    const bottoms = Object.values(rects).map((r) => r.y + r.h);
    const max = bottoms.length ? Math.max(...bottoms) : 0;
    return Math.max(WORLD_MIN_H, Math.ceil((max + 40) / 20) * 20);
  }, [rects]);
  const WORLD = { w: WORLD_W, h: worldH };

  const edges = useMemo(() => {
    const out: Array<{ id: string; d: string; color: string; flow: boolean; opacity: number }> = [];
    const r = rects;
    const link = (a: string, b: string) => {
      const A = r[a];
      const B = r[b];
      if (!A || !B) return null;
      const y1 = A.y + Math.min(A.h / 2, 120);
      const y2 = B.y + Math.min(B.h / 2, 120);
      return curvedPath(A.x + A.w, y1, B.x, y2, 0.5);
    };
    const up = link("user", "preference");
    if (up && run.user) out.push({ id: "u-p", d: up, color: "var(--accent-2)", flow: active("preference"), opacity: 1 });
    run.pairs.forEach((p, i) => {
      const d = link("preference", `pair-${i}`);
      if (d)
        out.push({
          id: `p-${i}-${p.asset_id}`,
          d,
          color: PREFERENCES[p.preference].color,
          flow: active("pairs"),
          opacity: run.scored && !p.winner ? 0.3 : 1,
        });
    });
    if (winner) {
      const wi = run.pairs.indexOf(winner);
      run.channels.forEach((c) => {
        const d = link(`pair-${wi}`, `ch-${c.channel}`);
        if (d)
          out.push({
            id: `w-${c.channel}-${winner.asset_id}`,
            d,
            color: CHANNELS[c.channel].edge,
            flow: serve[c.channel]?.status === "pending" || run.stage === "serve",
            opacity: 1,
          });
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rects, run.user, run.pairs, run.channels, run.scored, run.stage, winner, serve]);

  const allUsers = useMemo(() => {
    const list = [...extraUsers, ...(users?.users ?? [])];
    const seen = new Set<string>();
    return list.filter((u) => (seen.has(u.player_id) ? false : (seen.add(u.player_id), true)));
  }, [users, extraUsers]);

  const presetPref = users?.presets.find((p) => p.user.player_id === selected)?.pref ?? null;

  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full min-h-[720px] w-full flex-col gap-3 text-[var(--text)]">
      {/* Header + stage rail */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="text-[22px] font-semibold tracking-tight">{CONCEPT_FLOW_NODES.title}</div>
          <div className="text-[13px] text-[var(--text-dim)]">{CONCEPT_FLOW_NODES.subtitle}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {CONCEPT_FLOW_NODES.stages.map((s, i) => {
            const done = reached(s.key as FlowNodeId);
            const on = active(s.key as FlowNodeId);
            return (
              <div
                key={s.key}
                className="flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[12px]"
                style={{
                  borderColor: on ? "var(--accent-ring)" : "var(--border)",
                  color: done || on ? "var(--text)" : "var(--text-faint)",
                  background: on ? "var(--accent-soft)" : "transparent",
                }}
              >
                {done ? (
                  <Check size={12} style={{ color: "var(--good)" }} />
                ) : on ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span className="v2-tabular font-mono text-[10px]">{i + 1}</span>
                )}
                {s.label}
              </div>
            );
          })}
          {run.database && (
            <span className="ml-2 flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
              <span className="v2-live-dot" /> {run.database}
            </span>
          )}
        </div>
      </div>

      {(run.error || usersError) && (
        <div className="mx-1 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--bad)] bg-[var(--bad-soft)] px-3 py-2 text-[12px] text-[var(--bad)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold">
              {run.error ? `${run.error.service} · ${run.error.stage}` : "picker"}
            </span>{" "}
            <span className="break-words">{run.error?.error ?? usersError}</span>
          </div>
        </div>
      )}

      <FlowCanvas
        world={WORLD}
        minZoom={CONCEPT_FLOW_NODES.view.minZoom}
        maxZoom={CONCEPT_FLOW_NODES.view.maxZoom}
        className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)]"
      >
        <div ref={worldRef} className="relative" style={{ width: WORLD.w, height: WORLD.h }}>
          {/* Edges */}
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={WORLD.w} height={WORLD.h}>
            {edges.map((e) => (
              <g key={`${run.runId}-${e.id}`} style={{ opacity: e.opacity, transition: "opacity 300ms var(--v2-ease-out)" }}>
                <AnimatedEdge d={e.d} stroke={e.color} flowStroke={e.color} strokeWidth={1.6} flow={e.flow} duration={0.7} opacity={0.85} />
              </g>
            ))}
          </svg>

          {/* 1 · Pick user */}
          <div className="absolute" style={{ left: N.user.x, top: N.user.y, width: N.user.w }}>
            <NodeCard
              anchor="user"
              icon={User}
              accent={N.user.accent}
              title={`${N.user.step} · ${N.user.title}`}
              pill={<Pill color={N.user.accent}>{N.user.pill}</Pill>}
              dim={false}
            >
              <Label>{CONCEPT_FLOW_NODES.copy.pickPresets}</Label>
              <div className="flex flex-col gap-1.5">
                {(users?.presets ?? []).map((p) => {
                  const on = selected === p.user.player_id;
                  return (
                    <button
                      key={p.pref}
                      type="button"
                      onClick={() => start(p.user.player_id)}
                      className="v2-press flex items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-left"
                      style={{
                        borderColor: on ? PREFERENCES[p.pref].color : "var(--border)",
                        background: on ? PREFERENCES[p.pref].soft : "var(--surface-2)",
                      }}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PREFERENCES[p.pref].color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium">{p.label}</span>
                        <span className="block truncate font-mono text-[10px] text-[var(--text-faint)]">{p.basis}</span>
                      </span>
                    </button>
                  );
                })}
                {!users && !usersError && [0, 1, 2].map((i) => <Skeleton key={i} h={38} />)}
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <select
                  aria-label="Pick a player"
                  value={selected ?? ""}
                  onChange={(e) => e.target.value && start(e.target.value)}
                  className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
                >
                  {!selected && <option value="">Pick a player…</option>}
                  {allUsers.map((u) => (
                    <option key={u.player_id} value={u.player_id}>
                      @{u.gamer_tag} · {archetypeLabel(u.archetype)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={surprise}
                  disabled={surprising}
                  className="v2-press flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[12px] hover:border-[var(--border-strong)]"
                >
                  {surprising ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />}
                  {CONCEPT_FLOW_NODES.copy.surprise}
                </button>
              </div>

              <div className="mt-3 border-t border-[var(--border)] pt-3">
                {run.user ? (
                  <Swap k={run.user.player_id}>
                    <UserBlock user={run.user} signals={run.signals} lean={presetPref} />
                  </Swap>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Skeleton h={20} w="70%" />
                    <Skeleton h={12} />
                    <Skeleton h={12} w="80%" />
                  </div>
                )}
              </div>
            </NodeCard>
          </div>

          {/* 2 · Infer preference */}
          <div className="absolute" style={{ left: N.preference.x, top: N.preference.y, width: N.preference.w }}>
            <NodeCard
              anchor="preference"
              icon={Sparkles}
              accent={N.preference.accent}
              title={`${N.preference.step} · ${N.preference.title}`}
              pill={<Pill color={N.preference.accent}>{run.preference ? shortModel(run.preference.model) : N.preference.pill}</Pill>}
              dim={busy && !reached("preference")}
            >
              <div className="mb-3 text-[11px] text-[var(--text-faint)]">{N.preference.caption}</div>
              <PreferenceBlock pref={run.preference} loading={active("preference") || (busy && !run.preference)} />
            </NodeCard>
          </div>

          {/* 3 · Content pairs */}
          <div
            className="absolute flex flex-col gap-3"
            style={{ left: N.pairs.x, top: N.pairs.y, width: N.pairs.w }}
          >
            <NodeCard
              anchor="pairs-head"
              icon={Layers}
              accent={N.pairs.accent}
              title={`${N.pairs.step} · ${N.pairs.title}`}
              pill={<Pill color={N.pairs.accent}>{run.twins.length ? `${run.twins.length} twins` : N.pairs.pill}</Pill>}
              dim={busy && !reached("pairs") && !active("pairs")}
            >
              <div className="text-[11px] text-[var(--text-faint)]">{N.pairs.caption}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {run.twins.map((t) => (
                  <span
                    key={t.player_id}
                    title={t.similarity}
                    className="rounded-[6px] border px-1.5 py-[1px] font-mono text-[10px]"
                    style={{
                      borderColor: t.is_self ? "var(--accent-2)" : "var(--border)",
                      color: t.is_self ? "var(--accent-2)" : "var(--text-dim)",
                    }}
                  >
                    @{t.gamer_tag}
                  </span>
                ))}
                {run.twins.length === 0 && <Skeleton h={16} w="80%" />}
              </div>
            </NodeCard>
            {(run.pairs.length ? run.pairs : [null, null, null]).map((p, i) => (
              <PairCard key={i} index={i} pair={p} scored={run.scored} scoring={!!p && !run.scored && busy} />
            ))}
          </div>

          {/* 4 · Serve downstream */}
          <div
            className="absolute flex flex-col gap-3"
            style={{ left: N.serve.x, top: N.serve.y, width: N.serve.w }}
          >
            <NodeCard
              anchor="serve-head"
              icon={Send}
              accent={N.serve.accent}
              title={`${N.serve.step} · ${N.serve.title}`}
              pill={<Pill color={N.serve.accent}>{N.serve.pill}</Pill>}
              dim={busy && !run.channels.length}
            >
              <div className="text-[11px] text-[var(--text-faint)]">
                {N.serve.caption} · {HOLDOUT_PCT}% holdout per channel
              </div>
            </NodeCard>
            {(run.channels.length ? run.channels : CHANNEL_IDS.map(() => null)).map((c, i) => (
              <ChannelCard
                key={c?.channel ?? CHANNEL_IDS[i]}
                channel={c?.channel ?? CHANNEL_IDS[i]}
                act={c}
                state={c ? serve[c.channel] : undefined}
                onServe={c ? () => doServe(c) : undefined}
                disabled={busy}
              />
            ))}
          </div>
        </div>
      </FlowCanvas>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-[var(--text-faint)]">
        {run.latency.total !== undefined && (
          <span className="v2-tabular">
            Live run {(run.latency.total / 1000).toFixed(1)}s
            {run.latency.phases &&
              ` · preference ${fmtS(run.latency.phases.preference_ms)} · copy ${fmtS(run.latency.phases.pairs_copy_ms)} · twins ${fmtS(run.latency.phases.twin_scoring_ms)} · channels ${fmtS(run.latency.phases.activation_ms)}`}
          </span>
        )}
        {run.latency.model && <span>{run.latency.model} on Vertex AI</span>}
        {users && (
          <span>
            Leanings from {users.lean_basis === "affinity" ? users.affinity_columns.join(", ") : "archetype + telemetry (no affinity columns on this DB)"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Alias kept for the storyline wiring (`<ConceptTest />`). */
export const ConceptTest = PersonalizationFlow;
export default PersonalizationFlow;

function fmtS(ms?: number) {
  return ms === undefined ? "–" : `${(ms / 1000).toFixed(1)}s`;
}

function shortModel(id: string) {
  return id.replace(/^gemini-/, "").replace(/-preview$/, "").toUpperCase();
}

// ---------------------------------------------------------------------------
// Node bodies
// ---------------------------------------------------------------------------

function UserBlock({ user, signals, lean }: { user: PersonalizeUser; signals: UserSignals | null; lean: string | null }) {
  const aff = [
    { k: "WNBA", v: user.affinity.wnba, c: PREFERENCES.wnba.color },
    { k: "College", v: user.affinity.college, c: PREFERENCES.college.color },
    { k: "Franchise", v: user.affinity.franchise, c: PREFERENCES.nba.color },
  ].filter((a) => a.v !== null);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="truncate text-[17px] font-semibold tracking-tight">@{user.gamer_tag}</div>
        {user.ovr !== null && <span className="v2-tabular font-mono text-[12px] text-[var(--text-dim)]">{user.ovr} OVR</span>}
      </div>
      <div className="mt-0.5 text-[12px] text-[var(--text-dim)]">
        {archetypeLabel(user.archetype)} · age {user.age ?? "?"}
        {lean && <span style={{ color: PREFERENCES[lean as keyof typeof PREFERENCES].color }}> · preset</span>}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <Fact k="Fav player" v={user.favorite_player} />
        <Fact k="Team" v={user.favorite_team} />
        <Fact k="Crew" v={user.crew ? `${user.crew.name} · ${user.crew.role.toLowerCase()}` : null} />
        <Fact k="Platform" v={user.platform} />
      </div>
      {aff.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1">
          {aff.map((a) => (
            <div key={a.k} className="flex items-center gap-2 text-[10px]">
              <span className="w-14 font-mono uppercase text-[var(--text-faint)]">{a.k}</span>
              <Bar value={a.v ?? 0} color={a.c} height={4} />
              <span className="v2-tabular w-8 text-right font-mono text-[var(--text-dim)]">{(a.v ?? 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      {user.creators.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {user.creators.slice(0, 4).map((c) => (
            <span key={c.handle} title={c.signature_mode} className="rounded-[6px] bg-[var(--surface-2)] px-1.5 py-[1px] text-[10px] text-[var(--text-dim)]">
              @{c.handle}
            </span>
          ))}
        </div>
      )}
      {signals && (
        <div className="mt-2.5 font-mono text-[9.5px] leading-relaxed text-[var(--text-faint)]">{signals.sources.join(" · ")}</div>
      )}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9.5px] uppercase tracking-wide text-[var(--text-faint)]">{k}</div>
      <div className="truncate text-[var(--text)]">{v ?? "–"}</div>
    </div>
  );
}

function PreferenceBlock({ pref, loading }: { pref: PreferenceInference | null; loading: boolean }) {
  return (
    <div>
      <Label>Split</Label>
      <div className="flex flex-col gap-2.5">
        {PREFERENCE_IDS.map((id) => {
          const v = pref?.split[id] ?? 0;
          const top = pref?.top === id;
          return (
            <div key={id}>
              <div className="mb-1 flex items-baseline justify-between text-[12px]">
                <span style={{ color: top ? PREFERENCES[id].color : "var(--text-dim)", fontWeight: top ? 600 : 400 }}>
                  {PREFERENCES[id].long}
                </span>
                <Ticker value={v * 100} suffix="%" className="text-[13px] font-semibold" duration={0.7} />
              </div>
              <Bar value={v} color={PREFERENCES[id].color} height={top ? 8 : 6} />
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Label>{CONCEPT_FLOW_NODES.copy.evidence}</Label>
        {pref ? (
          <Swap k={pref.evidence.map((e) => e.signal + e.label).join("|")}>
            <div className="flex flex-col gap-1.5">
              {pref.evidence.map((e, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.24, ease: ease.out }}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: PREFERENCES[e.pref].color }} />
                    {e.label}
                    <span className="ml-auto font-mono text-[9.5px] uppercase text-[var(--text-faint)]">{e.signal}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10.5px] text-[var(--text-dim)]">{e.detail}</div>
                </motion.div>
              ))}
            </div>
          </Swap>
        ) : (
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={40} />
            ))}
          </div>
        )}
      </div>
      {pref && <div className="mt-3 text-[11px] italic leading-snug text-[var(--text-dim)]">{pref.rationale}</div>}
      {loading && !pref && <div className="mt-2 text-[11px] text-[var(--text-faint)]">Reading graph signals…</div>}
    </div>
  );
}

function PairCard({ index, pair, scored, scoring }: { index: number; pair: ContentPair | null; scored: boolean; scoring: boolean }) {
  const self = pair?.twin_scores.find((t) => t.is_self);
  const glow = pair?.winner && scored ? "var(--good)" : null;
  return (
    <NodeCard
      anchor={`pair-${index}`}
      icon={pair?.winner && scored ? Trophy : Gamepad2}
      accent={pair ? PREFERENCES[pair.preference].color : "var(--text-faint)"}
      title={pair ? `Ad 0${index + 1} · ${pair.asset_title}` : `Ad 0${index + 1}`}
      pill={
        pair?.winner && scored ? (
          <Pill color="var(--good)">
            <Trophy size={10} /> {CONCEPT_FLOW_NODES.copy.winner}
          </Pill>
        ) : pair ? (
          <Pill color={PREFERENCES[pair.preference].color}>{PREFERENCES[pair.preference].label}</Pill>
        ) : undefined
      }
      glow={glow}
      dim={scored && !pair?.winner}
    >
      {pair ? (
        <Swap k={pair.id}>
          <div className="flex gap-3">
            <Creative url={pair.creatives["16:9"]} format="16:9" width={128} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold leading-snug">{pair.headline}</div>
              <div className="mt-1 line-clamp-3 text-[11px] leading-snug text-[var(--text-dim)]">{pair.body}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="truncate rounded-[6px] bg-[var(--surface-2)] px-1.5 py-[2px] text-[10.5px] text-[var(--text)]">{pair.offer}</span>
            <span className="ml-auto shrink-0 rounded-[6px] px-1.5 py-[2px] text-[10.5px] font-semibold" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}>
              {pair.cta}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            <span>{CONCEPT_FLOW_NODES.copy.twins}</span>
            <span className="text-[12px] text-[var(--text)]">
              {pair.score !== null ? <Ticker value={pair.score} decimals={1} suffix=" / 10" /> : scoring ? "scoring…" : "–"}
            </span>
          </div>
          <div className="mt-1.5">
            <Bar value={(pair.score ?? 0) / 10} color={pair.winner && scored ? "var(--good)" : PREFERENCES[pair.preference].color} height={6} />
          </div>
          {pair.twin_scores.length > 0 && (
            <div className="mt-2 grid grid-cols-6 gap-1">
              {pair.twin_scores.map((t, i) => (
                <div key={t.player_id} title={`@${t.gamer_tag}: ${t.score} · "${t.quote}"`}>
                  <div className="relative h-7 overflow-hidden rounded-[4px] bg-[var(--surface-3)]">
                    <motion.div
                      className="absolute inset-x-0 bottom-0 h-full"
                      style={{ background: t.is_self ? "var(--accent-2)" : "var(--text-dim)", transformOrigin: "50% 100%", opacity: t.is_self ? 1 : 0.55 }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: t.score / 10 }}
                      transition={{ ...springs.gentle, delay: i * 0.04 }}
                    />
                  </div>
                  <div className="v2-tabular mt-0.5 text-center font-mono text-[9px] text-[var(--text-faint)]">{t.score.toFixed(1)}</div>
                </div>
              ))}
            </div>
          )}
          {self && (
            <div className="mt-2 border-l-2 pl-2 text-[11px] italic leading-snug text-[var(--text-dim)]" style={{ borderColor: "var(--accent-2)" }}>
              “{self.quote}” <span className="not-italic text-[var(--text-faint)]">@{self.gamer_tag}</span>
            </div>
          )}
          {!pair.twin_scores.length && <div className="mt-2 text-[10.5px] text-[var(--text-faint)]">{pair.why}</div>}
        </Swap>
      ) : (
        <div className="flex gap-3">
          <Skeleton h={72} w={128} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton h={14} />
            <Skeleton h={10} w="80%" />
            <Skeleton h={10} w="60%" />
          </div>
        </div>
      )}
    </NodeCard>
  );
}

function ChannelCard({
  channel,
  act,
  state,
  onServe,
  disabled,
}: {
  channel: ChannelId;
  act: ChannelActivation | null;
  state?: ServeState;
  onServe?: () => void;
  disabled?: boolean;
}) {
  const cfg = CHANNELS[channel];
  const Icon = CHANNEL_ICON[channel];
  const res = state?.res;
  return (
    <NodeCard
      anchor={`ch-${channel}`}
      icon={Icon}
      accent={cfg.edge}
      title={cfg.label}
      pill={
        <span className="flex items-center gap-1">
          {act?.holdout && <Pill color="var(--warn)">in holdout</Pill>}
          <Pill title={`${HOLDOUT_PCT}% of this channel's audience is held out as control`}>{HOLDOUT_PCT}% holdout</Pill>
          <Pill color={cfg.edge}>{cfg.format}</Pill>
        </span>
      }
      glow={state?.status === "ok" ? cfg.edge : null}
    >
      {act ? (
        <Swap k={`${act.pair_id}-${act.creative_url}`}>
          <div className="flex gap-3">
            <Creative url={act.creative_url} format={act.format} />
            <div className="min-w-0 flex-1">
              {act.copy.subject && (
                <div className="mb-0.5 truncate font-mono text-[9.5px] uppercase tracking-wide text-[var(--text-faint)]">
                  Subject · {act.copy.subject}
                </div>
              )}
              <div className="text-[12.5px] font-semibold leading-snug">{act.copy.headline}</div>
              <div className="mt-1 line-clamp-3 text-[11px] leading-snug text-[var(--text-dim)]">{act.copy.body}</div>
              {act.copy.meta && <div className="mt-1 line-clamp-2 text-[10px] text-[var(--text-faint)]">{act.copy.meta}</div>}
              {act.audience && (
                <div className="mt-1.5 text-[10.5px] text-[var(--text-dim)]">
                  Ready: 1 seed + <span className="v2-tabular">{act.audience.lookalikes}</span> lookalikes ·{" "}
                  <span className="text-[var(--text-faint)]">{act.audience.basis}</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onServe}
              disabled={disabled || state?.status === "pending" || state?.status === "ok"}
              className="v2-press flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
              style={{
                background: state?.status === "ok" ? "var(--good-soft)" : "var(--accent)",
                color: state?.status === "ok" ? "var(--good)" : "var(--text-on-accent)",
              }}
            >
              {state?.status === "pending" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : state?.status === "ok" ? (
                <Check size={12} />
              ) : channel === "youtube" ? (
                <Users size={12} />
              ) : (
                <Send size={12} />
              )}
              {state?.status === "ok"
                ? CONCEPT_FLOW_NODES.copy.served
                : channel === "youtube"
                  ? "Stage audience"
                  : CONCEPT_FLOW_NODES.copy.serve}
            </button>
            <span className="rounded-[6px] bg-[var(--surface-2)] px-1.5 py-[2px] text-[10.5px] text-[var(--text-dim)]">{act.copy.cta}</span>
          </div>
          {state?.status === "ok" && res && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: ease.out }}
              className="mt-2 text-[10.5px] leading-snug text-[var(--text-dim)]"
            >
              {res.status === "audience_staged" && res.staged ? (
                <>
                  <span className="text-[var(--good)]">
                    Audience staged for Google Ads Customer Match · {res.staged.seed + res.staged.lookalikes} players (+
                    {res.staged.lookalikes} lookalikes)
                  </span>
                  <div className="font-mono text-[9.5px] text-[var(--text-faint)]">
                    BigQuery {res.staged.table.split(".").slice(-2).join(".")} · {res.staged.holdout} held out · Pub/Sub {res.message_id}
                  </div>
                </>
              ) : res.status === "held_out" ? (
                <span className="text-[var(--warn)]">Held out ({HOLDOUT_PCT}% control) · not sent · logged to BigQuery activation_log</span>
              ) : (
                <>
                  <span className="text-[var(--good)]">Dispatched · Pub/Sub {res.topic}</span>
                  <div className="font-mono text-[9.5px] text-[var(--text-faint)]">
                    msg {res.message_id} · BigQuery activation_log · {res.latency_ms}ms
                  </div>
                </>
              )}
            </motion.div>
          )}
          {state?.status === "error" && (
            <div className="mt-2 flex items-start gap-1.5 text-[10.5px] text-[var(--bad)]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {state.error}
            </div>
          )}
        </Swap>
      ) : (
        <div className="flex gap-3">
          <Skeleton h={channel === "twotv" ? 120 : 72} w={THUMB_W[cfg.format]} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton h={12} />
            <Skeleton h={10} w="75%" />
          </div>
        </div>
      )}
    </NodeCard>
  );
}
