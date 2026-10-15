"use client";

/**
 * PromptBar + IntentChips.
 *
 * The prompt bar submits through the existing NL audience path
 * (page.tsx runAudienceQuery -> POST /api/audiences/nl-query), unchanged.
 * Typing never animates layout (keyboard rule). Focus gets a 160ms ring.
 * The submit button is magnetic (rare, high-value CTA).
 *
 * Intent chips: a segmented control whose active pill glides via layoutId.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { ActiveIndicator, Magnetic, layoutIds } from "../motion";

export type Intent = "all" | "player" | "lifecycle" | "creators";

export const INTENTS: { id: Intent; label: string; placeholder: string }[] = [
  { id: "all", label: "All", placeholder: "Ask anything about 2K players, crews, creators and brands" },
  { id: "player", label: "Player analysis", placeholder: "Players whose crew mates churned in the last 14 days" },
  { id: "lifecycle", label: "Lifecycle", placeholder: "Crew members with sessions down 30% week over week" },
  { id: "creators", label: "Creators & Brands", placeholder: "Viewers of creator streams who bought a branded item" },
];

export function PromptBar({
  intent,
  onSubmit,
  isSearching,
  error,
  onDismissError,
}: {
  intent: Intent;
  onSubmit: (q: string) => void;
  isSearching: boolean;
  error?: string | null;
  onDismissError?: () => void;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const placeholder = INTENTS.find((i) => i.id === intent)?.placeholder ?? INTENTS[0].placeholder;
  const canSubmit = q.trim().length > 2 && !isSearching;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(q.trim());
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div>
      <div
        className="group relative flex items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-4 pr-2.5 shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-[var(--border-strong)] focus-within:shadow-[0_0_0_4px_var(--accent-soft),var(--shadow)]"
        onClick={() => ref.current?.focus()}
      >
        <Sparkles size={17} strokeWidth={1.75} className="shrink-0 text-[var(--accent)]" />
        <textarea
          ref={ref}
          rows={1}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          aria-label="Ask Courtside"
          disabled={isSearching}
          className="max-h-28 min-h-[26px] flex-1 resize-none bg-transparent py-1 text-[15px] leading-[1.45] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none disabled:opacity-60"
          style={{ outline: "none" }}
        />
        <Magnetic inline strength={0.3} max={6}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              submit();
            }}
            disabled={!canSubmit}
            aria-label="Run query"
            className="v2-press grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--surface-3)] disabled:text-[var(--text-faint)] disabled:shadow-none"
          >
            {isSearching ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.25} />}
          </button>
        </Magnetic>
      </div>
      {error && (
        <div role="alert" className="mt-2 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bad-soft)] px-3 py-2 text-[12.5px] text-[var(--text)]">
          <span className="min-w-0 flex-1 truncate">{error}</span>
          {onDismissError && (
            <button type="button" onClick={onDismissError} aria-label="Dismiss" className="text-[var(--text-dim)] hover:text-[var(--text)]">
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function IntentChips({ value, onChange }: { value: Intent; onChange: (i: Intent) => void }) {
  return (
    <div role="tablist" aria-label="Intent" className="flex flex-wrap items-center gap-1.5">
      {INTENTS.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(it.id)}
            className={`v2-press relative isolate rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium ${
              active
                ? "border-transparent text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            }`}
          >
            {active && (
              <ActiveIndicator
                layoutId={layoutIds.segmented("home-intent")}
                className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-3)]"
              />
            )}
            <span className="relative z-10">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
