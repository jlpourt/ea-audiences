"use client";

/**
 * <FlowCanvas> Curtis-style infinite pan/zoom canvas (no dependencies).
 *
 * - Drag the background to pan; trackpad scroll pans; pinch or ctrl/cmd + wheel zooms
 *   around the cursor. Zoom % / − / + / Reset controls top-right.
 * - Children render in world space (1 unit = 1px at 100%). Transform is driven by
 *   motion values (translate3d + scale) so panning never re-renders React.
 * - Elements marked `data-no-pan` (cards, buttons) keep normal pointer behaviour.
 * Reduced motion: zoom/reset jump instead of springing.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { Minus, Plus, RotateCcw, Hand } from "lucide-react";
/** Mirrors springs.gentle (src/components/v2/motion/springs.ts) typed for animate(motionValue). */
const GENTLE = { type: "spring" as const, stiffness: 220, damping: 28 };
/** Auto-fit never goes below this zoom, so card text stays legible on a 1440×900 laptop. */
const READABLE_ZOOM = 0.66;

export interface FlowCanvasProps {
  children: ReactNode;
  world: { w: number; h: number };
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  /** Overlay rendered in screen space (top-left), e.g. a legend. */
  overlay?: ReactNode;
}

export function FlowCanvas({ children, world, minZoom = 0.3, maxZoom = 1.6, className, overlay }: FlowCanvasProps) {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const z = useMotionValue(0.7);
  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0) scale(${z})`;
  const [pct, setPct] = useState(70);
  const [grabbing, setGrabbing] = useState(false);
  const fitted = useRef(false);
  /** Set once the viewer pans or zooms; until then the view re-fits as content grows. */
  const touched = useRef(false);
  useMotionValueEvent(z, "change", (v) => setPct(Math.round(v * 100)));

  const clamp = useCallback((v: number) => Math.min(maxZoom, Math.max(minZoom, v)), [minZoom, maxZoom]);

  const go = useCallback(
    (nx: number, ny: number, nz: number) => {
      if (reduce) {
        x.set(nx);
        y.set(ny);
        z.set(nz);
        return;
      }
      animate(x, nx, GENTLE);
      animate(y, ny, GENTLE);
      animate(z, nz, GENTLE);
    },
    [reduce, x, y, z]
  );

  const fit = useCallback(
    (instant = false) => {
      const el = ref.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      // Leave a top band for the zoom controls so they never cover a node.
      const TOP = 64;
      // Fit the width; only shrink for height down to a readable floor, then let the
      // viewer pan down for the tail of the tallest column.
      const widthFit = (cw - 48) / world.w;
      const heightFit = (ch - TOP - 24) / world.h;
      const nz = clamp(Math.min(widthFit, Math.max(heightFit, READABLE_ZOOM)));
      const nx = Math.max(24, (cw - world.w * nz) / 2);
      const ny = TOP + Math.max(0, (ch - TOP - 24 - world.h * nz) / 2);
      if (instant) {
        x.set(nx);
        y.set(ny);
        z.set(nz);
      } else go(nx, ny, nz);
    },
    [clamp, go, world.w, world.h, x, y, z]
  );

  // First fit once the container has a size.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!fitted.current && el.clientWidth > 0) {
        fitted.current = true;
        fit(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // Re-fit when the world grows (content streamed in), unless the viewer took control.
  useEffect(() => {
    if (fitted.current && !touched.current) fit(false);
  }, [world.h, world.w, fit]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number, instant: boolean) => {
      const cz = z.get();
      const nz = clamp(cz * factor);
      const k = nz / cz;
      const nx = cx - (cx - x.get()) * k;
      const ny = cy - (cy - y.get()) * k;
      if (instant) {
        x.set(nx);
        y.set(ny);
        z.set(nz);
      } else go(nx, ny, nz);
    },
    [clamp, go, x, y, z]
  );

  // Wheel: pinch / ctrl+wheel zooms at cursor; plain wheel pans. Non-passive so we can preventDefault.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touched.current = true;
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top, true);
      } else {
        x.set(x.get() - e.deltaX);
        y.set(y.get() - e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, x, y]);

  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-pan]")) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: x.get(), oy: y.get() };
    touched.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGrabbing(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    x.set(d.ox + e.clientX - d.sx);
    y.set(d.oy + e.clientY - d.sy);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      setGrabbing(false);
    }
  };

  const zoomCenter = (f: number) => {
    const el = ref.current;
    if (!el) return;
    touched.current = true;
    zoomAt(f, el.clientWidth / 2, el.clientHeight / 2, false);
  };

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden select-none ${className ?? ""}`}
      style={{
        cursor: grabbing ? "grabbing" : "grab",
        touchAction: "none",
        backgroundColor: "var(--bg)",
        backgroundImage: "radial-gradient(var(--grid) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // overflow:hidden can still be scrolled by focus/scrollIntoView; keep the camera in charge.
      onScroll={(e) => {
        e.currentTarget.scrollTop = 0;
        e.currentTarget.scrollLeft = 0;
      }}
    >
      <motion.div
        className="absolute left-0 top-0"
        style={{ width: world.w, height: world.h, transform, transformOrigin: "0 0", willChange: "transform" }}
      >
        {children}
      </motion.div>

      {overlay && (
        <div className="pointer-events-none absolute left-4 top-4" data-no-pan>
          {overlay}
        </div>
      )}

      <div
        data-no-pan
        className="v2-glass absolute right-4 top-4 flex items-center gap-1 rounded-[var(--radius-md)] px-1.5 py-1 text-[var(--text-dim)] shadow-[var(--shadow)]"
      >
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomCenter(1 / 1.2)}
          className="v2-press grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <Minus size={15} />
        </button>
        <span className="v2-tabular w-12 text-center text-[13px] font-medium text-[var(--text)]">{pct}%</span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomCenter(1.2)}
          className="v2-press grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <Plus size={15} />
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => {
            touched.current = false;
            fit(false);
          }}
          className="v2-press flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[12px] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <RotateCcw size={13} /> Reset
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <span className="grid h-8 w-8 place-items-center" title="Drag to pan · pinch or ⌘ + scroll to zoom">
          <Hand size={15} />
        </span>
      </div>
    </div>
  );
}

/** Rect of `el` in world units, walking offsetParents up to `world`. */
export function worldRect(el: HTMLElement, world: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== world) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}
