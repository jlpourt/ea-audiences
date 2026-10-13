"use client";

import React from "react";

export interface StaggerListProps extends React.HTMLAttributes<HTMLDivElement> {
  stepMs?: number;
  as?: "div" | "ul" | "ol";
}

/**
 * Wraps each child element with `--i` index custom property and `.stagger-in`
 * class (35ms step by default, opacity + translateY(8px) over 300ms ease-out).
 * Never blocks pointer events.
 */
export function StaggerList({
  children,
  className = "",
  as: Component = "div",
  ...rest
}: StaggerListProps) {
  const items = React.Children.toArray(children);
  const Tag = Component as React.ElementType;

  return (
    <Tag className={className} {...rest}>
      {items.map((child, idx) => {
        if (!React.isValidElement(child)) return child;
        const existingStyle = (child.props as any)?.style || {};
        const existingClass = (child.props as any)?.className || "";
        return React.cloneElement(child as React.ReactElement<any>, {
          key: child.key ?? idx,
          style: {
            ...existingStyle,
            "--i": idx,
          } as React.CSSProperties,
          className: `stagger-in ${existingClass}`.trim(),
        });
      })}
    </Tag>
  );
}
