"use client";

/**
 * <Player360 /> agenda Section B: start with one player, then the social graph.
 *
 *   ego      one player card springs in at the centre
 *   pillars  Crew · Creator · Brand clusters fan out (every pillar hangs off the same Player node)
 *   social   PLAYED_WITH / FRIENDS_WITH / MESSAGED neighbors bloom outward; hop-2 entities beyond
 *   metrics  Churn exposure · Crew centrality · Players like you bought
 *
 * Storyline: B_PLAYER covers ego + pillars, B_SOCIAL = social, METRICS = metrics.
 * Works standalone (no provider) with local stage state.
 *
 * All data is live from GET /api/v2/player/[id] (Spanner Graph). On failure the
 * component shows the real error; it never renders placeholder data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Code2, RotateCcw } from "lucide-react";
import { useOptionalStoryline, type StorylineStep } from "@/components/v2/shell/StorylineProvider";
import { ease, springs } from "@/components/v2/motion";
import type { FeaturedPlayerResponse, Player360Response } from "@/lib/v2/player360";
import { GraphCanvas } from "./GraphCanvas";
import { PlayerCard } from "./PlayerCard";
import { MetricChips } from "./MetricChips";
import { GqlPanel } from "./GqlPanel";
import { PILLAR_CAPTION, PILLAR_Y, viewBoxFor, computeLayout, type Stage } from "./layout";

export type Player360Stage = Stage;

export interface Player360ActContext {
  playerId: string;
  gamerTag: string;
  crewId: string | null;
  crewName: string | null;
  churnExposure: number;
  keystone: boolean;
  likeYouItemIds: string[];
}

export interface Player360Props {
  /** Focal player. Falls back to the storyline's player, then /api/v2/player/featured. */
  playerId?: string | null;
  /** Called by the "Act" button in the metrics stage. Default: storyline goTo("C_CREWS"). */
  onAct?: (ctx: Player360ActContext) => void;
  /** Fired whenever the visible stage changes. */
  onStageChange?: (stage: Stage) => void;
  /** Starting stage when used outside the storyline. Default "ego". */
  initialStage?: Stage;
  /** Hops requested from the API. Default 2. */
  hops?: 1 | 2;
  className?: string;
  /** Fired when the focal player's graph loads (including re-centres). */
  onPlayerLoaded?: (p: { player_id: string; gamer_tag: string; home_studio: "2K" | "ROCKSTAR" | "ZYNGA" | null }) => void;
}

interface ApiError {
  status: number;
  message: string;
  failed_query?: string | null;
  database?: string;
}

const STAGE_ORDER: Stage[] = ["ego", "pillars", "social", "metrics"];

const CTA: Record<Stage, string | null> = {
  ego: "Expand pillars",
  pillars: "Expand social",
  social: "Show signals",
  metrics: null,
};

function stageFromStep(step: StorylineStep | undefined, local: Stage): Stage {
  switch (step) {
    case "B_PLAYER":
      return local === "ego" || local === "pillars" ? local : "pillars";
    case "B_SOCIAL":
      return "social";
    case "METRICS":
      return "metrics";
    default:
      return local;
  }
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 300) };
  }
}

export function Player360({ playerId, onAct, onStageChange, initialStage = "ego", hops = 2, className, onPlayerLoaded }: Player360Props) {
  const story = useOptionalStoryline();
  const reduce = !!useReducedMotion();

  const [localStage, setLocalStage] = useState<Stage>(initialStage);
  const stage = story ? stageFromStep(story.step, localStage) : localStage;

  const requestedId = playerId ?? story?.playerId ?? null;
  const [centerId, setCenterId] = useState<string | null>(requestedId);
  const [featured, setFeatured] = useState<FeaturedPlayerResponse | null>(null);
  const [data, setData] = useState<Player360Response | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [showGql, setShowGql] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // External player changes win.
  useEffect(() => {
    if (requestedId && requestedId !== centerId) setCenterId(requestedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId]);

  // No player anywhere: ask Spanner for the storyline's featured keystone.
  useEffect(() => {
    if (centerId) return;
    const ac = new AbortController();
    (async () => {
      const res = await fetch("/api/v2/player/featured", { signal: ac.signal, cache: "no-store" });
      const body = await readJson(res);
      if (!res.ok) {
        setError({ status: res.status, message: body.message ?? body.error ?? "featured failed", failed_query: body.failed_query, database: body.source?.database });
        return;
      }
      setFeatured(body as FeaturedPlayerResponse);
      setCenterId(body.player_id);
      story?.setPlayerId(body.player_id);
    })().catch((e) => {
      if (e?.name !== "AbortError") setError({ status: 0, message: String(e?.message ?? e) });
    });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  // Load the focal player's graph.
  useEffect(() => {
    if (!centerId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    (async () => {
      const res = await fetch(`/api/v2/player/${encodeURIComponent(centerId)}?hops=${hops}`, {
        signal: ac.signal,
        cache: "no-store",
      });
      const body = await readJson(res);
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setPendingId(null);
        setError({ status: res.status, message: body.message ?? body.error ?? "request failed", failed_query: body.failed_query, database: body.source?.database });
        return;
      }
      setData(body as Player360Response);
      onPlayerLoaded?.({
        player_id: (body as Player360Response).player.player_id,
        gamer_tag: (body as Player360Response).player.gamer_tag,
        home_studio: (body as Player360Response).cross_label?.home_studio ?? null,
      });
      setPendingId(null);
    })().catch((e) => {
      if (e?.name !== "AbortError") {
        setPendingId(null);
        setError({ status: 0, message: String(e?.message ?? e) });
      }
    });
    return () => ac.abort();
  }, [centerId, hops]);

  useEffect(() => {
    onStageChange?.(stage);
  }, [stage, onStageChange]);

  const layout = useMemo(() => (data ? computeLayout(data, stage) : null), [data, stage]);

  const advance = useCallback(() => {
    const i = STAGE_ORDER.indexOf(stage);
    const nextStage = STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
    setLocalStage(nextStage);
    if (story) {
      if (nextStage === "social") story.goTo("B_SOCIAL");
      else if (nextStage === "metrics") story.goTo("METRICS");
    }
  }, [stage, story]);

  const reset = useCallback(() => {
    setLocalStage("ego");
    if (story && story.step !== "B_PLAYER") story.goTo("B_PLAYER");
  }, [story]);

  const selectNeighbor = useCallback(
    (pid: string, nodeId: string) => {
      if (pid === centerId) return;
      setPendingId(nodeId);
      setShowGql(false);
      setCenterId(pid);
      story?.setPlayerId(pid);
    },
    [centerId, story],
  );

  const handleAct = useMemo(() => {
    if (!data) return undefined;
    const activeCrew = data.pillars.crew.crews.find((c) => c.is_active) ?? null;
    const ctx: Player360ActContext = {
      playerId: data.player.player_id,
      gamerTag: data.player.gamer_tag,
      crewId: activeCrew?.clan_id ?? null,
      crewName: activeCrew?.name ?? null,
      churnExposure: data.metrics.churn_exposure.value,
      keystone: data.metrics.keystone.value,
      likeYouItemIds: data.metrics.players_like_you_bought.map((i) => i.item_id),
    };
    if (onAct) return () => onAct(ctx);
    if (story) return () => story.goTo("C_CREWS", { crewIds: ctx.crewId ? [ctx.crewId] : [] });
    return undefined;
  }, [data, onAct, story]);

  const cta = CTA[stage];
  const social = stage === "social" || stage === "metrics";

  return (
    <LayoutGroup id="player360">
      <div
        className={`relative isolate h-full min-h-[620px] w-full overflow-hidden text-[var(--text)] ${className ?? ""}`}
        style={{ background: "radial-gradient(ellipse at 50% 46%, var(--surface) 0%, var(--bg) 62%)" }}
      >
        <style>{P360_CSS}</style>

        {/* Graph */}
        <div className="absolute inset-x-0 bottom-[96px] top-[52px]">
          {layout && data && (
            <GraphCanvas
              layout={layout}
              stage={stage}
              reduce={reduce}
              pendingId={pendingId}
              centerKeystone={data.player.keystone && !pendingId}
              onSelectNeighbor={selectNeighbor}
            />
          )}

          <AnimatePresence>{social && data && <Legend reduce={reduce} />}</AnimatePresence>
          {/* Social stage, second beat: the same circle across 2K, Rockstar and Zynga (portfolio DB only). */}
          <AnimatePresence>{social && data?.cross_label && !pendingId && <AcrossLabelsCard x={data.cross_label} name={data.player.gamer_tag} reduce={reduce} />}</AnimatePresence>

          {/* Pillar captions (pillars step only; the social ring owns that space later). */}
          <AnimatePresence>
            {stage === "pillars" && data && !pendingId && <PillarCaptions reduce={reduce} />}
          </AnimatePresence>

          {/* Focal card */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="popLayout">
              {data && !pendingId && (
                <PlayerCard key={data.player.player_id} player={data.player} compact={stage !== "ego"} reduce={reduce} />
              )}
              {!data && !error && (
                <motion.div
                  key="skeleton"
                  className="v2-card w-[232px] p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="v2-skeleton h-4 w-20" />
                  <div className="v2-skeleton mt-3 h-5 w-36" />
                  <div className="v2-skeleton mt-4 h-8 w-full" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Top bar: context + live query affordance */}
        <div className="absolute inset-x-0 top-0 z-10 flex h-[52px] items-center gap-3 px-5">
          <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">Player 360</div>
            <AnimatePresence mode="wait">
              <motion.div
                key={featured && data && featured.player_id === data.player.player_id ? "featured" : data?.player.player_id ?? "load"}
                className="truncate text-[12.5px] text-[var(--text-dim)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {featured && data && featured.player_id === data.player.player_id
                  ? featured.reason
                  : data
                    ? `${data.social.totals.played_with} co-players · ${data.social.totals.friends_with} friends · ${data.social.totals.messaged} messaged`
                    : "Loading from Spanner Graph"}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {data && (
              <button
                type="button"
                onClick={() => setShowGql((v) => !v)}
                className="v2-press flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                aria-pressed={showGql}
              >
                <span className="v2-live-dot" />
                <Code2 size={13} />
                <span className="font-medium">GQL</span>
                <span className="v2-tabular text-[var(--text-faint)]">{data.latency_ms} ms</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom: stage CTA or metric chips */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-[96px] items-center justify-center px-5 pb-3">
          <AnimatePresence mode="wait">
            {stage === "metrics" && data ? (
              <motion.div
                key="metrics"
                className="flex w-full max-w-[1100px] items-center gap-3"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <MetricChips data={data} reduce={reduce} onAct={handleAct} />
                <IconButton label="Replay" onClick={reset}>
                  <RotateCcw size={14} />
                </IconButton>
              </motion.div>
            ) : (
              cta &&
              data && (
                <motion.div
                  key={`cta-${stage}`}
                  className="flex items-center gap-3"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.3, ease: ease.out, delay: stage === "ego" ? 0.5 : 0.9 }}
                >
                  <StageDots stage={stage} />
                  <button
                    type="button"
                    onClick={advance}
                    disabled={!!pendingId}
                    className="v2-press flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-2 text-[13px] font-medium text-[var(--text)] shadow-[var(--shadow)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                  >
                    {cta}
                    <ArrowRight size={14} />
                  </button>
                  {stage !== "ego" && (
                    <IconButton label="Replay" onClick={reset}>
                      <RotateCcw size={14} />
                    </IconButton>
                  )}
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>

        {/* Live error: real failure details, no placeholder graph */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="absolute left-1/2 top-[64px] z-40 w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-[var(--radius)] border border-[var(--bad)] bg-[var(--bad-soft)] px-4 py-3 text-[12.5px] text-[var(--text)] shadow-[var(--shadow)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="alert"
            >
              <div className="font-semibold text-[var(--bad)]">
                Spanner {error.status ? `HTTP ${error.status}` : "request failed"}
                {error.database ? ` · ${error.database}` : ""}
              </div>
              {error.failed_query && <div className="mt-0.5 text-[var(--text-dim)]">Query: {error.failed_query}</div>}
              <div className="mt-1 break-words font-mono text-[11.5px] text-[var(--text-dim)]">{error.message}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showGql && data && (
            <GqlPanel
              steps={data.gql_steps}
              latencyMs={data.latency_ms}
              database={data.source.database}
              onClose={() => setShowGql(false)}
              reduce={reduce}
            />
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function PillarCaptions({ reduce }: { reduce: boolean }) {
  const items = (["crew", "creator", "brand"] as const).map((key) => ({
    key,
    label: key,
    ...PILLAR_CAPTION[key],
  }));
  return (
    <motion.div className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <svg viewBox={viewBoxFor("pillars").box} preserveAspectRatio="xMidYMid meet" className="h-full w-full overflow-visible">
        {items.map((it, i) => {
          const x = Math.cos((it.angle * Math.PI) / 180) * it.r;
          const y = Math.sin((it.angle * Math.PI) / 180) * it.r * PILLAR_Y;
          return (
            <motion.text
              key={it.key}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={17}
              letterSpacing="0.14em"
              fill="var(--text-faint)"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.4, ease: ease.out, delay: 0.5 + i * 0.1 }}
            >
              {it.label.toUpperCase()}
            </motion.text>
          );
        })}
      </svg>
    </motion.div>
  );
}

function Legend({ reduce }: { reduce: boolean }) {
  const rows: { label: string; el: JSX.Element }[] = [
    { label: "Played with", el: <line x1={0} y1={5} x2={18} y2={5} stroke="var(--text)" strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" /> },
    { label: "Friends", el: <line x1={0} y1={5} x2={18} y2={5} stroke="var(--text-dim)" strokeWidth={1.2} strokeDasharray="2 4" strokeLinecap="round" /> },
    { label: "Messaged", el: <line x1={0} y1={5} x2={18} y2={5} stroke="var(--accent-2)" strokeWidth={1.6} strokeLinecap="round" /> },
    { label: "Churned 14d", el: <circle cx={9} cy={5} r={4} fill="var(--bad-soft)" stroke="var(--bad)" strokeWidth={1.4} /> },
    { label: "Keystone", el: <circle cx={9} cy={5} r={3.5} fill="var(--accent)" /> },
  ];
  return (
    <motion.div
      className="pointer-events-none absolute left-5 top-2 z-10 flex flex-col gap-1.5"
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-4px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: ease.out, delay: 0.6 }}
    >
      {rows.map((r) => (
        <span key={r.label} className="flex items-center gap-2 whitespace-nowrap text-[11px] text-[var(--text-faint)]">
          <svg width={18} height={10} aria-hidden>
            {r.el}
          </svg>
          {r.label}
        </span>
      ))}
    </motion.div>
  );
}

function StageDots({ stage }: { stage: Stage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {STAGE_ORDER.map((s, i) => (
        <motion.span
          key={s}
          className="block h-1.5 rounded-full"
          animate={{
            width: i === idx ? 16 : 6,
            backgroundColor: i <= idx ? "var(--text-dim)" : "var(--border-strong)",
          }}
          transition={springs.snappy}
        />
      ))}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="v2-press grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
    >
      {children}
    </button>
  );
}

const P360_CSS = `
.p360-node { cursor: default; }
.p360-click { cursor: pointer; outline: none; }
.p360-node .p360-dot {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform var(--v2-dur-hover, 160ms) var(--v2-ease-out, ease-out), stroke-width 160ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .p360-click:hover .p360-dot { transform: scale(1.2); }
}
.p360-click:focus-visible .p360-dot { stroke: var(--accent-2); stroke-width: 2.6; }
@keyframes p360-ripple {
  0% { transform: scale(1); opacity: 0.75; }
  100% { transform: scale(2.3); opacity: 0; }
}
.p360-ripple {
  transform-box: fill-box;
  transform-origin: center;
  animation: p360-ripple 2.2s var(--v2-ease-out, ease-out) infinite;
}
@keyframes p360-ripple-lg {
  0% { transform: scale(0.95); opacity: 0.5; }
  100% { transform: scale(2.2); opacity: 0; }
}
.p360-ripple-lg {
  transform-box: fill-box;
  transform-origin: center;
  animation: p360-ripple-lg 3.2s var(--v2-ease-out, ease-out) infinite;
}
.p360-ripple-lg-2 { animation-delay: 1.6s; }
@media (prefers-reduced-motion: reduce) {
  .p360-ripple, .p360-ripple-lg { animation: none; opacity: 0; }
  .p360-node .p360-dot { transition: none; }
}
`;

export default Player360;


/* ------------------------------------------------------------------ across labels */

const LABEL_HUE: Record<string, string> = { "2K": "var(--accent)", ROCKSTAR: "var(--warn)", ZYNGA: "var(--good)" };
const LABEL_NAME: Record<string, string> = { "2K": "2K", ROCKSTAR: "Rockstar", ZYNGA: "Zynga" };

function AcrossLabelsCard({ x, name, reduce }: { x: NonNullable<Player360Response["cross_label"]>; name: string; reduce: boolean }) {
  const other = x.titles.filter((t) => t.studio !== x.home_studio);
  const friendsOther = x.home_studio === "ROCKSTAR" ? x.friends.twok : x.friends.rockstar;
  const friendsOtherLabel = x.home_studio === "ROCKSTAR" ? "2K" : "Rockstar";
  return (
    <motion.div
      className="pointer-events-auto absolute right-4 top-[112px] z-10 w-[280px] rounded-[var(--radius)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] p-4 shadow-[var(--shadow)] backdrop-blur"
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: reduce ? 0 : 0.6 }}
    >
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">Across labels</div>
      <div className="mt-1 text-[13px] font-medium text-[var(--text)]">{name} plays {new Set(x.titles.map((t) => t.studio)).size} labels</div>
      <div className="mt-3 space-y-1.5">
        {x.titles.slice(0, 6).map((t, i) => (
          <motion.div
            key={t.franchise}
            className="flex items-center justify-between gap-2 text-[12px]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.75 + i * 0.06 }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LABEL_HUE[t.studio] }} />
              <span className="truncate text-[var(--text)]">{t.title}</span>
            </span>
            <span className="shrink-0 text-[var(--text-faint)] v2-tabular">{t.spend_usd > 0 ? `$${Math.round(t.spend_usd).toLocaleString()}` : LABEL_NAME[t.studio]}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-[12px] text-[var(--text-dim)]">
        <div>
          <span className="font-semibold text-[var(--text)] v2-tabular">{friendsOther}</span> of {x.friends.total} friends also play {friendsOtherLabel} titles
          {x.friends.zynga > 0 && x.home_studio !== "ZYNGA" ? (
            <>
              , <span className="font-semibold text-[var(--text)] v2-tabular">{x.friends.zynga}</span> play Zynga
            </>
          ) : null}
        </div>
        {x.coplay_other_label > 0 && (
          <div>
            Co-plays with <span className="font-semibold text-[var(--text)] v2-tabular">{x.coplay_other_label}</span> players from other labels
          </div>
        )}
        {other.length > 0 && (
          <div>
            Active this month in {other.filter((t) => t.last_played && Date.parse(t.last_played) > Date.now() - 40 * 86400000).map((t) => t.title).join(", ") || other.map((t) => t.title).join(", ")}
          </div>
        )}
        {x.gta6_wishlisted && <div className="text-[var(--warn)]">GTA VI wishlisted</div>}
        {(x.invites.sent_accepted > 0 || x.invites.joined_by_invite > 0) && (
          <div>
            {x.invites.sent_accepted > 0 ? `Brought ${x.invites.sent_accepted} friend${x.invites.sent_accepted > 1 ? "s" : ""} into another label's title` : "Joined a title through a friend's invite"}
          </div>
        )}
      </div>
    </motion.div>
  );
}
