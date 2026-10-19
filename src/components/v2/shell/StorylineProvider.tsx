"use client";

/**
 * StorylineProvider: the guided EBC flow (contract section 5).
 *
 *   A_HOME -> B_PLAYER -> B_SOCIAL -> METRICS -> C_CREWS -> ACT -> D_CONCEPT
 *
 * Holds the current step, travel direction (for transitions), the selected
 * player id and selected crew ids. Feature components read it with
 * `useStoryline()`; they never own navigation state themselves.
 *
 * Presenter affordances:
 *  - URL hash mirrors the step (#b-player) so a reload lands on the same step.
 *  - Left / Right arrow keys move between steps (ignored while typing).
 *  Both are active only while a storyline shell is mounted (useRegisterShell),
 *  so the provider can wrap the whole page without hijacking old screens.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type StorylineStep =
  | "A_HOME"
  | "B_PLAYER"
  | "B_SOCIAL"
  | "METRICS"
  | "C_CREWS"
  | "ACT"
  | "D_CONCEPT";

export type StorylineSection = "A" | "B" | "C" | "D";

export const STORYLINE_STEPS: StorylineStep[] = [
  "A_HOME",
  "B_PLAYER",
  "B_SOCIAL",
  "METRICS",
  "C_CREWS",
  "ACT",
  "D_CONCEPT",
];

/** One config object so renaming steps is a one-file change. */
export const STEP_META: Record<
  StorylineStep,
  { section: StorylineSection; label: string; short: string; hash: string }
> = {
  A_HOME: { section: "A", label: "Home", short: "Home", hash: "a-home" },
  B_PLAYER: { section: "B", label: "Player 360", short: "Player", hash: "b-player" },
  B_SOCIAL: { section: "B", label: "Social graph", short: "Social", hash: "b-social" },
  METRICS: { section: "B", label: "Signals", short: "Signals", hash: "b-metrics" },
  C_CREWS: { section: "C", label: "Crews at risk", short: "Crews", hash: "c-crews" },
  ACT: { section: "C", label: "Act", short: "Act", hash: "c-act" },
  D_CONCEPT: { section: "D", label: "Concept test", short: "Concept", hash: "d-concept" },
};

export const SECTION_LABEL: Record<StorylineSection, string> = {
  A: "Home",
  B: "Player 360",
  C: "Crews",
  D: "Concept",
};

/** First step of each section, used when jumping by section. */
export const SECTION_ENTRY: Record<StorylineSection, StorylineStep> = {
  A: "A_HOME",
  B: "B_PLAYER",
  C: "C_CREWS",
  D: "D_CONCEPT",
};

export interface GoToOptions {
  playerId?: string | null;
  crewIds?: string[];
  /** Optional hint for the target step, e.g. "creator" to spotlight a card. */
  focus?: string | null;
}

export interface StorylineContextValue {
  step: StorylineStep;
  section: StorylineSection;
  index: number;
  /** 1 when moving forward, -1 when moving back. Drives StepTransition. */
  direction: 1 | -1;
  goTo: (step: StorylineStep, opts?: GoToOptions) => void;
  next: () => void;
  prev: () => void;
  playerId: string | null;
  setPlayerId: (id: string | null) => void;
  crewIds: string[];
  setCrewIds: (ids: string[]) => void;
  toggleCrew: (id: string) => void;
  /** Hint set by goTo({ focus }); null when entering a step normally. */
  focus: string | null;
  /** True while a storyline shell (V2Shell) is on screen. */
  shellMounted: boolean;
  /** Internal: V2Shell calls this via useRegisterShell(). */
  _setShellMounted: (v: boolean) => void;
}

const StorylineContext = createContext<StorylineContextValue | null>(null);

function stepFromHash(): StorylineStep | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace(/^#/, "");
  const found = STORYLINE_STEPS.find((s) => STEP_META[s].hash === h);
  return found ?? null;
}

export function StorylineProvider({
  children,
  initialStep = "A_HOME",
  syncHash = true,
}: {
  children: ReactNode;
  initialStep?: StorylineStep;
  syncHash?: boolean;
}) {
  const [step, setStep] = useState<StorylineStep>(initialStep);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [crewIds, setCrewIds] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [shellMounted, setShellMounted] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;

  const goTo = useCallback((target: StorylineStep, opts?: GoToOptions) => {
    const from = STORYLINE_STEPS.indexOf(stepRef.current);
    const to = STORYLINE_STEPS.indexOf(target);
    setDirection(to >= from ? 1 : -1);
    if (opts?.playerId !== undefined) setPlayerId(opts.playerId);
    if (opts?.crewIds !== undefined) setCrewIds(opts.crewIds);
    setFocus(opts?.focus ?? null);
    setStep(target);
  }, []);

  const next = useCallback(() => {
    const i = STORYLINE_STEPS.indexOf(stepRef.current);
    if (i < STORYLINE_STEPS.length - 1) goTo(STORYLINE_STEPS[i + 1]);
  }, [goTo]);

  const prev = useCallback(() => {
    const i = STORYLINE_STEPS.indexOf(stepRef.current);
    if (i > 0) goTo(STORYLINE_STEPS[i - 1]);
  }, [goTo]);

  const toggleCrew = useCallback((id: string) => {
    setCrewIds((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }, []);

  // Hash -> step on mount and on back/forward.
  useEffect(() => {
    if (!syncHash || !shellMounted) return;
    const initial = stepFromHash();
    if (initial) setStep(initial);
    const onHash = () => {
      const s = stepFromHash();
      if (s && s !== stepRef.current) goTo(s);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [syncHash, goTo, shellMounted]);

  // Step -> hash.
  useEffect(() => {
    if (!syncHash || !shellMounted) return;
    const want = `#${STEP_META[step].hash}`;
    if (window.location.hash !== want) {
      window.history.replaceState(null, "", want);
    }
  }, [step, syncHash, shellMounted]);

  // Arrow keys for the presenter (not while typing).
  useEffect(() => {
    if (!shellMounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, shellMounted]);

  const value = useMemo<StorylineContextValue>(
    () => ({
      step,
      section: STEP_META[step].section,
      index: STORYLINE_STEPS.indexOf(step),
      direction,
      goTo,
      next,
      prev,
      playerId,
      setPlayerId,
      crewIds,
      setCrewIds,
      toggleCrew,
      focus,
      shellMounted,
      _setShellMounted: setShellMounted,
    }),
    [step, direction, goTo, next, prev, playerId, crewIds, toggleCrew, focus, shellMounted],
  );

  return <StorylineContext.Provider value={value}>{children}</StorylineContext.Provider>;
}

export function useStoryline(): StorylineContextValue {
  const ctx = useContext(StorylineContext);
  if (!ctx) throw new Error("useStoryline must be used inside <StorylineProvider>");
  return ctx;
}

/** V2Shell marks itself mounted so hash sync + arrow keys only run on storyline screens. */
export function useRegisterShell() {
  const ctx = useContext(StorylineContext);
  const set = ctx?._setShellMounted;
  useEffect(() => {
    if (!set) return;
    set(true);
    return () => set(false);
  }, [set]);
}

/** Non-throwing variant for components that can render outside the storyline. */
export function useOptionalStoryline(): StorylineContextValue | null {
  return useContext(StorylineContext);
}

/** Renders children with NO storyline, so storyline-aware components (e.g.
 *  Player360 in the Take-Two player drawer) keep their state local instead of
 *  driving the 2K step machine. */
export function StorylineIsolate({ children }: { children: ReactNode }) {
  return <StorylineContext.Provider value={null}>{children}</StorylineContext.Provider>;
}
