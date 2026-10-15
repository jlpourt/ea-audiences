"use client";

/**
 * Section A: v2 Home (Gemini-Enterprise-style workspace home).
 *
 *   greeting -> Core Finding (leads) -> prompt bar + intent chips
 *   -> 3 agentic task cards -> Weekly Executive Briefing -> Recent creatives
 *
 * Every number on this screen is live (Spanner Graph, BigQuery, Vertex AI,
 * Cloud Storage). Loading shows skeletons in the final shape; failures show
 * the service + message inline.
 */
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, RevealItem, ease } from "../motion";
import { useStoryline } from "../shell/StorylineProvider";
import { CoreFindingCard } from "./CoreFindingCard";
import { IntentChips, PromptBar, type Intent } from "./PromptBar";
import { RecentCreatives } from "./RecentCreatives";
import { TaskCards } from "./TaskCards";
import { WeeklyBriefingCard } from "./WeeklyBriefingCard";

export interface HomeProps {
  /** Existing NL audience path (page.tsx runAudienceQuery). */
  onSearch: (query: string, franchise?: string) => void;
  isSearching: boolean;
  searchError?: string | null;
  onDismissSearchError?: () => void;
  /** Opens the existing Creative Studio panel. */
  onOpenCreativeStudio: () => void;
  userName?: string;
}

function Greeting({ name }: { name: string }) {
  const reduce = useReducedMotion();
  const words = `Welcome back, ${name}`.split(" ");
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: ease.out }}
        className="mb-2 text-[13px] text-[var(--text-faint)]"
        suppressHydrationWarning
      >
        {today}
      </motion.div>
      <h1
        className="text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--text)]"
        aria-label={`Welcome back, ${name}`}
      >
        {words.map((w, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="mr-[0.24em] inline-block"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)", filter: "blur(8px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: ease.out, delay: 0.05 + i * 0.07 }}
          >
            {w}
          </motion.span>
        ))}
      </h1>
    </div>
  );
}

export function Home({
  onSearch,
  isSearching,
  searchError,
  onDismissSearchError,
  onOpenCreativeStudio,
  userName = "Jamie",
}: HomeProps) {
  const { goTo } = useStoryline();
  const [intent, setIntent] = useState<Intent>("all");

  return (
    <div className="relative">
      {/* Ambient light behind the greeting. Static; fades in once. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: ease.out }}
        className="pointer-events-none absolute inset-x-0 -top-10 h-[520px]"
        style={{
          background:
            "radial-gradient(ellipse 55% 65% at 18% 18%, var(--glow-1), transparent 72%), radial-gradient(ellipse 45% 55% at 82% 0%, var(--glow-2), transparent 72%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-[1120px] px-8 pb-20 pt-10">
        <Greeting name={userName} />

        <Reveal manual className="mt-8 flex flex-col gap-8" delay={0.25} stagger={0.08} y={14} blur={4}>
          <RevealItem>
            <CoreFindingCard
              onOpenPlayer={() => goTo("B_PLAYER")}
              onLoadCohort={(q, f) => onSearch(q, f)}
            />
          </RevealItem>

          <RevealItem className="flex flex-col gap-3">
            <PromptBar
              intent={intent}
              onSubmit={(q) => onSearch(q)}
              isSearching={isSearching}
              error={searchError}
              onDismissError={onDismissSearchError}
            />
            <IntentChips value={intent} onChange={setIntent} />
          </RevealItem>

          <RevealItem>
            <TaskCards intent={intent} onRun={(t) => goTo(t.step, { focus: t.focus ?? null })} />
          </RevealItem>

          <RevealItem>
            <WeeklyBriefingCard />
          </RevealItem>

          <RevealItem>
            <RecentCreatives onCreate={onOpenCreativeStudio} />
          </RevealItem>
        </Reveal>
      </div>
    </div>
  );
}

export default Home;
