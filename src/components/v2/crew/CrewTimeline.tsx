"use client";

/**
 * <CrewTimeline crewId /> Crew lineage as a small branching SVG.
 *
 * Answers "how are we tracking that crews are dynamic (split and re-form)?":
 * SPLIT_FROM edges (Spanner Graph) draw the family tree; CrewMembershipEvents
 * drive the 12-week JOIN / LEAVE / SPLIT strip underneath.
 *
 * Motion (explanation, shown once per crew): lineage grows left to right, each
 * generation 220ms after its parent; edges draw (pathLength, ease-in-out),
 * nodes rise in from scale 0.9. Event bars grow from the baseline with a 30ms
 * stagger. Reduced motion: everything fades, nothing moves.
 */
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GitBranch } from "lucide-react";
import { AnimatedEdge, curvedPath, ease } from "@/components/v2/motion";
import type { CrewTimelineResponse } from "@/lib/v2/crew";
import { useLive } from "./api";

export interface CrewTimelineProps {
  crewId: string | null;
  /** Optional headline stats from /api/v2/crew/churn dynamics. */
  splits90d?: number;
  reforms90d?: number;
  answer?: string;
  className?: string;
}

const W = 640;
const PAD_X = 40;
const PAD_Y = 34;
const ROW = 64;

function daysAgo(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = Math.max(0, Math.round((Date.now() - new Date(isoStr).getTime()) / 86400000));
  return d === 0 ? "today" : `${d}d ago`;
}

export function CrewTimeline({ crewId, splits90d, reforms90d, answer, className }: CrewTimelineProps) {
  const reduce = !!useReducedMotion();
  const { data, error, loading } = useLive<CrewTimelineResponse>(
    crewId ? `/api/v2/crew/${encodeURIComponent(crewId)}/timeline` : null,
  );

  const layout = useMemo(() => {
    if (!data) return null;
    const maxDepth = Math.max(1, ...data.nodes.map((n) => n.depth));
    const byDepth = new Map<number, typeof data.nodes>();
    for (const n of data.nodes) {
      const arr = byDepth.get(n.depth) ?? [];
      arr.push(n);
      byDepth.set(n.depth, arr);
    }
    const maxRow = Math.max(1, ...Array.from(byDepth.values()).map((a) => a.length));
    const H = PAD_Y * 2 + (maxRow - 1) * ROW + 20;
    const pos = new Map<string, { x: number; y: number; r: number }>();
    const maxMembers = Math.max(1, ...data.nodes.map((n) => n.active_members));
    byDepth.forEach((arr, depth) => {
      arr.sort((a, b) => a.clan_id.localeCompare(b.clan_id));
      arr.forEach((n, i) => {
        const x = data.nodes.length === 1 ? W / 2 : PAD_X + 30 + (depth / maxDepth) * (W - PAD_X * 2 - 60);
        const y = PAD_Y + ((maxRow - arr.length) / 2 + i) * ROW;
        const r = 5 + Math.sqrt(n.active_members / maxMembers) * 9;
        pos.set(n.clan_id, { x, y, r });
      });
    });
    return { pos, maxDepth, H };
  }, [data]);

  const maxWeek = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.weekly_events.map((w) => Math.max(w.JOIN, w.LEAVE + w.KICK)));
  }, [data]);

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]">
          <GitBranch size={14} className="text-[var(--accent-2)]" />
          Crews are dynamic
        </div>
        {(splits90d !== undefined || reforms90d !== undefined) && (
          <div className="v2-tabular flex gap-4 text-[12px] text-[var(--text-dim)]">
            {splits90d !== undefined && (
              <span>
                <span className="text-[var(--text)]">{splits90d}</span> splits · 90d
              </span>
            )}
            {reforms90d !== undefined && (
              <span>
                <span className="text-[var(--text)]">{reforms90d}</span> re-forms · 90d
              </span>
            )}
          </div>
        )}
      </div>

      {!crewId && <div className="text-[12px] text-[var(--text-faint)]">No crew lineage selected.</div>}

      {crewId && loading && !data && <div className="v2-skeleton h-[120px] w-full" />}

      {error && (
        <div className="rounded-[var(--radius-md)] bg-[var(--bad-soft)] px-3 py-2 text-[12px] text-[var(--bad)]">
          {error.service ? `${error.service}: ` : ""}
          {error.message}
        </div>
      )}

      {data && layout && (
        <>
          <svg viewBox={`0 0 ${W} ${layout.H}`} className="h-auto w-full" role="img" aria-label="Crew lineage">
            {data.edges.map((e) => {
              const p = layout.pos.get(e.parent);
              const c = layout.pos.get(e.child);
              if (!p || !c) return null;
              const depth = data.nodes.find((n) => n.clan_id === e.child)?.depth ?? 1;
              const focusEdge = e.child === data.crew_id || e.parent === data.crew_id;
              const d = curvedPath(p.x + p.r, p.y, c.x - c.r, c.y, 0.5);
              return (
                <g key={`${e.child}-${e.parent}`}>
                  <AnimatedEdge
                    d={d}
                    stroke={focusEdge ? "var(--accent-2)" : "var(--edge)"}
                    flowStroke="var(--accent-2)"
                    flow={focusEdge}
                    strokeWidth={focusEdge ? 1.75 : 1.25}
                    delay={reduce ? 0 : (depth - 1) * 0.22 + 0.1}
                    duration={0.55}
                  />
                  <motion.text
                    x={(p.x + c.x) / 2}
                    y={(p.y + c.y) / 2 - 12}
                    textAnchor="middle"
                    className="v2-tabular"
                    fontSize="9.5"
                    fill="var(--text-faint)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: reduce ? 0 : (depth - 1) * 0.22 + 0.5 }}
                  >
                    split {daysAgo(e.split_at)} · {e.shared_members} moved
                  </motion.text>
                </g>
              );
            })}
            {data.nodes.map((n) => {
              const p = layout.pos.get(n.clan_id);
              if (!p) return null;
              const delay = reduce ? 0 : n.depth * 0.22;
              return (
                <motion.g
                  key={n.clan_id}
                  style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: "view-box" }}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.9)" }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "scale(1)" }}
                  transition={{ duration: 0.3, delay, ease: ease.out }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={n.is_focus ? "var(--accent-2-soft)" : "var(--surface-2)"}
                    stroke={n.is_focus ? "var(--accent-2)" : "var(--border-strong)"}
                    strokeWidth={n.is_focus ? 1.75 : 1}
                  />
                  <text x={p.x} y={p.y + p.r + 14} textAnchor="middle" fontSize="11" fill={n.is_focus ? "var(--text)" : "var(--text-dim)"}>
                    {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                  </text>
                  <text x={p.x} y={p.y + p.r + 27} textAnchor="middle" fontSize="9.5" fill="var(--text-faint)" className="v2-tabular">
                    {n.active_members} active
                  </text>
                </motion.g>
              );
            })}
          </svg>

          {data.edges.length === 0 && (
            <div className="-mt-1 text-center text-[11px] text-[var(--text-faint)]">No splits on record for this crew · membership events below</div>
          )}

          {/* 12-week membership event strip */}
          <div className="flex flex-col gap-1">
            <div className="flex h-[54px] items-center gap-[3px]">
              {data.weekly_events.map((w, i) => {
                const up = (w.JOIN / maxWeek) * 24;
                const down = ((w.LEAVE + w.KICK) / maxWeek) * 24;
                return (
                  <div
                    key={w.weeks_ago}
                    className="relative flex h-full flex-1 flex-col items-center justify-center"
                    title={`${w.weeks_ago}w ago · ${w.JOIN} join · ${w.LEAVE + w.KICK} leave · ${w.SPLIT} split`}
                  >
                    <div className="flex h-1/2 w-full items-end justify-center">
                      <motion.div
                        className="w-full max-w-[14px] rounded-t-[3px] bg-[var(--good)] opacity-70"
                        style={{ height: Math.max(1, up), transformOrigin: "bottom" }}
                        initial={reduce ? { opacity: 0 } : { transform: "scaleY(0.05)", opacity: 0 }}
                        animate={reduce ? { opacity: 0.7 } : { transform: "scaleY(1)", opacity: 0.7 }}
                        transition={{ duration: 0.4, delay: reduce ? 0 : 0.5 + i * 0.03, ease: ease.out }}
                      />
                    </div>
                    <div className="h-px w-full bg-[var(--border)]" />
                    <div className="flex h-1/2 w-full items-start justify-center">
                      <motion.div
                        className="w-full max-w-[14px] rounded-b-[3px] bg-[var(--bad)] opacity-70"
                        style={{ height: Math.max(1, down), transformOrigin: "top" }}
                        initial={reduce ? { opacity: 0 } : { transform: "scaleY(0.05)", opacity: 0 }}
                        animate={reduce ? { opacity: 0.7 } : { transform: "scaleY(1)", opacity: 0.7 }}
                        transition={{ duration: 0.4, delay: reduce ? 0 : 0.5 + i * 0.03, ease: ease.out }}
                      />
                    </div>
                    {w.SPLIT > 0 && (
                      <span className="absolute -top-0.5 h-[6px] w-[6px] rounded-full bg-[var(--accent-2)]" aria-label={`${w.SPLIT} splits`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-[var(--text-faint)]">
              <span>12w ago</span>
              <span className="flex gap-3">
                <span className="flex items-center gap-1">
                  <i className="h-[6px] w-[6px] rounded-full bg-[var(--good)]" /> join
                </span>
                <span className="flex items-center gap-1">
                  <i className="h-[6px] w-[6px] rounded-full bg-[var(--bad)]" /> leave
                </span>
                <span className="flex items-center gap-1">
                  <i className="h-[6px] w-[6px] rounded-full bg-[var(--accent-2)]" /> split
                </span>
              </span>
              <span>now</span>
            </div>
          </div>

          {answer && <p className="text-[12px] leading-relaxed text-[var(--text-dim)]">{answer}</p>}
        </>
      )}
    </div>
  );
}
