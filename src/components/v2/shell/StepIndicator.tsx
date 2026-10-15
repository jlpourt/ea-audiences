"use client";

/**
 * StepIndicator: the persistent A · B · C · D wayfinder.
 *
 * - Sections are pills; the active pill's background glides between sections
 *   (shared layoutId, snappy spring) so Jamie always sees where she is.
 * - Inside the active section, sub-step dots expand; the current dot morphs
 *   into a short accent bar (layoutId) as she moves through B and C.
 * - Prev / next chevrons mirror the Left / Right arrow keys.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActiveIndicator, layoutIds, springs } from "../motion";
import {
  SECTION_ENTRY,
  SECTION_LABEL,
  STEP_META,
  STORYLINE_STEPS,
  useStoryline,
  type StorylineSection,
} from "./StorylineProvider";

const SECTIONS: StorylineSection[] = ["A", "B", "C", "D"];

export function StepIndicator({ className }: { className?: string }) {
  const { step, section, index, goTo, next, prev } = useStoryline();
  const reduce = useReducedMotion();

  return (
    <nav aria-label="Storyline" className={`flex items-center gap-1 ${className ?? ""}`}>
      <button
        type="button"
        onClick={prev}
        disabled={index === 0}
        aria-label="Previous step"
        className="v2-press grid h-7 w-7 place-items-center rounded-full text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-30"
      >
        <ChevronLeft size={15} strokeWidth={1.75} />
      </button>

      <div className="flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-[3px]">
        {SECTIONS.map((s) => {
          const active = s === section;
          const steps = STORYLINE_STEPS.filter((st) => STEP_META[st].section === s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => goTo(SECTION_ENTRY[s])}
              aria-current={active ? "step" : undefined}
              className={`relative isolate flex h-7 items-center gap-2 rounded-full px-2.5 text-[12.5px] font-medium transition-colors duration-150 ${
                active ? "text-[var(--text)]" : "text-[var(--text-faint)] hover:text-[var(--text-dim)]"
              }`}
            >
              {active && (
                <ActiveIndicator
                  layoutId={layoutIds.stepIndicator}
                  className="rounded-full bg-[var(--surface-3)] shadow-[var(--shadow-sm)]"
                />
              )}
              <span
                className={`relative z-10 grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-semibold transition-colors duration-150 ${
                  active ? "bg-[var(--accent)] text-[var(--text-on-accent)]" : "bg-[var(--surface-2)]"
                }`}
              >
                {s}
              </span>
              <span className="relative z-10 whitespace-nowrap">{SECTION_LABEL[s]}</span>
              <AnimatePresence initial={false}>
                {active && steps.length > 1 && (
                  <motion.span
                    key="dots"
                    className="relative z-10 flex items-center gap-1 overflow-hidden"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, width: "auto" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
                    transition={springs.snappy}
                  >
                    {steps.map((st) => {
                      const cur = st === step;
                      return (
                        <span
                          key={st}
                          role="link"
                          tabIndex={0}
                          aria-label={STEP_META[st].label}
                          title={STEP_META[st].label}
                          onClick={(e) => {
                            e.stopPropagation();
                            goTo(st);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              goTo(st);
                            }
                          }}
                          className="relative grid h-4 w-3 cursor-pointer place-items-center"
                        >
                          <span className="h-[5px] w-[5px] rounded-full bg-[var(--text-faint)]" />
                          {cur && (
                            <motion.span
                              layoutId="storyline-substep"
                              transition={springs.snappy}
                              className="absolute h-[5px] w-3 rounded-full bg-[var(--accent)]"
                            />
                          )}
                        </span>
                      );
                    })}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={next}
        disabled={index === STORYLINE_STEPS.length - 1}
        aria-label="Next step"
        className="v2-press grid h-7 w-7 place-items-center rounded-full text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-30"
      >
        <ChevronRight size={15} strokeWidth={1.75} />
      </button>
    </nav>
  );
}
