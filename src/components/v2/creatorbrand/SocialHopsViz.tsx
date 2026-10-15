"use client";

/**
 * <SocialHopsViz /> Degrees of separation between two audiences / players.
 *
 * GET /api/v2/social/hops?from=&to= (Spanner Graph ANY SHORTEST over PLAYED_WITH|FRIENDS_WITH, {1,4}).
 * The two endpoint audiences sit at the edges; the shortest path draws hop by hop
 * (AnimatedEdge, 0.35s per hop), intermediate players pop in as their edge lands.
 * Purpose: explanation (rare tier). Reduced motion: edges and nodes fade in.
 */
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCw } from "lucide-react";
import { AnimatedEdge, Pressable, Ticker, arcPath, springs } from "@/components/v2/motion";
import type { SocialHopsResponse, HopNode } from "@/lib/v2/creatorbrand";
import { CardFrame, ErrorPanel, LiveBadge, SkeletonBlock, useLiveJson } from "./shared";

export interface SocialHopsVizProps {
  /** player_id, `community:<id>`, or `archetype:<NAME>`. Omit both to let the API pick two live communities. */
  from?: string;
  to?: string;
  className?: string;
}

const W = 640;
const H = 220;
const HOP_S = 0.35;

function label(n: HopNode | undefined) {
  if (!n) return "";
  return n.gamer_tag || n.player_id;
}

function audienceLabel(q: string) {
  if (q.startsWith("community:")) return `Community ${q.slice(10)}`;
  if (q.startsWith("archetype:")) return q.slice(10).replace(/_/g, " ").toLowerCase();
  return "Player";
}

export function SocialHopsViz({ from, to, className }: SocialHopsVizProps) {
  const reduce = useReducedMotion();
  const url =
    from && to
      ? `/api/v2/social/hops?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : "/api/v2/social/hops";
  const { data, error, loading, reload } = useLiveJson<SocialHopsResponse>(url);

  const layout = useMemo(() => {
    if (!data || !data.path.length) return null;
    const n = data.path.length;
    const x0 = 64;
    const x1 = W - 64;
    return data.path.map((p, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      // Gentle arch so the path reads as a route, not a table row.
      const y = H / 2 + 26 - Math.sin(t * Math.PI) * 52;
      return { ...p, x: x0 + (x1 - x0) * t, y };
    });
  }, [data]);

  return (
    <CardFrame
      className={className}
      eyebrow="Social hops"
      title="Degrees of separation"
      right={
        <div className="flex items-center gap-3">
          {data && <LiveBadge engines={data.engines} ms={data.latency_ms} />}
          <Pressable
            onClick={reload}
            aria-label="Re-run shortest path"
            className="grid h-7 w-7 place-items-center rounded-full border border-v2-border text-v2-dim"
          >
            <RotateCw size={13} />
          </Pressable>
        </div>
      }
    >
      {error ? (
        <ErrorPanel error={error} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonBlock rows={3} />
      ) : data ? (
        <div>
          <div className="mb-2 flex items-baseline gap-2">
            {data.hops !== null ? (
              <>
                <Ticker
                  key={`${data.from.player.player_id}-${data.to.player.player_id}`}
                  value={data.hops}
                  duration={HOP_S * Math.max(1, data.hops)}
                  className="v2-tabular text-[44px] font-semibold leading-none tracking-[-0.03em] text-v2-text"
                />
                <span className="text-[13px] text-v2-dim">{data.hops === 1 ? "hop" : "hops"}</span>
              </>
            ) : (
              <span className="text-[15px] text-v2-dim">Not connected within {data.max_hops} hops</span>
            )}
          </div>
          <p className="text-[12px] text-v2-faint">
            {audienceLabel(data.from.query)} to {audienceLabel(data.to.query)} over co-play and friend edges
          </p>

          {layout && (
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`Shortest path, ${data.hops} hops`}>
              {layout.slice(0, -1).map((a, i) => {
                const b = layout[i + 1];
                const kind = data.edges[i]?.kind;
                return (
                  <g key={`e-${a.player_id}-${b.player_id}`}>
                    <AnimatedEdge
                      d={arcPath(a.x, a.y, b.x, b.y, 0.08)}
                      delay={0.2 + i * HOP_S}
                      duration={HOP_S}
                      flow
                      speed={1000}
                      strokeWidth={1.5}
                      stroke="var(--border-strong)"
                      flowStroke={kind === "FRIENDS_WITH" ? "var(--accent-2)" : "var(--accent)"}
                    />
                    <motion.text
                      x={(a.x + b.x) / 2}
                      y={(a.y + b.y) / 2 - 12}
                      textAnchor="middle"
                      className="fill-[var(--text-faint)] text-[10px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: 0.2 + (i + 1) * HOP_S }}
                    >
                      {kind === "FRIENDS_WITH" ? "friends" : "played with"}
                    </motion.text>
                  </g>
                );
              })}
              {layout.map((p, i) => {
                const endpoint = i === 0 || i === layout.length - 1;
                const r = endpoint ? 18 : 9;
                const appearAt = i === 0 ? 0 : 0.2 + i * HOP_S;
                return (
                  <motion.g
                    key={`n-${p.player_id}`}
                    style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: "view-box" }}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.6)" }}
                    animate={{ opacity: 1, transform: "scale(1)" }}
                    transition={{ ...springs.snappy, delay: appearAt }}
                  >
                    {endpoint && (
                      <circle cx={p.x} cy={p.y} r={r + 8} fill="var(--accent-soft)" className="cb-hop-halo" />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={endpoint ? "var(--surface-2)" : "var(--surface-3)"}
                      stroke={endpoint ? "var(--accent)" : "var(--border-strong)"}
                      strokeWidth={endpoint ? 2 : 1}
                    />
                    <text
                      x={p.x}
                      y={p.y + r + 16}
                      textAnchor="middle"
                      className={endpoint ? "fill-[var(--text)] text-[12px] font-medium" : "fill-[var(--text-dim)] text-[10px]"}
                    >
                      {label(p).slice(0, 16)}
                    </text>
                    {endpoint && p.community_id && (
                      <text x={p.x} y={p.y + r + 30} textAnchor="middle" className="fill-[var(--text-faint)] text-[10px]">
                        {p.community_id}
                      </text>
                    )}
                  </motion.g>
                );
              })}
            </svg>
          )}
          <style>{`
            @keyframes cb-hop-halo { 0%,100% { opacity: .35 } 50% { opacity: .9 } }
            .cb-hop-halo { animation: cb-hop-halo 2.4s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .cb-hop-halo { animation: none; } }
          `}</style>
        </div>
      ) : null}
    </CardFrame>
  );
}

export default SocialHopsViz;
