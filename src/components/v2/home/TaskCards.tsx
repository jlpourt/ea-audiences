"use client";

/**
 * Three agentic task cards. Each routes into a storyline step.
 * Filtering by intent uses layout animation + popLayout so remaining cards
 * glide into place (spatial consistency) instead of teleporting.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Crown, ScanSearch, TrendingUp, type LucideIcon } from "lucide-react";
import { STEP_META, type StorylineStep } from "../shell/StorylineProvider";
import { ease, springs } from "../motion";
import type { Intent } from "./PromptBar";

export interface TaskDef {
  id: string;
  title: string;
  icon: LucideIcon;
  step: StorylineStep;
  focus?: string;
  intents: Intent[];
}

export const TASKS: TaskDef[] = [
  {
    id: "churn-calibration",
    title: "Check whether our churn scores match who actually left",
    icon: ScanSearch,
    step: "METRICS",
    focus: "crew-churn",
    intents: ["player", "lifecycle"],
  },
  {
    id: "keystones",
    title: "Find keystone players about to take their crew with them",
    icon: Crown,
    step: "C_CREWS",
    focus: "keystones",
    intents: ["player", "lifecycle"],
  },
  {
    id: "creator-lift",
    title: "Rank creators by incremental retained players",
    icon: TrendingUp,
    step: "METRICS",
    focus: "creator",
    intents: ["creators"],
  },
];

export function TaskCards({
  intent,
  onRun,
}: {
  intent: Intent;
  onRun: (t: TaskDef) => void;
}) {
  const reduce = useReducedMotion();
  const visible = TASKS.filter((t) => intent === "all" || t.intents.includes(intent));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map((t, i) => {
          const Icon = t.icon;
          const meta = STEP_META[t.step];
          return (
            <motion.button
              layout={!reduce}
              key={t.id}
              type="button"
              onClick={() => onRun(t)}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(4px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(4px)" }}
              transition={{ ...springs.gentle, opacity: { duration: 0.2, ease: ease.out, delay: i * 0.03 } }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              className="group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-sm)] transition-[border-color,background-color] duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
              />
              <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] transition-transform duration-200 ease-out group-hover:-translate-y-0.5">
                <Icon size={17} strokeWidth={1.75} />
              </span>
              <span className="mt-4 block text-[15px] font-medium leading-[1.35] tracking-[-0.01em] text-[var(--text)]">
                {t.title}
              </span>
              <span className="mt-4 flex items-center justify-between text-[12px] text-[var(--text-faint)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[var(--surface-3)] text-[10px] font-semibold text-[var(--text-dim)]">
                    {meta.section}
                  </span>
                  {meta.label}
                </span>
                <ArrowRight
                  size={15}
                  strokeWidth={1.75}
                  className="text-[var(--text-dim)] transition-transform duration-200 ease-out group-hover:translate-x-1 group-hover:text-[var(--accent)]"
                />
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
