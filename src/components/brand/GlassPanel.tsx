"use client";

import React from "react";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  weight?: "light" | "heavy";
  hardwood?: boolean;
  enter?: boolean;
  as?: "div" | "section" | "aside" | "article";
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    {
      weight = "light",
      hardwood = false,
      enter = false,
      as: Component = "div",
      className = "",
      children,
      ...rest
    },
    ref
  ) {
    const surfaceClass = weight === "heavy" ? "glass-heavy" : "glass";
    const hardwoodClass = hardwood ? "hardwood-surface" : "";
    const enterClass = enter ? "glass-enter" : "";

    return (
      <Component
        ref={ref as any}
        className={`rounded-xl ${surfaceClass} ${hardwoodClass} ${enterClass} ${className}`}
        {...rest}
      >
        {children}
      </Component>
    );
  }
);
