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
 *   <StepTransition stepKey={scene} direction={dir}>{renderScene(step)}</StepTransition>
 *
 * Guarantees (QA):
 *  - mode="wait": the exiting scene fully unmounts before the next one mounts,
 *    so there is exactly one instance of a scene in the DOM at rest and never
 *    two interactive copies stacked on top of each other.
 *  - While exiting, the scene is inert + aria-hidden + pointer-events:none,
 *    so it can never intercept a click or be read by assistive tech.
 *  - Exit is fast (160ms); enter carries the motion (320ms).
 *  - Pass content whose step is fixed by props (not read from context) so the
 *    exiting copy keeps rendering its own step, not the incoming one.
 */
import type { ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { ease } from "./springs";

export interface StepTransitionProps {
  stepKey: string;
  /** 1 forward, -1 back. Default 1. */
  direction?: 1 | -1;
  children: ReactNode;
  className?: string;
}

function Scene({ direction, className, children }: { direction: 1 | -1; className?: string; children: ReactNode }) {
  const reduce = !!useReducedMotion();
  const present = useIsPresent();
  const d = 24 * direction;
  const inertProps = present ? {} : ({ inert: "", "aria-hidden": true } as Record<string, unknown>);
  return (
    <motion.div
      className={className}
      style={{ pointerEvents: present ? undefined : "none" }}
      {...inertProps}
      initial={
        reduce ? { opacity: 0 } : { opacity: 0, transform: `translateX(${d}px)`, filter: "blur(6px)" }
      }
      animate={
        reduce
          ? { opacity: 1, transition: { duration: 0.18, ease: ease.out } }
          : {
              opacity: 1,
              transform: "translateX(0px)",
              filter: "blur(0px)",
              transition: { duration: 0.32, ease: ease.out },
            }
      }
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.12 } }
          : {
              opacity: 0,
              transform: `translateX(${-d * 0.5}px)`,
              filter: "blur(4px)",
              transition: { duration: 0.16, ease: ease.out },
            }
      }
    >
      {children}
    </motion.div>
  );
}

export function StepTransition({ stepKey, direction = 1, children, className }: StepTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Scene key={stepKey} direction={direction} className={className}>
        {children}
      </Scene>
    </AnimatePresence>
  );
}
