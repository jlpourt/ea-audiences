"use client";

/**
 * V2Shell: the v2 storyline app frame.
 *
 *   [Label ▾]      [‹ A · B · C · D ›]      [Explore] [Classic] [arch] [theme] [J]
 *   ------------------------------------------------------------------------
 *   <StepTransition> step content (own scroll container) </StepTransition>
 *
 * The logo is a publishing-label switcher (LabelSwitcher):
 *   "t2" -> Take-Two portfolio command center (default landing)
 *   "2k" -> the Courtside storyline. Only this mode registers the storyline
 *           shell, so hash sync and arrow-key navigation are off on Take-Two.
 * The label persists in ?label= and sessionStorage, so refresh and returning
 * from Explore/Classic land on the same view.
 *
 * Must sit inside <StorylineProvider> (page.tsx wraps the whole app; V2App
 * bundles both for standalone use). Old screens stay reachable
 * via "Explore graph" (workspace) and "Classic" (previous landing).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Compass, LayoutGrid } from "lucide-react";
import { LayoutGroup, StepTransition } from "../motion";
import type { HomeProps } from "../home/Home";
import { PortfolioHome } from "../portfolio/PortfolioHome";
import { LabelSwitcher, type PublishingLabel } from "./LabelSwitcher";
import { StepContent, sceneOf } from "./StepMounts";
import { ReferenceArchitectureButton, ReferenceArchitectureModal } from "./ReferenceArchitecture";
import { StepErrorBoundary, useStaleChunkReload } from "./StepErrorBoundary";
import { StepIndicator } from "./StepIndicator";
import { STEP_META, StorylineProvider, useRegisterShell, useStoryline } from "./StorylineProvider";
import { ThemeToggle } from "./ThemeToggle";

export interface V2ShellProps {
  homeProps: HomeProps;
  /** Opens the existing graph workspace (free exploration). */
  onExplore: () => void;
  /** Shows the previous Courtside landing. */
  onClassic: () => void;
}

const LABEL_KEY = "v2-label";

function readInitialLabel(): PublishingLabel {
  const url = new URL(window.location.href);
  const q = url.searchParams.get("label");
  if (q === "t2" || q === "2k") return q;
  // A deep link into a storyline step means 2K.
  const h = url.hash.replace(/^#/, "");
  if (h && h !== "a-home" && Object.values(STEP_META).some((m) => m.hash === h)) return "2k";
  const saved = sessionStorage.getItem(LABEL_KEY);
  return saved === "2k" ? "2k" : "t2";
}

function useLabel(): [PublishingLabel | null, (l: PublishingLabel) => void] {
  const [label, setLabelState] = useState<PublishingLabel | null>(null);
  useEffect(() => setLabelState(readInitialLabel()), []);
  const setLabel = useCallback((l: PublishingLabel) => {
    setLabelState(l);
    sessionStorage.setItem(LABEL_KEY, l);
    const url = new URL(window.location.href);
    url.searchParams.set("label", l);
    if (l === "t2") url.hash = "";
    window.history.replaceState(null, "", url.toString());
  }, []);
  return [label, setLabel];
}

function TopBar({
  onExplore,
  onClassic,
  label,
  onLabel,
}: Pick<V2ShellProps, "onExplore" | "onClassic"> & { label: PublishingLabel; onLabel: (l: PublishingLabel) => void }) {
  const [archOpen, setArchOpen] = useState(false);
  return (
    <header className="v2-glass relative z-30 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-x-0 border-t-0 px-5">
      <LabelSwitcher value={label} onChange={onLabel} />

      <AnimatePresence mode="wait" initial={false}>
        {label === "2k" ? (
          <motion.div key="steps" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            <StepIndicator />
          </motion.div>
        ) : (
          <motion.div
            key="portfolio"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] text-[var(--text-dim)]"
          >
            <span className="v2-live-dot" />
            Portfolio command center
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1.5 justify-self-end">
        <button
          type="button"
          onClick={onExplore}
          className="v2-press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          title="Open the graph workspace"
        >
          <Compass size={14} strokeWidth={1.75} />
          Explore
        </button>
        <button
          type="button"
          onClick={onClassic}
          className="v2-press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          title="Previous home"
        >
          <LayoutGrid size={14} strokeWidth={1.75} />
          Classic
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ReferenceArchitectureButton onClick={() => setArchOpen(true)} />
        <ThemeToggle />
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-3)] text-[12px] font-semibold text-[var(--text)]"
          title="Jamie"
        >
          J
        </span>
      </div>
      <ReferenceArchitectureModal open={archOpen} onClose={() => setArchOpen(false)} />
    </header>
  );
}

/** The 2K Courtside storyline. Registering the shell here (not in ShellBody)
 *  keeps hash sync and arrow keys scoped to the 2K view. */
function StorylineBody({ homeProps }: { homeProps: HomeProps }) {
  const { step, direction } = useStoryline();
  const scroller = useRef<HTMLDivElement>(null);
  useRegisterShell();

  const scene = sceneOf(step);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [scene]);

  return (
    <div ref={scroller} className="relative h-full overflow-y-auto overflow-x-hidden">
      <LayoutGroup id="storyline">
        <StepTransition stepKey={sceneOf(step)} direction={direction} className="min-h-full">
          <StepErrorBoundary stepLabel={STEP_META[step].label}>
            <StepContent step={step} homeProps={homeProps} />
          </StepErrorBoundary>
        </StepTransition>
      </LayoutGroup>
    </div>
  );
}

function ShellBody({ homeProps, onExplore, onClassic }: V2ShellProps) {
  const [label, setLabel] = useLabel();
  const { goTo } = useStoryline();
  const reduce = useReducedMotion();
  useStaleChunkReload();

  const open2K = useCallback(() => {
    goTo("A_HOME");
    setLabel("2k");
  }, [goTo, setLabel]);

  return (
    <div className="v2-root flex h-[100dvh] w-screen flex-col overflow-hidden">
      <TopBar onExplore={onExplore} onClassic={onClassic} label={label ?? "t2"} onLabel={setLabel} />
      <div className="relative min-h-0 flex-1">
        {label && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={label}
              className="absolute inset-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.01, transition: { duration: 0.16 } }}
            >
              {label === "t2" ? (
                <div className="h-full overflow-y-auto overflow-x-hidden">
                  <StepErrorBoundary stepLabel="Take-Two portfolio">
                    <PortfolioHome homeProps={homeProps} onOpen2K={open2K} />
                  </StepErrorBoundary>
                </div>
              ) : (
                <StorylineBody homeProps={homeProps} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export function V2Shell(props: V2ShellProps) {
  return <ShellBody {...props} />;
}

/** Provider + shell in one, for page.tsx. */
export function V2App(props: V2ShellProps) {
  return (
    <StorylineProvider>
      <V2Shell {...props} />
    </StorylineProvider>
  );
}

export default V2App;
