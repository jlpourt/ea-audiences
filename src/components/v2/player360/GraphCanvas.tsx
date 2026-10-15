"use client";

/**
 * SVG ego-graph canvas for Player 360.
 *
 * Motion model: every node owns a pair of MotionValues (x, y) in a shared
 * registry. Nodes spring their own values to the layout target; edges derive
 * their `d` from the same values with useTransform, so an edge is glued to
 * its endpoints through every bloom, compress and re-centre. A node id that
 * survives a re-centre (the neighbor you clicked) travels to the middle
 * instead of being re-mounted: a shared-element transition for free.
 *
 * Purpose: explanation (the reveal is the story) + spatial consistency
 * (re-centring shows where the new focal player came from).
 * Ingredients: springs.gentle for travel, ease-out opacity for entry,
 * CSS keyframes for ambient ripple / dash flow (off the main thread).
 * Reduced motion: positions jump, entries fade, no ripple, no flow.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  motionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  Calendar,
  Gamepad2,
  MonitorPlay,
  Radio,
  Shirt,
  Shield,
  Sparkles,
  Swords,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { springs } from "@/components/v2/motion";
import { VIEW, VIEWBOX, edgePath, type LEdge, type LNode, type Layout, type Stage } from "./layout";

// ---------------------------------------------------------------------------
// Position registry
// ---------------------------------------------------------------------------

interface PosEntry {
  x: MotionValue<number>;
  y: MotionValue<number>;
  alive: boolean;
}

type Registry = Map<string, PosEntry>;

/** Lazily create a node's position values from whichever component renders first. */
function regEntry(reg: Registry, id: string, fx: number, fy: number): PosEntry {
  let e = reg.get(id);
  if (!e) {
    e = { x: motionValue(fx), y: motionValue(fy), alive: false };
    reg.set(id, e);
  }
  return e;
}

// ---------------------------------------------------------------------------
// Visual vocabulary
// ---------------------------------------------------------------------------

const ICONS: Partial<Record<LNode["kind"], LucideIcon>> = {
  crew: Shield,
  match: Swords,
  season: Calendar,
  account: Gamepad2,
  stream: MonitorPlay,
  creator: Radio,
  item: Shirt,
  activation: Sparkles,
  brand: Tag,
};

function nodeFill(n: LNode): string {
  if (n.kind === "neighbor") return n.churned ? "var(--bad-soft)" : "var(--surface-3)";
  if (n.hop === 2) return "var(--surface)";
  if (n.kind === "match") return n.churned ? "var(--bad-soft)" : "var(--surface-2)";
  return "var(--surface-2)";
}

function nodeStroke(n: LNode): string {
  if (n.kind === "neighbor") {
    if (n.churned) return "var(--bad)";
    if (n.keystone) return "var(--accent)";
    return "var(--border-strong)";
  }
  if (n.kind === "match" && n.churned) return "var(--bad)";
  if (n.hop === 2) return "var(--border-strong)";
  if (n.kind === "season" || n.kind === "creator" || n.kind === "brand" || n.kind === "crew") return "var(--text-dim)";
  return "var(--border-strong)";
}

function edgeStyle(e: LEdge): { stroke: string; width: number; opacity: number; dash?: string } {
  switch (e.kind) {
    case "PLAYED_WITH":
      return e.churned
        ? { stroke: "var(--bad)", width: 0.8 + 3.2 * e.weight, opacity: 0.55 }
        : { stroke: "var(--text)", width: 0.6 + 3.4 * e.weight, opacity: 0.14 + 0.36 * e.weight };
    case "FRIENDS_WITH":
      return { stroke: "var(--text-dim)", width: 1, opacity: 0.5, dash: "2 5" };
    case "MESSAGED":
      return { stroke: "var(--accent-2)", width: 0.6 + 2.2 * e.weight, opacity: 0.55 };
    case "MEMBER_OF":
      return { stroke: "var(--text-dim)", width: e.muted ? 1 : 2, opacity: e.muted ? 0.4 : 0.8, dash: e.muted ? "3 4" : undefined };
    case "MADE_BY":
      return { stroke: "var(--edge)", width: 1, opacity: 0.6, dash: "2 4" };
    default:
      return e.hop === 2
        ? { stroke: "var(--edge)", width: 0.7, opacity: 0.45 }
        : { stroke: "var(--edge)", width: 1.3, opacity: 1 };
  }
}

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

interface EdgeProps {
  e: LEdge;
  src: PosEntry;
  dst: PosEntry;
  delay: number;
  dim: boolean;
  flow: boolean;
  reduce: boolean;
}

const GraphEdge = memo(function GraphEdge({ e, src, dst, delay, dim, flow, reduce }: EdgeProps) {
  const d = useTransform([src.x, src.y, dst.x, dst.y], (v: number[]) => edgePath(v[0], v[1], v[2], v[3], e.bow));
  const st = edgeStyle(e);
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ opacity: { duration: reduce ? 0.2 : 0.35, delay } }}
      style={{ pointerEvents: "none" }}
    >
     <g style={{ opacity: dim ? 0.12 : 1, transition: "opacity 160ms ease" }}>
      <motion.path
        d={d}
        fill="none"
        stroke={st.stroke}
        strokeWidth={st.width}
        strokeOpacity={st.opacity}
        strokeDasharray={st.dash}
        strokeLinecap="round"
      />
      {flow && !reduce && (
        <motion.path
          d={d}
          fill="none"
          stroke="var(--bad)"
          strokeWidth={st.width + 0.6}
          strokeDasharray="3 13"
          strokeLinecap="round"
          className="v2-edge-flow"
          style={{ ["--v2-dash-cycle" as any]: -16, ["--v2-dash-speed" as any]: "1100ms" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.3, delay: delay + 0.5 }}
        />
      )}
     </g>
    </motion.g>
  );
});

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

interface NodeProps {
  n: LNode;
  entry: PosEntry;
  tx: number;
  ty: number;
  delay: number;
  dim: boolean;
  faded: boolean;
  reduce: boolean;
  onHover: (id: string | null) => void;
  onClick: (n: LNode) => void;
}

const GraphNode = memo(function GraphNode({ n, entry, tx, ty, delay, dim, faded, reduce, onHover, onClick }: NodeProps) {
  // Revive a node that previously exited: start again from its parent.
  if (!entry.alive) {
    entry.x.set(n.fromX);
    entry.y.set(n.fromY);
    entry.alive = true;
  }
  useEffect(() => {
    entry.alive = true;
    return () => {
      entry.alive = false;
    };
  }, [entry]);

  useEffect(() => {
    if (reduce) {
      entry.x.set(tx);
      entry.y.set(ty);
      return;
    }
    const t = { ...(springs.gentle as object), delay } as any;
    const ax = animate(entry.x, tx, t);
    const ay = animate(entry.y, ty, t);
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [tx, ty, delay, reduce, entry]);

  const Icon = ICONS[n.kind];
  const cos = Math.cos((n.angle * Math.PI) / 180);
  const sin = Math.sin((n.angle * Math.PI) / 180);
  const below = n.labelPos === "below";
  const anchor = below ? "middle" : cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
  const lx = below ? 0 : cos * (n.r + 7);
  const ly = below ? n.r + 16 : sin * (n.r + 7) + (anchor === "middle" ? (sin > 0 ? 10 : -4) : 4);
  const baseOpacity = n.kind === "neighbor" && n.churned && !n.churnedRecent ? 0.5 : n.muted ? 0.55 : 1;
  const isCenter = n.kind === "player";

  return (
    <motion.g
      style={{
        // framer composes x/y into the element transform (GPU-composited translate).
        x: entry.x,
        y: entry.y,
        opacity: faded ? 0.08 : dim ? 0.18 : baseOpacity,
        transition: "opacity 160ms ease",
      }}
    >
      <motion.g
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: reduce ? 1 : 0.8, transition: { duration: 0.18 } }}
        transition={{
          opacity: { duration: reduce ? 0.2 : 0.3, delay },
          scale: { ...(springs.gentle as object), delay },
        }}
        className={n.clickable ? "p360-node p360-click" : "p360-node"}
        onPointerEnter={() => onHover(n.id)}
        onPointerLeave={() => onHover(null)}
        onClick={n.clickable ? () => onClick(n) : undefined}
        role={n.clickable ? "button" : undefined}
        aria-label={n.clickable ? `Re-center on ${n.label}` : n.label}
        tabIndex={n.clickable ? 0 : undefined}
        onKeyDown={
          n.clickable
            ? (ev) => {
                if (ev.key === "Enter" || ev.key === " ") onClick(n);
              }
            : undefined
        }
      >
        {/* hit target larger than the dot */}
        {!isCenter && <circle r={Math.max(n.r + 6, 12)} fill="transparent" />}
        {n.keystone && !isCenter && !reduce && (
          <circle r={n.r + 3} fill="none" stroke="var(--accent)" strokeWidth={1.2} className="p360-ripple" />
        )}
        {!isCenter && (
          <circle
            className="p360-dot"
            r={n.r}
            fill={nodeFill(n)}
            stroke={nodeStroke(n)}
            strokeWidth={n.keystone || n.churnedRecent ? 1.8 : 1.1}
          />
        )}
        {Icon && n.r >= 8 && (
          <Icon
            x={-n.r * 0.55}
            y={-n.r * 0.55}
            width={n.r * 1.1}
            height={n.r * 1.1}
            strokeWidth={2.2}
            color={n.muted ? "var(--text-faint)" : "var(--text)"}
            aria-hidden
          />
        )}
        {n.showLabel && !isCenter && (
          <text
            x={lx}
            y={ly}
            textAnchor={anchor}
            fontSize={n.hop === 2 ? 11 : 12.5}
            fill={n.hop === 2 ? "var(--text-faint)" : n.churned ? "var(--bad)" : "var(--text-dim)"}
            style={{ pointerEvents: "none", fontWeight: n.kind === "neighbor" ? 500 : 450 }}
          >
            {n.label}
          </text>
        )}
      </motion.g>
    </motion.g>
  );
});

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export interface GraphCanvasProps {
  layout: Layout;
  stage: Stage;
  reduce: boolean;
  /** Node id currently being re-centred on (travels to 0,0 while loading). */
  pendingId: string | null;
  centerKeystone: boolean;
  onSelectNeighbor: (playerId: string, nodeId: string) => void;
}

export function GraphCanvas({ layout, stage, reduce, pendingId, centerKeystone, onSelectNeighbor }: GraphCanvasProps) {
  const regRef = useRef<Registry>(new Map());
  const reg = regRef.current;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: VIEW.w, h: VIEW.h });
  const [hover, setHover] = useState<string | null>(null);

  // Entrance stagger only for ids not on screen in the previous layout.
  const prevIdsRef = useRef<Set<string>>(new Set());
  const enteringIds = useMemo(() => {
    const prev = prevIdsRef.current;
    const s = new Set<string>();
    for (const n of layout.nodes) if (!prev.has(n.id)) s.add(n.id);
    for (const e of layout.edges) if (!prev.has(e.id)) s.add(e.id);
    return s;
  }, [layout]);
  useEffect(() => {
    const s = new Set<string>();
    layout.nodes.forEach((n) => s.add(n.id));
    layout.edges.forEach((e) => s.add(e.id));
    prevIdsRef.current = s;
  }, [layout]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodeById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  const connected = useMemo(() => {
    if (!hover) return null;
    const s = new Set<string>([hover]);
    for (const e of layout.edges) {
      if (e.source === hover) s.add(e.target);
      if (e.target === hover) s.add(e.source);
    }
    return s;
  }, [hover, layout]);

  const onHover = useCallback((id: string | null) => setHover(id), []);
  const onClick = useCallback(
    (n: LNode) => {
      if (n.playerId) {
        setHover(null);
        onSelectNeighbor(n.playerId, n.id);
      }
    },
    [onSelectNeighbor],
  );

  const showFlow = stage === "social" || stage === "metrics";
  const hovered = hover ? nodeById.get(hover) : undefined;
  const scale = Math.min(size.w / VIEW.w, size.h / VIEW.h);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" className="h-full w-full overflow-visible" role="img" aria-label="Player 360 graph">
        <defs>
          <radialGradient id="p360-glow">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle r={260} fill="url(#p360-glow)" style={{ pointerEvents: "none" }} />
        {centerKeystone && !reduce && (
          <g style={{ pointerEvents: "none" }}>
            <circle r={120} fill="none" stroke="var(--accent)" strokeWidth={1.2} className="p360-ripple-lg" />
            <circle r={120} fill="none" stroke="var(--accent)" strokeWidth={1.2} className="p360-ripple-lg p360-ripple-lg-2" />
          </g>
        )}
        <g>
          <AnimatePresence initial={false}>
            {layout.edges.map((e) => {
              const s = nodeById.get(e.source);
              const t = nodeById.get(e.target);
              if (!s || !t) return null;
              const src = regEntry(reg, e.source, s.fromX, s.fromY);
              const dst = regEntry(reg, e.target, t.fromX, t.fromY);
              const dim = (!!connected && !(connected.has(e.source) && connected.has(e.target))) || (!!pendingId && e.target !== pendingId && e.source !== pendingId);
              return (
                <GraphEdge
                  key={e.id}
                  e={e}
                  src={src}
                  dst={dst}
                  delay={enteringIds.has(e.id) ? e.stagger : 0}
                  dim={dim}
                  flow={showFlow && e.kind === "PLAYED_WITH" && !!nodeById.get(e.target)?.churnedRecent}
                  reduce={reduce}
                />
              );
            })}
          </AnimatePresence>
        </g>
        <g>
          <AnimatePresence initial={false}>
            {layout.nodes.map((n) => {
              const entry = regEntry(reg, n.id, n.fromX, n.fromY);
              const isPending = pendingId === n.id;
              return (
                <GraphNode
                  key={n.id}
                  n={n}
                  entry={entry}
                  tx={isPending ? 0 : n.x}
                  ty={isPending ? 0 : n.y}
                  delay={isPending ? 0 : enteringIds.has(n.id) ? n.stagger : 0}
                  dim={!!connected && !connected.has(n.id)}
                  faded={!!pendingId && !isPending}
                  reduce={reduce}
                  onHover={onHover}
                  onClick={onClick}
                />
              );
            })}
          </AnimatePresence>
        </g>
      </svg>

      <AnimatePresence>
        {hovered && hovered.kind !== "player" && !pendingId && (
          <motion.div
            key={hovered.id}
            className="v2-glass pointer-events-none absolute z-20 rounded-[var(--radius-md)] px-3 py-2 text-[12px] leading-[1.35] shadow-[var(--shadow)]"
            style={{
              left: size.w / 2 + hovered.x * scale,
              top: size.h / 2 + hovered.y * scale - hovered.r * scale - 10,
              translateX: "-50%",
              translateY: "-100%",
              transformOrigin: "50% 100%",
            }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="font-medium text-[var(--text)]">{hovered.tip[0]}</div>
            {hovered.tip.slice(1).map((t, i) => (
              <div key={i} className="v2-tabular text-[var(--text-dim)]">
                {t}
              </div>
            ))}
            {hovered.clickable && <div className="mt-1 text-[11px] text-[var(--text-faint)]">Click to re-center</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
