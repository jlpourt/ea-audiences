"use client";

/**
 * <StepTransition> crossfades between storyline steps.
 *
 * Purpose: spatial consistency. Moving forward in the story slides content
 * in from the right and the old step out to the left; moving back reverses.
 * A 6px blur bridges the two states so it reads as one transformation.
 * Reduced motion: opacity crossfade only.
 *
 * Usage:
 *   <StepTransition stepKey={step} direction={dir}>{renderStep(step)}</StepTransition>
 *
 * Shared-element morphs between steps: give the source and target element the
 * same `layoutId` (see layoutIds in ./springs) and wrap the tree in
 * <LayoutGroup>. mode="popLayout" keeps both mounted briefly so the morph works.
 */
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ease } from "./springs";

export interface StepTransitionProps {
  stepKey: string;
  /** 1 forward, -1 back. Default 1. */
  direction?: 1 | -1;
  children: ReactNode;
  className?: string;
}

export function StepTransition({ stepKey, direction = 1, children, className }: StepTransitionProps) {
  const reduce = !!useReducedMotion();
  const d = 24 * direction;
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={stepKey}
        className={className}
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, transform: `translateX(${d}px)`, filter: "blur(6px)" }
        }
        animate={
          reduce
            ? { opacity: 1 }
            : { opacity: 1, transform: "translateX(0px)", filter: "blur(0px)" }
        }
        exit={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, transform: `translateX(${-d}px)`, filter: "blur(6px)" }
        }
        transition={{ duration: reduce ? 0.18 : 0.34, ease: ease.out }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
