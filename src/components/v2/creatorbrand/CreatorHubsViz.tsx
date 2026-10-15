"use client";

/**
 * <CreatorHubsViz /> Creator hubs constellation (the SoundCloud "creator hub" analogue).
 *
 * GET /api/v2/creator/hubs (Spanner Graph Creator->Stream<-Identity<-Player traversal).
 * Communities sit on a ring sized by player count. Each creator is placed at the
 * viewer-weighted centroid of the communities it reaches, so creators that bridge many
 * communities drift to the middle. Bubble size = followers, glow = hub_score,
 * bridge lines = share of the creator's viewers in each community.
 * Mid-follower bridges (top-quartile hub_score, below-median followers) pulse.
 */
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedEdge, ease, springs, STAGGER } from "@/components/v2/motion";
import type { CreatorHub, CreatorHubsResponse } from "@/lib/v2/creatorbrand";
import { CardFrame, ErrorPanel, GrowBar, LiveBadge, SkeletonBlock, fmtCompact, useLiveJson } from "./shared";

export interface CreatorHubsVizProps {
  /** Max creators drawn in the constellation. Default 14. */
  maxCreators?: number;
  /** Max communities on the ring. Default 9. */
  maxCommunities?: number;
  className?: string;
}

const W = 520;
const H = 400;
const CX = W / 2;
const CY = H / 2;
const RING = 158;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function CreatorHubsViz({ maxCreators = 14, maxCommunities = 9, className }: CreatorHubsVizProps) {
  const reduce = useReducedMotion();
  const { data, error, loading, reload } = useLiveJson<CreatorHubsResponse>("/api/v2/creator/hubs");
  const [hover, setHover] = useState<string | null>(null);

  const scene = useMemo(() => {
    if (!data) return null;
    const comms = data.communities.slice(0, maxCommunities);
    const maxPlayers = Math.max(1, ...comms.map((c) => c.players));
    const commPos = new Map(
      comms.map((c, i) => {
        const a = (i / comms.length) * Math.PI * 2 - Math.PI / 2;
        return [
          c.community_id,
          { ...c, x: CX + Math.cos(a) * RING, y: CY + Math.sin(a) * RING, r: 10 + Math.sqrt(c.players / maxPlayers) * 18 },
        ];
      })
    );
    const hubs = data.hubs.filter((h) => h.viewers > 0).slice(0, maxCreators);
    const maxFollowers = Math.max(1, ...hubs.map((h) => h.followers));
    const maxHub = Math.max(0.0001, ...hubs.map((h) => h.hub_score ?? 0));
    const minHub = Math.min(...hubs.map((h) => h.hub_score ?? 0));
    const hubRange = maxHub - minHub;
    const nodes = hubs.map((h) => {
      // Shares among the ring communities only, renormalised, so placement reflects the visible ring.
      const onRing = h.communities.filter((c) => commPos.has(c.community_id));
      const ringTotal = onRing.reduce((a, c) => a + c.viewers, 0);
      const ringShares = onRing.map((c) => ({ ...c, rs: ringTotal > 0 ? c.viewers / ringTotal : 0 }));
      // Angle: circular mean of the creator's ring-community split (where its audience leans).
      // Radius: inverse hub score, so the strongest bridges sit at the centre of the ring.
      let vx = 0;
      let vy = 0;
      for (const c of ringShares) {
        const p = commPos.get(c.community_id)!;
        vx += (p.x - CX) * c.rs;
        vy += (p.y - CY) * c.rs;
      }
      const lean = Math.hypot(vx, vy) / RING;
      const angle = lean > 0.04 ? Math.atan2(vy, vx) : hash(h.creator_id) * Math.PI * 2;
      const hubNorm = hubRange > 0 ? ((h.hub_score ?? minHub) - minHub) / hubRange : 0.5;
      const radius = 36 + (1 - hubNorm) * (RING - 66);
      const x = CX + Math.cos(angle) * radius;
      const y = CY + Math.sin(angle) * radius;
      return {
        ...h,
        x,
        y,
        r: 5 + Math.sqrt(h.followers / maxFollowers) * 13,
        glow: (h.hub_score ?? 0) / maxHub,
        links: ringShares
          .slice()
          .sort((a, b) => b.rs - a.rs)
          .slice(0, h.is_bridge ? ringShares.length : 2)
          .map((c) => ({ ...c, share: c.rs, to: commPos.get(c.community_id)! })),
      };
    });
    return { comms: Array.from(commPos.values()), nodes };
  }, [data, maxCommunities, maxCreators]);

  const ranked = useMemo(() => (data ? data.hubs.slice(0, 5) : []), [data]);
  const maxHubScore = Math.max(0.0001, ...ranked.map((h) => h.hub_score ?? 0));

  return (
    <CardFrame
      className={className}
      eyebrow="Creator hubs"
      title="Who bridges communities"
      right={data ? <LiveBadge engines={data.engines} ms={data.latency_ms} /> : null}
    >
      {error ? (
        <ErrorPanel error={error} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonBlock rows={5} />
      ) : data && scene ? (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Creator hub constellation">
            <defs>
              <radialGradient id="cb-hub-glow">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={CX} cy={CY} r={RING} fill="none" stroke="var(--grid)" strokeDasharray="2 6" />

            {/* bridge lines */}
            {scene.nodes.map((n, i) =>
              n.links.map((l) => {
                const dim = hover && hover !== n.creator_id;
                return (
                  <g
                    key={`${n.creator_id}-${l.community_id}`}
                    style={{ opacity: dim ? 0.08 : 1, transition: "opacity 160ms ease" }}
                  >
                    <AnimatedEdge
                      d={`M ${n.x} ${n.y} L ${l.to.x} ${l.to.y}`}
                      delay={0.3 + i * STAGGER}
                      duration={0.7}
                      strokeWidth={0.6 + l.share * 3}
                      stroke={n.is_bridge ? "var(--accent)" : "var(--edge)"}
                      opacity={n.is_bridge ? 0.55 : 0.35 + l.share * 0.4}
                      flow={n.is_bridge || hover === n.creator_id}
                      speed={1400}
                    />
                  </g>
                );
              })
            )}

            {/* communities */}
            {scene.comms.map((c, i) => (
              <motion.g
                key={c.community_id}
                style={{ transformOrigin: `${c.x}px ${c.y}px`, transformBox: "view-box" }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.85)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                transition={{ duration: 0.45, delay: i * STAGGER, ease: ease.out }}
              >
                <circle cx={c.x} cy={c.y} r={c.r} fill="var(--surface-2)" stroke="var(--border-strong)" />
                <text x={c.x} y={c.y + 3} textAnchor="middle" className="fill-[var(--text-faint)] text-[9px]">
                  {fmtCompact(c.players)}
                </text>
                <text
                  x={c.x}
                  y={c.y + (c.y < CY ? -c.r - 6 : c.r + 13)}
                  textAnchor="middle"
                  className="fill-[var(--text-dim)] text-[10px]"
                >
                  {c.community_id}
                </text>
              </motion.g>
            ))}

            {/* creators */}
            {scene.nodes.map((n, i) => (
              <motion.g
                key={n.creator_id}
                style={{ transformOrigin: `${n.x}px ${n.y}px`, transformBox: "view-box", cursor: "default" }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.7)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                transition={{ ...springs.snappy, delay: 0.25 + i * STAGGER }}
                onPointerEnter={() => setHover(n.creator_id)}
                onPointerLeave={() => setHover(null)}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r + 10 + n.glow * 14}
                  fill="url(#cb-hub-glow)"
                  opacity={0.15 + n.glow * 0.85}
                  className={n.is_bridge ? "cb-hub-pulse" : undefined}
                  style={{ transformOrigin: `${n.x}px ${n.y}px`, transformBox: "view-box" }}
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.is_bridge ? "var(--accent)" : "var(--surface-3)"}
                  stroke={n.is_bridge ? "var(--accent-hover)" : "var(--border-strong)"}
                />
                {(n.is_bridge || hover === n.creator_id) && (
                  <text x={n.x + n.r + 5} y={n.y + 3} textAnchor="start" className="fill-[var(--text)] text-[10px] font-medium">
                    @{n.handle.replace(/^@/, "")}
                  </text>
                )}
              </motion.g>
            ))}
            <style>{`
              @keyframes cb-hub-pulse { 0%,100% { transform: scale(0.92); } 50% { transform: scale(1.08); } }
              .cb-hub-pulse { animation: cb-hub-pulse 2.6s ease-in-out infinite; }
              @media (prefers-reduced-motion: reduce) { .cb-hub-pulse { animation: none; } }
            `}</style>
          </svg>

          <RankedList hubs={ranked} max={maxHubScore} hover={hover} onHover={setHover} cut={data.followers_q3} total={data.community_count} />
        </div>
      ) : null}
    </CardFrame>
  );
}

function RankedList({
  hubs,
  max,
  hover,
  onHover,
  cut,
  total,
}: {
  hubs: CreatorHub[];
  max: number;
  hover: string | null;
  onHover: (id: string | null) => void;
  cut: number;
  total: number;
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-v2-faint">Hub score</p>
      <ul className="space-y-3">
        {hubs.map((h, i) => (
          <motion.li
            key={h.creator_id}
            initial={{ opacity: 0, transform: "translateX(10px)" }}
            animate={{ opacity: 1, transform: "translateX(0px)" }}
            transition={{ duration: 0.35, delay: 0.3 + i * STAGGER, ease: ease.out }}
            onPointerEnter={() => onHover(h.creator_id)}
            onPointerLeave={() => onHover(null)}
            className="rounded-v2-sm"
            style={{ opacity: hover && hover !== h.creator_id ? 0.5 : 1, transition: "opacity 160ms ease" }}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate text-v2-text">@{h.handle.replace(/^@/, "")}</span>
              {h.is_bridge && (
                <span className="rounded-v2-pill bg-v2-accent-soft px-2 py-0.5 text-[10px] font-medium text-v2-accent">Bridge</span>
              )}
            </div>
            <GrowBar value={h.hub_score ?? 0} max={max} color={h.is_bridge ? "var(--accent)" : "var(--text-dim)"} delay={0.35 + i * STAGGER} height={6} />
            <p className="mt-1 text-[11px] text-v2-faint v2-tabular">
              {(h.hub_score ?? 0).toFixed(2)} · {h.live_span} communities · {fmtCompact(h.followers)} followers
            </p>
          </motion.li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-v2-faint">
        Bridge = top-quartile hub score with under {fmtCompact(cut)} followers. Reach across {total} communities, not size.
      </p>
    </div>
  );
}

export default CreatorHubsViz;
