"use client";

/**
 * <JourneyWorkspace /> One continuous "go deeper" workspace for the Take-Two demo.
 *
 * Replaces three stacked overlays (Player 360 drawer -> deep-dive sheet -> Act
 * drawer) with a single full-screen surface and a step rail. The player you open
 * stays pinned in the header the whole way, and every step hands off to the next:
 *
 *   1 Player              Player 360 (pillars -> social -> cross-label)
 *   2 Crew churn       B  churn exposure, anchor dependency, keystones
 *   3 Creators + brand B  incremental players, hubs, brand attach, social hops
 *   4 Spanner + BigQuery C crews that lost a core member, one federated query
 *   5 Synthetic testing D keystone offer on Step 4's crews: neural-flow pressure test, then dispatch
 *   6 Act across Take-Two  audience -> plan -> pressure test -> launch (inline)
 *
 * Every panel is the same live component as before (Spanner Graph, BigQuery,
 * Vertex AI); only the container changed. Visited steps stay mounted so going
 * back keeps a running test or a drafted plan.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Database, X } from "lucide-react";
import { Player360 } from "../player360";
import { StorylineIsolate } from "../shell/StorylineProvider";
import { ActionDrawer, type ForPlayerContext } from "../actions/ActionDrawer";
import { BrandTab, CreatorTab, CrewTab, TakeTwoLayer } from "../deepdive/DeepDiveSheet";
import { CrewActPanel, LostCoreMemberCard } from "../crew";
import type { CrossLabelCrewsResponse } from "@/app/api/v2/crosslabel/crews/route";
import { WARM_FOR_STUDIO, type PlayId, type Studio as PlayStudio } from "@/lib/v2/plays";

export type JourneyStep = "player" | "crew" | "creatorbrand" | "lost" | "concept" | "act";

export const JOURNEY_STEPS: { id: JourneyStep; section: string | null; label: string; next: string }[] = [
  { id: "player", section: null, label: "Player", next: "Why their crew matters" },
  { id: "crew", section: "B", label: "Crew churn", next: "Creators and brand" },
  { id: "creatorbrand", section: "B", label: "Creators + brand", next: "Find these crews live" },
  { id: "lost", section: "C", label: "Spanner + BigQuery", next: "Test the keystone offer" },
  { id: "concept", section: "D", label: "Synthetic testing", next: "Act across Take-Two" },
  { id: "act", section: null, label: "Act across Take-Two", next: "Back to the command center" },
];

export interface JourneyPlayer {
  player_id: string;
  gamer_tag: string;
  home_studio: PlayStudio | null;
}

export interface JourneyState {
  open: boolean;
  step: JourneyStep;
  /** null = the featured 2K keystone. */
  playerId: string | null;
  play: PlayId | null;
  segment: string | null;
}

const STUDIO_COLOR: Record<PlayStudio, string> = { "2K": "var(--accent)", ROCKSTAR: "var(--warn)", ZYNGA: "var(--good)" };
const STUDIO_LABEL: Record<PlayStudio, string> = { "2K": "2K", ROCKSTAR: "Rockstar Games", ZYNGA: "Zynga" };

function StepIntro({ eyebrow, title, line }: { eyebrow: string; title: string; line: string }) {
  return (
    <div className="mb-4">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]">{eyebrow}</div>
      <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.01em] text-[var(--text)]">{title}</h2>
      <p className="mt-1 max-w-[860px] text-[13.5px] leading-snug text-[var(--text-dim)]">{line}</p>
    </div>
  );
}

/** Across Take-Two bridge for Step 5: of the selected crews' members, who also plays Rockstar / Zynga (live). */
function CrewsAcrossTakeTwo({ crewIds, onAct }: { crewIds: string[]; onAct: () => void }) {
  const [data, setData] = useState<CrossLabelCrewsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const key = crewIds.join(",");
  useEffect(() => {
    if (!key) return;
    const ac = new AbortController();
    setData(null);
    setErr(null);
    fetch(`/api/v2/crosslabel/crews?ids=${encodeURIComponent(key)}`, { signal: ac.signal, cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(`${b.service ?? "api"}: ${b.message ?? b.error}`);
        setData(b as CrossLabelCrewsResponse);
      })
      .catch((e) => e?.name !== "AbortError" && setErr(String(e.message ?? e)));
    return () => ac.abort();
  }, [key]);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--warn)_35%,var(--border))] bg-[color-mix(in_oklab,var(--warn)_7%,var(--surface))] px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5 text-[13px] leading-snug text-[var(--text)]">
        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--warn)]">Across Take-Two</span>
        <span>
          {err ? (
            <span className="text-[var(--bad)]">{err}</span>
          ) : data ? (
            <>
              <b>{data.cross_label_members.toLocaleString("en-US")}</b> of the {data.members.toLocaleString("en-US")} players in these crews also play a Rockstar or Zynga title
              {data.titles.length ? <> ({data.titles.slice(0, 3).map((t) => `${t.title} ${t.players}`).join(" · ")})</> : null}. 2K&apos;s inbox is one channel; Take-Two can
              reach them where they already play.
            </>
          ) : (
            "Checking where else these crews play..."
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={onAct}
        className="v2-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)]"
      >
        Act across Take-Two <ArrowRight size={13} />
      </button>
    </div>
  );
}

export function JourneyWorkspace({
  state,
  onChange,
  onClose,
  onOpenInGraph,
  onLaunched,
}: {
  state: JourneyState;
  onChange: (patch: Partial<JourneyState>) => void;
  onClose: () => void;
  onOpenInGraph: (nl: string) => void;
  onLaunched: () => void;
}) {
  const reduce = useReducedMotion();
  const { open, step, playerId, play, segment } = state;
  const [player, setPlayer] = useState<JourneyPlayer | null>(null);
  const [forPlayer, setForPlayer] = useState<ForPlayerContext | null>(null);
  const [visited, setVisited] = useState<Set<JourneyStep>>(new Set([step]));
  /** Crews selected in Step 4 (Section C); Step 5's synthetic audience is built from them. */
  const [testCrews, setTestCrews] = useState<string[]>([]);
  const routedFor = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  // Keep every visited step mounted (hidden when inactive) so state survives going back.
  useEffect(() => {
    if (!open) return;
    setVisited((v) => (v.has(step) ? v : new Set(v).add(step)));
    scroller.current?.scrollTo({ top: 0 });
  }, [open, step]);

  // Fresh journey on close.
  useEffect(() => {
    if (open) return;
    setVisited(new Set());
    setTestCrews([]);
    setForPlayer(null);
    routedFor.current = null;
  }, [open]);

  // A new focal player resets the player-derived context.
  useEffect(() => {
    setPlayer(null);
    setForPlayer(null);
    routedFor.current = null;
  }, [playerId]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      // Let modals opened from inside a step (Focus Group, GQL) own Escape.
      if (e.key !== "Escape" || document.querySelector("[aria-modal='true']")) return;
      onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  /** Route Act to the live audience that actually contains the pinned player. */
  const routeActForPlayer = useCallback(
    async (p: JourneyPlayer) => {
      routedFor.current = p.player_id;
      const studio = p.home_studio ?? "2K";
      const res = await fetch(`/api/v2/actions/for-player?id=${encodeURIComponent(p.player_id)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      if (!res.ok) {
        setForPlayer({ gamer_tag: p.gamer_tag, matches: [], error: `${body.service ?? "api"}: ${body.message ?? body.error}` });
        onChange({ play: "warm_intro", segment: WARM_FOR_STUDIO[studio] });
        return;
      }
      const matches = (body.matches ?? []) as ForPlayerContext["matches"];
      setForPlayer({ gamer_tag: p.gamer_tag, matches });
      if (matches.length) onChange({ play: matches[0].play, segment: matches[0].segment });
      else onChange({ play: "warm_intro", segment: WARM_FOR_STUDIO[studio] });
    },
    [onChange],
  );

  // Entering Act without an explicit play: use the pinned player's audience.
  useEffect(() => {
    if (!open || step !== "act" || play) return;
    if (player && routedFor.current !== player.player_id) void routeActForPlayer(player);
    else if (!player && !playerId) onChange({ play: "save_elsewhere", segment: "fading_2k" });
  }, [open, step, play, player, playerId, routeActForPlayer, onChange]);

  const goTo = (s: JourneyStep) => onChange({ step: s });
  const actOn = (p: PlayId, seg?: string) => {
    setForPlayer(null);
    onChange({ step: "act", play: p, segment: seg ?? null });
  };

  if (!open) return null;

  const idx = JOURNEY_STEPS.findIndex((s) => s.id === step);
  const cur = JOURNEY_STEPS[idx];
  const tag = player?.gamer_tag ?? "this player";
  const show = (s: JourneyStep) => visited.has(s) || s === step;

  return (
    <>
      <motion.div
        key="journey-scrim"
        className="fixed inset-0 z-[72] bg-[var(--overlay)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.aside
        key="journey"
        role="dialog"
        aria-label="Go deeper"
        className="fixed inset-3 z-[73] flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)]"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
      >
        {/* header: pinned player + step rail */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => goTo("player")}
              className="v2-press inline-flex max-w-[240px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--text)] hover:border-[var(--border-strong)]"
              title="Back to Player 360"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: player?.home_studio ? STUDIO_COLOR[player.home_studio] : "var(--text-faint)" }} />
              <span className="truncate">
                <span className="text-[var(--text-faint)]">Following </span>
                {player?.gamer_tag ?? "featured 2K keystone"}
              </span>
            </button>
            <nav aria-label="Journey steps" className="flex items-center gap-0.5 rounded-full bg-[var(--surface-2)] p-1">
              {JOURNEY_STEPS.map((s, i) => {
                const active = s.id === step;
                const done = i < idx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goTo(s.id)}
                    aria-current={active ? "step" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] transition-[background-color,color] duration-200 ${
                      active ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 place-items-center rounded-full text-[9.5px] font-bold ${
                        active ? "bg-[var(--text)] text-[var(--bg)]" : done ? "bg-[var(--good)] text-white" : "bg-[var(--surface-3)] text-[var(--text-dim)]"
                      }`}
                    >
                      {done ? <Check size={9} strokeWidth={3} /> : i + 1}
                    </span>
                    {s.label}
                    {s.section && <span className="text-[10px] font-semibold text-[var(--text-faint)]">{s.section}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[11px] text-[var(--text-faint)] xl:inline-flex">
              <Database size={11} /> Spanner Graph · BigQuery · Gemini, live
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="v2-press grid h-8 w-8 place-items-center rounded-full text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* body */}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          {show("player") && (
            <div hidden={step !== "player"} className="relative h-full min-h-[560px]">
              <div className="pointer-events-none absolute bottom-[104px] left-4 z-20 flex items-center gap-3 rounded-full border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_85%,transparent)] px-3 py-1.5 text-[11px] text-[var(--text-dim)] backdrop-blur">
                <span className="text-[var(--text-faint)]">Friends who also play</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--warn)]" />Rockstar titles</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--good)]" />Zynga titles</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-3)]" />one label only</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--bad)]" />churned</span>
              </div>
              <StorylineIsolate>
                <Player360
                  key={playerId ?? "featured"}
                  playerId={playerId}
                  className="h-full"
                  onAct={() => goTo("act")}
                  onPlayerLoaded={(p) => setPlayer(p)}
                />
              </StorylineIsolate>
            </div>
          )}

          {show("crew") && (
            <div hidden={step !== "crew"} className="px-6 py-5">
              <StepIntro
                eyebrow="Step 2 · B · Crew churn metrics"
                title={player ? `Why ${player.gamer_tag}'s crew matters` : "Why keystones matter"}
                line={`${tag} is the kind of player a crew is built around. When a keystone fades, their neighbors churn faster: here is that effect across every 2K crew, measured live.`}
              />
              <CrewTab onAct={actOn} showActions={false} />
            </div>
          )}

          {show("creatorbrand") && (
            <div hidden={step !== "creatorbrand"} className="px-6 py-5">
              <StepIntro
                eyebrow="Step 3 · B · Creators and brand"
                title="Who else moves this audience"
                line={`Creators ${tag}'s friends watch and the brands they buy hang off the same Player node. Identity stitching and derived features enrich every profile, with no separate pipeline.`}
              />
              <CreatorTab />
              <div className="mt-8">
                <BrandTab playerId={player?.player_id ?? null} onAct={actOn} />
              </div>
            </div>
          )}

          {show("lost") && (
            <div hidden={step !== "lost"} className="px-6 py-5">
              <StepIntro
                eyebrow="Step 4 · C · Spanner + BigQuery"
                title="Find every crew like theirs, this week"
                line="One statement reads live crew membership from Spanner and joins retention and bookings history in BigQuery. Select crews and press Act to test the keystone offer on them in Step 5, with no separate analytics hop."
              />
              <TakeTwoLayer>
                One statement joins live Spanner crews with BigQuery history, with no separate analytics hop. Every cross-label Act uses the same pattern: audience from
                Spanner, holdout and readout in BigQuery.
              </TakeTwoLayer>
              <LostCoreMemberCard
                onAct={(ids) => {
                  setTestCrews(ids);
                  goTo("concept");
                }}
              />
            </div>
          )}

          {show("concept") && (
            <div hidden={step !== "concept"} className="px-6 py-5">
              <StepIntro
                eyebrow="Step 5 · D · Synthetic testing"
                title="Will a keystone offer hold these crews together?"
                line={
                  testCrews.length
                    ? `The ${testCrews.length} crew${testCrews.length > 1 ? "s" : ""} you picked lost their most central player this week. Pressure-Test runs the keystone offer through the neural flow on synthetic players built from their real rows, with crew and creator influence. Then dispatch it.`
                    : "Pick the crews that lost a core member in Step 4, then pressure-test the keystone offer on them here."
                }
              />
              {testCrews.length ? (
                <>
                  <CrewActPanel crewIds={testCrews} />
                  <CrewsAcrossTakeTwo crewIds={testCrews} onAct={() => goTo("act")} />
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-[13px] text-[var(--text-dim)]">
                  No crews selected yet.
                  <button
                    type="button"
                    onClick={() => goTo("lost")}
                    className="v2-press inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-3.5 py-1.5 text-[12.5px] text-[var(--text)]"
                  >
                    <ArrowLeft size={13} /> Pick crews in Step 4
                  </button>
                </div>
              )}
            </div>
          )}

          {show("act") && (
            <div hidden={step !== "act"} className={`${step === "act" ? "flex" : "hidden"} h-full flex-col px-6 py-5`}>
              <StepIntro
                eyebrow="Step 6 · Act across Take-Two"
                title={forPlayer ? `Act on players like ${forPlayer.gamer_tag}` : "Act on a real Take-Two audience"}
                line="Audience from Spanner, plan from Gemini, pressure test on 16 real players from the audience, launch with a holdout into BigQuery and Pub/Sub. Switch plays at the top right."
              />
              <div className="min-h-0 flex-1">
                {play ? (
                  <ActionDrawer
                    embedded
                    play={play}
                    initialSegment={segment}
                    forPlayer={forPlayer}
                    onSwitch={(p, seg) => onChange({ play: p, segment: seg })}
                    onClose={onClose}
                    onOpenPlayer={(id) => onChange({ playerId: id, step: "player", play: null, segment: null })}
                    onOpenInGraph={onOpenInGraph}
                    onLaunched={onLaunched}
                  />
                ) : (
                  <div className="v2-skeleton h-[640px] w-full rounded-[var(--radius-lg)]" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* footer: hand off to the next step */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-2.5">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => idx > 0 && goTo(JOURNEY_STEPS[idx - 1].id)}
            className="v2-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-[var(--text-dim)] hover:text-[var(--text)] disabled:opacity-40"
          >
            <ArrowLeft size={13} /> {idx > 0 ? JOURNEY_STEPS[idx - 1].label : "Back"}
          </button>
          <div className="hidden text-[11.5px] text-[var(--text-faint)] md:block">
            Step {idx + 1} of {JOURNEY_STEPS.length}
            {player?.home_studio ? ` · ${STUDIO_LABEL[player.home_studio]} player` : ""}
          </div>
          {idx < JOURNEY_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => goTo(JOURNEY_STEPS[idx + 1].id)}
              className="v2-press inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)]"
            >
              <span className="opacity-80">Next:</span> {cur.next}
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="v2-press inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              Done · back to the command center
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
}

export default JourneyWorkspace;
