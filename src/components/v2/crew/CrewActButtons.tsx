"use client";

/**
 * <CrewActButtons> One-click Pressure-Test -> Dispatch for a keystone or crew
 * target list.
 *
 * Pressure-Test: POST /api/v2/crew/act {action:"pressure_test"} resolves the live
 * cohort in Spanner + a real branded cosmetic, then hands { offerPreset,
 * cohortContext } to the existing Focus Group (via `onPressureTest`, or the
 * built-in <FocusGroupModal> bridge when no handler is passed).
 * Dispatch: POST /api/v2/crew/act {action:"dispatch"} -> existing
 * /api/activation/dispatch (Pub/Sub + BigQuery activation_log).
 *
 * Motion: press feedback (Pressable, 0.97 snappy spring); the Dispatch button
 * morphs into a success pill (layout spring + label crossfade, check draws in).
 * Occasional action, so a standard-tier animation; reduced motion = crossfade only.
 */
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FlaskConical, Send, Loader2, AlertTriangle } from "lucide-react";
import { Pressable, springs, ease } from "@/components/v2/motion";
import type { CrewFocusGroupHandoff, RetentionOffer } from "@/lib/v2/crew";
import { crewFetch, CrewApiError } from "./api";

const FocusGroupModal = dynamic(
  () => import("@/components/focusgroup/FocusGroupModal").then((m) => m.FocusGroupModal),
  { ssr: false },
);

export interface PressureTestResult {
  action: "pressure_test";
  target: { kind: string; ids: string[]; label: string; count: number; avg_spend: number; dominant_archetype: string };
  retention_offer: RetentionOffer;
  focus_group: CrewFocusGroupHandoff;
  latency_ms: number;
}

export interface DispatchResult {
  action: "dispatch";
  audience_id: string;
  offer: { id: string; title: string };
  target: { kind: string; ids: string[]; label: string; count: number };
  dispatch: { ok: boolean; topic: string; messageId: string; publishedAt: string; results: Array<{ channel: string; activationId: string }> };
  latency_ms: number;
}

export interface CrewActButtonsProps {
  kind: "keystones" | "crews";
  ids: string[];
  label?: string;
  channels?: string[];
  /** Receive the Focus Group payload. If omitted, the built-in Focus Group modal opens. */
  onPressureTest?: (handoff: CrewFocusGroupHandoff, result: PressureTestResult) => void;
  onDispatched?: (result: DispatchResult) => void;
  /** Notified after a successful Pressure-Test (does not replace the built-in Focus Group). */
  onTested?: (result: PressureTestResult) => void;
  /** Hide the inline offer / dispatch meta lines (when a parent renders them). */
  compactMeta?: boolean;
  className?: string;
}

type Phase = "idle" | "testing" | "tested" | "dispatching" | "dispatched";

export function CrewActButtons({ kind, ids, label, channels, onPressureTest, onDispatched, onTested, compactMeta, className }: CrewActButtonsProps) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [test, setTest] = useState<PressureTestResult | null>(null);
  const [done, setDone] = useState<DispatchResult | null>(null);
  const [error, setError] = useState<CrewApiError | null>(null);
  const [fgOpen, setFgOpen] = useState(false);
  const disabled = ids.length === 0;

  const pressureTest = useCallback(async () => {
    setError(null);
    setPhase("testing");
    try {
      const r = await crewFetch<PressureTestResult>("/api/v2/crew/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pressure_test", target: { kind, ids, label } }),
      });
      setTest(r);
      setPhase("tested");
      onTested?.(r);
      if (onPressureTest) onPressureTest(r.focus_group, r);
      else setFgOpen(true);
    } catch (e) {
      setError(e instanceof CrewApiError ? e : new CrewApiError(0, { error: String(e) }));
      setPhase(test ? "tested" : "idle");
    }
  }, [kind, ids, label, onPressureTest, onTested, test]);

  const dispatch = useCallback(async () => {
    if (!test) return;
    setError(null);
    setPhase("dispatching");
    try {
      const r = await crewFetch<DispatchResult>("/api/v2/crew/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "dispatch",
          target: { kind, ids, label: test.target.label },
          offer: test.focus_group.offerPreset,
          channels,
        }),
      });
      setDone(r);
      setPhase("dispatched");
      onDispatched?.(r);
    } catch (e) {
      setError(e instanceof CrewApiError ? e : new CrewApiError(0, { error: String(e) }));
      setPhase("tested");
    }
  }, [test, kind, ids, channels, onDispatched]);

  const testedOrLater = phase === "tested" || phase === "dispatching" || phase === "dispatched";

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Pressable
          onClick={pressureTest}
          disabled={disabled || phase === "testing" || phase === "dispatching"}
          className="v2-press relative inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 text-[13px] font-medium text-[var(--text)] disabled:opacity-50"
        >
          {phase === "testing" ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
          <span>{testedOrLater ? "Re-test" : "Pressure-Test"}</span>
        </Pressable>

        <motion.div layout transition={springs.snappy} className="relative">
          <Pressable
            onClick={dispatch}
            disabled={!testedOrLater || phase === "dispatching" || phase === "dispatched"}
            className={`relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-[var(--radius-pill)] px-4 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ${
              phase === "dispatched"
                ? "bg-[var(--good-soft)] text-[var(--good)]"
                : testedOrLater
                  ? "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-accent)]"
                  : "bg-[var(--surface-2)] text-[var(--text-faint)]"
            }`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {phase === "dispatched" ? (
                <motion.span
                  key="done"
                  className="inline-flex items-center gap-2"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: ease.out }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                    <motion.path
                      d="M3 8.5 L6.5 12 L13 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: reduce ? 1 : 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.32, delay: 0.08, ease: ease.out }}
                    />
                  </svg>
                  <span>Dispatched</span>
                </motion.span>
              ) : (
                <motion.span
                  key="go"
                  className="inline-flex items-center gap-2"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-8px)" }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-8px)" }}
                  transition={{ duration: 0.2, ease: ease.out }}
                >
                  {phase === "dispatching" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Dispatch</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Pressable>
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {!compactMeta && test && phase !== "dispatched" && (
          <motion.div
            key="offer"
            initial={{ opacity: 0, transform: "translateY(4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: ease.out }}
            className="text-[12px] text-[var(--text-dim)]"
          >
            <span className="text-[var(--text)]">{test.focus_group.offerPreset.title}</span>
            <span className="text-[var(--text-faint)]"> · {test.target.count.toLocaleString("en-US")} players · live cohort</span>
          </motion.div>
        )}
        {!compactMeta && done && (
          <motion.div
            key="done-meta"
            initial={{ opacity: 0, transform: "translateY(4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.22, ease: ease.out }}
            className="v2-tabular text-[12px] text-[var(--text-dim)]"
          >
            Pub/Sub <span className="text-[var(--text)]">{done.dispatch.topic}</span> · msg{" "}
            <span className="text-[var(--text)]">{done.dispatch.messageId}</span> · BigQuery activation_log ×
            {done.dispatch.results.length}
          </motion.div>
        )}
        {error && (
          <motion.div
            key="err"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--bad-soft)] bg-[var(--bad-soft)] px-3 py-2 text-[12px] text-[var(--bad)]"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {error.service ? `${error.service}: ` : ""}
              {error.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {!onPressureTest && test && typeof document !== "undefined" && createPortal(
        // Portal to <body> with its own stacking context so the Focus Group sits above
        // the deep-dive sheet (z-73) instead of being trapped beneath it.
        <div style={{ position: "relative", zIndex: 90 }}>
        <FocusGroupModal
          isOpen={fgOpen}
          onClose={() => setFgOpen(false)}
          cohortContext={test.focus_group.cohortContext}
          selectedGame="NBA2K"
          graphData={{ nodes: [], links: [] }}
          initialCreativeTitle={test.focus_group.initialCreativeTitle}
          initialFranchise="NBA2K"
          onGenerateBrief={() => undefined}
          offerPreset={test.focus_group.offerPreset}
          targetCohort={test.focus_group.targetCohort}
        />
        </div>,
        document.body,
      )}
    </div>
  );
}
