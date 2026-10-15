"use client";

/**
 * V2Shell: the v2 storyline app frame.
 *
 *   [2K Courtside]      [‹ A · B · C · D ›]      [Explore] [Classic] [theme] [J]
 *   ------------------------------------------------------------------------
 *   <StepTransition> step content (own scroll container) </StepTransition>
 *
 * Must sit inside <StorylineProvider> (page.tsx wraps the whole app; V2App
 * bundles both for standalone use). Old screens stay reachable
 * via "Explore graph" (workspace) and "Classic" (previous landing).
 */
import { useEffect, useRef } from "react";
import { Compass, LayoutGrid } from "lucide-react";
import { LayoutGroup, StepTransition } from "../motion";
import type { HomeProps } from "../home/Home";
import { StepContent, sceneOf } from "./StepMounts";
import { StepIndicator } from "./StepIndicator";
import { StorylineProvider, useRegisterShell, useStoryline } from "./StorylineProvider";
import { ThemeToggle } from "./ThemeToggle";

export interface V2ShellProps {
  homeProps: HomeProps;
  /** Opens the existing graph workspace (free exploration). */
  onExplore: () => void;
  /** Shows the previous Courtside landing. */
  onClassic: () => void;
}

function TopBar({ onExplore, onClassic }: Pick<V2ShellProps, "onExplore" | "onClassic">) {
  const { goTo } = useStoryline();
  return (
    <header className="v2-glass relative z-30 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-x-0 border-t-0 px-5">
      <button
        type="button"
        onClick={() => goTo("A_HOME")}
        className="flex items-center gap-2.5 justify-self-start"
        aria-label="Courtside home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/2k/2k-logo.svg" alt="" className="h-6 w-6 rounded-[5px]" draggable={false} />
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">Courtside</span>
      </button>

      <StepIndicator />

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
        <ThemeToggle />
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-3)] text-[12px] font-semibold text-[var(--text)]"
          title="Jamie"
        >
          J
        </span>
      </div>
    </header>
  );
}

function ShellBody({ homeProps, onExplore, onClassic }: V2ShellProps) {
  const { step, direction } = useStoryline();
  const scroller = useRef<HTMLDivElement>(null);
  useRegisterShell();

  const scene = sceneOf(step);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [scene]);

  return (
    <div className="v2-root flex h-[100dvh] w-screen flex-col overflow-hidden">
      <TopBar onExplore={onExplore} onClassic={onClassic} />
      <div ref={scroller} className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <LayoutGroup id="storyline">
          <StepTransition stepKey={sceneOf(step)} direction={direction} className="min-h-full">
            <StepContent step={step} homeProps={homeProps} />
          </StepTransition>
        </LayoutGroup>
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
