"use client";

/**
 * <Reveal> staggered entrance for a group of siblings.
 *
 * Purpose: prevent a jarring change when a group of cards/rows arrives.
 * Ingredients: opacity + translateY (full transform string, GPU), optional
 * 4px blur so the surface reads as "materializing". 50ms stagger.
 * Reduced motion: opacity only, no movement, no blur.
 *
 * Usage:
 *   <Reveal className="grid grid-cols-3 gap-4">        // auto-wraps each child
 *     <Card/> <Card/> <Card/>
 *   </Reveal>
 *
 *   <Reveal manual className="grid ...">               // you place items
 *     <RevealItem className="col-span-2"><Card/></RevealItem>
 *   </Reveal>
 */
import { Children, isValidElement, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { STAGGER, ease } from "./springs";

type RevealTag = "div" | "section" | "ul" | "ol" | "li" | "article" | "span";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds between siblings. Default 0.05. */
  stagger?: number;
  /** Seconds before the first child. Default 0. */
  delay?: number;
  /** Rise distance in px. Default 10. */
  y?: number;
  /** Blur-in (px). Default 0 (off). 4 is a good "materialize" value. */
  blur?: number;
  /** "mount" animates immediately, "inView" when scrolled into view. */
  trigger?: "mount" | "inView";
  /** Only for trigger="inView". Default true. */
  once?: boolean;
  /** When true, children are NOT auto-wrapped; use <RevealItem>. */
  manual?: boolean;
  /** className applied to each auto-wrapped child. */
  itemClassName?: string;
  as?: RevealTag;
}

function itemVariants(y: number, blur: number, reduce: boolean): Variants {
  if (reduce) {
    return {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
    };
  }
  return {
    hidden: {
      opacity: 0,
      transform: `translateY(${y}px)`,
      ...(blur > 0 ? { filter: `blur(${blur}px)` } : {}),
    },
    show: {
      opacity: 1,
      transform: "translateY(0px)",
      ...(blur > 0 ? { filter: "blur(0px)" } : {}),
      transition: { duration: 0.5, ease: ease.out },
    },
  };
}

export function Reveal({
  children,
  className,
  stagger = STAGGER,
  delay = 0,
  y = 10,
  blur = 0,
  trigger = "mount",
  once = true,
  manual = false,
  itemClassName,
  as = "div",
}: RevealProps) {
  const reduce = !!useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : stagger,
        delayChildren: delay,
      },
    },
  };
  const triggerProps =
    trigger === "inView"
      ? { whileInView: "show", viewport: { once, margin: "-60px" } }
      : { animate: "show" };

  const variants = itemVariants(y, blur, reduce);

  return (
    <Comp className={className} initial="hidden" variants={container} {...triggerProps}>
      {manual
        ? children
        : Children.map(children, (child, i) =>
            child == null || child === false ? null : (
              <motion.div
                key={isValidElement(child) && child.key != null ? child.key : i}
                className={itemClassName}
                variants={variants}
              >
                {child}
              </motion.div>
            ),
          )}
    </Comp>
  );
}

export interface RevealItemProps {
  children: ReactNode;
  className?: string;
  y?: number;
  blur?: number;
  as?: RevealTag;
}

/** A single staggered child inside <Reveal manual>. */
export function RevealItem({ children, className, y = 10, blur = 0, as = "div" }: RevealItemProps) {
  const reduce = !!useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp className={className} variants={itemVariants(y, blur, reduce)}>
      {children}
    </Comp>
  );
}
