"use client";

/**
 * V2Shell: the Take-Two command center frame (single landing page).
 *
 *   [Take-Two]      [Take-Two command center]      [Explore] [arch] [theme] [J]
 *   ------------------------------------------------------------------------
 *   <PortfolioHome />  (own scroll container)
 *
 * One page for the whole portfolio: the 2K Core Finding up top, then how
 * players move between 2K, Rockstar Games and Zynga. There are no per-studio
 * sub-pages; the 2K Courtside storyline lives on the 2k-audiences-v2 branch.
 * "Explore" opens the existing graph workspace (free exploration).
 *
 * Must sit inside <StorylineProvider> (page.tsx wraps the whole app; V2App
 * bundles both for standalone use).
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import type { HomeProps } from "../home/Home";
import { PortfolioHome } from "../portfolio/PortfolioHome";
import { T2Mark } from "./LabelSwitcher";
import { ReferenceArchitectureButton, ReferenceArchitectureModal } from "./ReferenceArchitecture";
import { StepErrorBoundary, useStaleChunkReload } from "./StepErrorBoundary";
import { StorylineProvider } from "./StorylineProvider";
import { ThemeToggle } from "./ThemeToggle";

export interface V2ShellProps {
  homeProps: HomeProps;
  /** Opens the existing graph workspace (free exploration). */
  onExplore: () => void;
  /** Kept for page.tsx compatibility; the command center has no classic view. */
  onClassic?: () => void;
}

function TopBar({ onExplore }: Pick<V2ShellProps, "onExplore">) {
  const [archOpen, setArchOpen] = useState(false);
  return (
    <header className="v2-glass relative z-30 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-x-0 border-t-0 px-5">
      <div className="flex items-center gap-2.5 text-[var(--text)]">
        <T2Mark />
        <span className="text-[14px] font-semibold tracking-[-0.01em]">Take-Two Interactive</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] text-[var(--text-dim)]"
      >
        <span className="v2-live-dot" />
        Take-Two command center
      </motion.div>

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

function ShellBody({ homeProps, onExplore }: V2ShellProps) {
  useStaleChunkReload();
  return (
    <div className="v2-root flex h-[100dvh] w-screen flex-col overflow-hidden">
      <TopBar onExplore={onExplore} />
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
          <StepErrorBoundary stepLabel="Take-Two command center">
            <PortfolioHome homeProps={homeProps} />
          </StepErrorBoundary>
        </div>
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
