"use client";

import React from "react";
import type { TakeTwoLabel } from "@/lib/types";

export interface BrandLockupProps {
  size?: "sm" | "md" | "lg";
  showEyebrow?: boolean;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export function BrandLockup({
  size = "md",
  showEyebrow = true,
  subtitle,
  className = "",
  onClick,
}: BrandLockupProps) {
  const logoDims =
    size === "sm" ? "h-5 w-auto" : size === "lg" ? "h-8 w-auto" : "h-6 w-auto";
  const titleSize =
    size === "sm"
      ? "text-base"
      : size === "lg"
        ? "text-2xl"
        : "text-lg";

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-3 text-left ${
        onClick ? "cursor-pointer group" : ""
      } ${className}`}
    >
      <div className="relative flex items-center justify-center rounded-md bg-twok-red/10 border border-twok-red/30 px-2 py-1.5">
        <img
          src="/brands/2k/2k-logo.svg"
          alt="2K"
          className={`${logoDims} object-contain select-none`}
          draggable={false}
        />
      </div>
      <div className="flex flex-col leading-none">
        {showEyebrow && (
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-chalk-dim mb-0.5">
            {subtitle || "2K Ecosystem Identity Graph"}
          </span>
        )}
        <div className="flex items-baseline gap-2">
          <span
            className={`font-display font-semibold tracking-[-0.02em] text-chalk ${titleSize}`}
          >
            Courtside
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/[0.06] text-chalk-dim border border-white/[0.08]">
            NBA 2K27
          </span>
        </div>
      </div>
    </Wrapper>
  );
}

export interface LabelMarkProps {
  label: TakeTwoLabel | string;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
  className?: string;
}

const LABEL_META: Record<
  TakeTwoLabel,
  {
    name: string;
    logo: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  "2K": {
    name: "NBA 2K",
    logo: "/brands/2k/2k-logo.svg",
    color: "text-twok-red",
    bg: "bg-twok-red/12",
    border: "border-twok-red/35",
  },
  "2K_SPORTS": {
    name: "2K Sports",
    logo: "/brands/2k/2k-logo.svg",
    color: "text-amber-400",
    bg: "bg-amber-500/12",
    border: "border-amber-500/35",
  },
  "2K_CORE": {
    name: "2K Core",
    logo: "/brands/2k/2k-logo.svg",
    color: "text-cyan-400",
    bg: "bg-cyan-500/12",
    border: "border-cyan-500/35",
  },
};

export function LabelMark({
  label,
  size = "sm",
  showName = true,
  className = "",
}: LabelMarkProps) {
  const normalized: TakeTwoLabel =
    label === "2K_SPORTS" || label === "2K_CORE" ? label : "2K";
  const meta = LABEL_META[normalized];
  const imgSize =
    size === "xs" ? "h-3 w-auto" : size === "md" ? "h-4 w-auto" : "h-3.5 w-auto";
  const textSize =
    size === "xs" ? "text-[10px]" : size === "md" ? "text-xs" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono font-medium ${meta.bg} ${meta.border} ${meta.color} ${textSize} ${className}`}
    >
      <img
        src={meta.logo}
        alt={meta.name}
        className={`${imgSize} object-contain select-none`}
        draggable={false}
      />
      {showName && <span>{meta.name}</span>}
    </span>
  );
}
