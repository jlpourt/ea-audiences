"use client";

/**
 * ThemeToggle: flips data-theme on <html> between dark (default) and light,
 * persisted to localStorage. The inline boot script in layout.tsx applies the
 * stored theme before first paint. The brightness change is eased via the
 * transient `theme-transition` class (tokens.css), never an abrupt jump.
 * Icon swap: rotate + fade, snappy spring (feedback, occasional use).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { springs } from "../motion/springs";

export const THEME_STORAGE_KEY = "courtside-theme";
export type Theme = "dark" | "light";

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.setAttribute("data-theme", t);
  root.classList.toggle("dark", t === "dark");
  window.setTimeout(() => root.classList.remove("theme-transition"), 280);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-theme");
    setTheme(cur === "light" ? "light" : "dark");
  }, []);
  const set = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* storage unavailable (private mode); theme still applies for the session */
    }
  };
  return [theme, set];
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const reduce = useReducedMotion();
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`v2-press relative grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--border-strong)] ${className ?? ""}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
          transition={springs.snappy}
          className="grid place-items-center"
        >
          {theme === "dark" ? <Moon size={14} strokeWidth={1.75} /> : <Sun size={14} strokeWidth={1.75} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
