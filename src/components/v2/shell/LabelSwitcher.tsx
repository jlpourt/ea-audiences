"use client";

/**
 * <LabelSwitcher /> The top-left logo doubles as a publishing-label switcher.
 *
 *   Take-Two Interactive  -> portfolio command center (default)
 *   2K                    -> the Courtside storyline (A -> D)
 *   Rockstar Games, Zynga -> listed but disabled: no data source is connected
 *                            to this demo, so nothing is shown for them.
 *
 * Motion: the mark cross-fades/scales between labels (AnimatePresence,
 * popLayout so the button width springs instead of jumping); the menu grows
 * from its top-left origin; the active row carries a shared highlight.
 * Keyboard: Enter/Space opens, Esc closes, arrow keys move between enabled rows.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export type PublishingLabel = "t2" | "2k";

/** Take-Two mark rendered as a mask so it follows the theme's text color. */
export function T2Mark({ className = "h-[22px] w-[29px]", src = "/brands/t2/t2-mark.svg" }: { className?: string; src?: string }) {
  return (
    <span
      aria-hidden
      className={`block bg-[var(--text)] ${className}`}
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

function TwoKMark({ className = "h-6 w-6" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brands/2k/2k-logo.svg" alt="" className={`${className} rounded-[5px]`} draggable={false} />;
}

function Initial({ letter }: { letter: string }) {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-faint)]">
      {letter}
    </span>
  );
}

const OPTIONS: Array<{
  id: PublishingLabel | "rockstar" | "zynga";
  name: string;
  sub: string;
  enabled: boolean;
}> = [
  { id: "t2", name: "Take-Two Interactive", sub: "Portfolio command center", enabled: true },
  { id: "2k", name: "2K", sub: "Courtside storyline", enabled: true },
  { id: "rockstar", name: "Rockstar Games", sub: "No data source connected", enabled: false },
  { id: "zynga", name: "Zynga", sub: "No data source connected", enabled: false },
];

function OptionMark({ id }: { id: string }) {
  if (id === "t2") return <T2Mark className="h-[18px] w-6" />;
  if (id === "2k") return <TwoKMark />;
  return <Initial letter={id === "rockstar" ? "R" : "Z"} />;
}

export function LabelSwitcher({ value, onChange }: { value: PublishingLabel; onChange: (l: PublishingLabel) => void }) {
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    // Focus the active row when the menu opens.
    const i = OPTIONS.findIndex((o) => o.id === value);
    requestAnimationFrame(() => itemRefs.current[i]?.focus());
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, value]);

  const moveFocus = (from: number, dir: 1 | -1) => {
    const enabled = OPTIONS.map((o, i) => (o.enabled ? i : -1)).filter((i) => i >= 0);
    const pos = enabled.indexOf(from);
    const next = enabled[(pos + dir + enabled.length) % enabled.length];
    itemRefs.current[next]?.focus();
  };

  const current = OPTIONS.find((o) => o.id === value)!;

  return (
    <div ref={rootRef} className="relative justify-self-start">
      <motion.button
        type="button"
        layout={!reduce}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Publishing label: ${current.name}. Switch label`}
        className="v2-press group flex h-10 items-center gap-2.5 rounded-full py-1 pl-1.5 pr-2.5 hover:bg-[var(--surface-2)]"
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        <span className="relative grid h-7 w-8 place-items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={value}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -8 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className="grid place-items-center"
            >
              {value === "t2" ? <T2Mark /> : <TwoKMark />}
            </motion.span>
          </AnimatePresence>
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]"
          >
            {value === "t2" ? "Take-Two" : "2K Courtside"}
          </motion.span>
        </AnimatePresence>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
          <ChevronDown size={14} className="text-[var(--text-faint)] group-hover:text-[var(--text-dim)]" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Publishing labels"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -2 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            style={{ transformOrigin: "top left" }}
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[300px] overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-lg)]"
          >
            <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]">Labels</div>
            {OPTIONS.map((o, i) => {
              const active = o.id === value;
              return (
                <div key={o.id}>
                  {i === 2 && <div className="mx-2 my-1.5 h-px bg-[var(--border)]" />}
                  <button
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    aria-disabled={!o.enabled}
                    disabled={!o.enabled}
                    onClick={() => {
                      if (!o.enabled) return;
                      onChange(o.id as PublishingLabel);
                      setOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        moveFocus(i, 1);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        moveFocus(i, -1);
                      }
                    }}
                    className={`relative flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left outline-none ${
                      o.enabled ? "hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)]" : "cursor-not-allowed opacity-55"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="v2-label-active"
                        className="absolute inset-0 rounded-[10px] bg-[var(--surface-3)]"
                        transition={{ type: "spring", stiffness: 480, damping: 38 }}
                      />
                    )}
                    <span className="relative grid w-7 place-items-center">
                      <OptionMark id={o.id} />
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-[var(--text)]">{o.name}</span>
                      <span className="block text-[11.5px] text-[var(--text-faint)]">{o.sub}</span>
                    </span>
                    {active && <Check size={14} className="relative text-[var(--accent)]" />}
                  </button>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
