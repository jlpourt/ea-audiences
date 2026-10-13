"use client";

import React, { useState } from "react";
import { Check, ChevronDown, Code2, Copy } from "lucide-react";

export interface GqlDisclosureProps {
  gql: string;
  whereClause?: string;
  matchPattern?: string;
  executionMs?: number;
  className?: string;
}

export function GqlDisclosure({
  gql,
  whereClause,
  matchPattern,
  executionMs,
  className = "",
}: GqlDisclosureProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!gql) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(gql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-court-black/60 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between px-3.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left font-mono text-[11px] text-chalk-dim hover:text-chalk"
        >
          <Code2 className="h-3.5 w-3.5 text-twok-red" />
          <span>Compiled Graph Query</span>
          {matchPattern && matchPattern !== "(p:Player)" && (
            <span className="rounded bg-rockstar-gold/15 px-1.5 py-0.5 text-[10px] text-rockstar-gold border border-rockstar-gold/30">
              Multi-Hop
            </span>
          )}
          {typeof executionMs === "number" && (
            <span className="tabular text-win-green">· {executionMs} ms</span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-chalk-dim hover:text-chalk"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-win-green" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy GQL</span>
            </>
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.08] bg-court-ink/90 p-3.5 font-mono text-xs space-y-2">
          {whereClause && (
            <div className="rounded-lg border border-twok-red/25 bg-twok-red/[0.06] px-2.5 py-1.5 text-[11px] text-chalk">
              <span className="text-twok-red font-semibold mr-1.5">WHERE</span>
              <span>{whereClause}</span>
            </div>
          )}
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-chalk-dim">
            {gql}
          </pre>
        </div>
      )}
    </div>
  );
}
