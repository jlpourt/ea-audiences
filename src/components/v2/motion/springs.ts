/**
 * Shared motion constants for 2K Courtside v2 (contract section 4).
 *
 * Rules every v2 component follows:
 *  - Animate transform + opacity only (clip-path / pathLength allowed for SVG).
 *  - Springs for anything interruptible (layout, hover, drag, indicators).
 *  - Strong ease-out curves for enter/exit; never ease-in.
 *  - Respect prefers-reduced-motion via `useReducedMotion()` (see ./reduced.ts).
 */
import type { Transition } from "framer-motion";

export const springs = {
  /** Default UI spring: indicators, chips, buttons, small layout moves. */
  snappy: { type: "spring", stiffness: 420, damping: 34 } as Transition,
  /** Larger surfaces: cards, panels, shared-element morphs. */
  gentle: { type: "spring", stiffness: 220, damping: 28 } as Transition,
  /** Momentum-driven only (a flick or release). Slight overshoot. */
  bouncy: { type: "spring", stiffness: 320, damping: 22 } as Transition,
  /** Magnetic hover follow. Soft and alive. */
  magnetic: { type: "spring", stiffness: 180, damping: 16, mass: 0.4 } as Transition,
} as const;

/** Cubic-bezier tuples for framer-motion `ease`. Mirror tokens.css. */
export const ease = {
  out: [0.23, 1, 0.32, 1] as [number, number, number, number],
  inOut: [0.77, 0, 0.175, 1] as [number, number, number, number],
  drawer: [0.32, 0.72, 0, 1] as [number, number, number, number],
} as const;

/** Seconds. UI animations stay under 300ms unless explanatory. */
export const durations = {
  press: 0.12,
  hover: 0.16,
  panel: 0.26,
  drawer: 0.32,
  /** Explanatory motion (edge draw, number tween, graph expand). */
  explain: 0.9,
} as const;

/** Stagger step between siblings, seconds (30 to 80ms band). */
export const STAGGER = 0.05;

/**
 * Shared-element layoutId conventions. Use these helpers rather than
 * hand-written strings so morphs line up across features.
 */
export const layoutIds = {
  playerCard: (id: string) => `player-card-${id}`,
  playerAvatar: (id: string) => `player-avatar-${id}`,
  crew: (id: string) => `crew-${id}`,
  creator: (handle: string) => `creator-${handle}`,
  brand: (id: string) => `brand-${id}`,
  /** Core Finding card on Home, morphs into the Player 360 header. */
  coreFinding: "core-finding",
  /** Active pill under the storyline step indicator. */
  stepIndicator: "storyline-step-indicator",
  /** Active pill under any segmented control; pass a unique group. */
  segmented: (group: string) => `segmented-${group}`,
} as const;
