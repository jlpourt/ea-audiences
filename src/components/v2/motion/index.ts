/**
 * v2 motion primitives. Import from "@/components/v2/motion".
 * Contract: docs/v2/CONTRACT.md section 4.
 */
export { springs, ease, durations, STAGGER, layoutIds } from "./springs";
export { Reveal, RevealItem } from "./Reveal";
export type { RevealProps, RevealItemProps } from "./Reveal";
export { Ticker } from "./Ticker";
export type { TickerProps } from "./Ticker";
export { AnimatedEdge, curvedPath, arcPath } from "./AnimatedEdge";
export type { AnimatedEdgeProps } from "./AnimatedEdge";
export { Magnetic, Pressable, ActiveIndicator } from "./Interactive";
export type { MagneticProps, PressableProps, ActiveIndicatorProps } from "./Interactive";
export { StepTransition } from "./StepTransition";
export type { StepTransitionProps } from "./StepTransition";
export { LayoutGroup, AnimatePresence, useReducedMotion } from "framer-motion";
