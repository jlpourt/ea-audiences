"use client";

/**
 * Interaction primitives.
 *
 * <Magnetic>  pulls its child toward the pointer with a soft spring.
 *   Purpose: delight on rare, high-value CTAs (hero prompt submit, task cards).
 *   Fine-pointer hover only; disabled for reduced motion and touch.
 *   Uses motion values, never React state, so no re-render per pointer move.
 *
 * <Pressable> a motion.button with press-scale feedback (0.97, snappy spring).
 *   Purpose: feedback. Responds on pointer-down.
 *
 * <ActiveIndicator> a shared-layout pill that glides between the active item
 *   of a segmented control / step indicator / chip row. Place it inside the
 *   active item only; give every group a unique `layoutId`.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
} from "framer-motion";
import { springs } from "./springs";

function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFine(mq.matches);
    const on = (e: MediaQueryListEvent) => setFine(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return fine;
}

export interface MagneticProps {
  children: ReactNode;
  /** 0 to 1, fraction of pointer offset to follow. Default 0.25. */
  strength?: number;
  /** Max travel in px. Default 10. */
  max?: number;
  className?: string;
  /** Render inline (span) instead of block (div). */
  inline?: boolean;
}

export function Magnetic({ children, strength = 0.25, max = 10, className, inline }: MagneticProps) {
  const reduce = useReducedMotion();
  const fine = useFinePointer();
  const enabled = fine && !reduce;
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, springs.magnetic as { stiffness: number; damping: number; mass: number });
  const sy = useSpring(my, springs.magnetic as { stiffness: number; damping: number; mass: number });
  const transform = useMotionTemplate`translate3d(${sx}px, ${sy}px, 0)`;

  const onMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!enabled || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * strength;
      const dy = (e.clientY - (r.top + r.height / 2)) * strength;
      mx.set(Math.max(-max, Math.min(max, dx)));
      my.set(Math.max(-max, Math.min(max, dy)));
    },
    [enabled, strength, max, mx, my],
  );
  const onLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  const Comp = inline ? motion.span : motion.div;
  return (
    <Comp
      ref={ref as never}
      className={className}
      style={{ transform: enabled ? transform : undefined, display: inline ? "inline-block" : undefined }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </Comp>
  );
}

export type PressableProps = HTMLMotionProps<"button"> & {
  /** Press scale. Default 0.97. */
  pressScale?: number;
  /** Subtle hover lift in px (fine pointer only). Default 0. */
  hoverLift?: number;
};

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { pressScale = 0.97, hoverLift = 0, transition, type = "button", ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={reduce ? { opacity: 0.85 } : { scale: pressScale }}
      whileHover={!reduce && hoverLift ? { y: -hoverLift } : undefined}
      transition={transition ?? springs.snappy}
      {...rest}
    />
  );
});

export interface ActiveIndicatorProps extends Omit<ComponentPropsWithoutRef<"span">, "style"> {
  /** Unique per group, e.g. layoutIds.segmented("intent"). */
  layoutId: string;
  className?: string;
}

/** The gliding pill. Render inside the active item (position: relative). */
export function ActiveIndicator({ layoutId, className, ...rest }: ActiveIndicatorProps) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className={`absolute inset-0 -z-0 ${className ?? ""}`}
      transition={springs.snappy}
      {...(rest as object)}
    />
  );
}
