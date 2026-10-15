"use client";

/**
 * Focal player card. Sits over the graph centre (0, 0).
 * Shared layoutId `player-card-<id>` so Home's Core Finding (or any other
 * surface) can morph into it.
 */
import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Ticker, layoutIds, springs } from "@/components/v2/motion";
import type { P360Player } from "@/lib/v2/player360";

function pretty(archetype: string): string {
  return archetype
    .toLowerCase()
    .split("_")
    .map((w) => (w.length <= 3 && w !== "the" ? w.toUpperCase() : w[0]?.toUpperCase() + w.slice(1)))
    .join(" ");
}

interface PlayerCardProps {
  player: P360Player;
  compact: boolean;
  reduce: boolean;
}

/** forwardRef so AnimatePresence mode="popLayout" can measure it during a swap. */
export const PlayerCard = forwardRef<HTMLDivElement, PlayerCardProps>(function PlayerCard({ player, compact, reduce }, ref) {
  const drop = player.session_ratio !== null ? Math.round((1 - player.session_ratio) * 100) : null;
  const churnPct = Math.round(player.churn_risk * 100);
  const churnTone = churnPct >= 60 ? "var(--bad)" : churnPct >= 35 ? "var(--warn)" : "var(--good)";

  return (
    <motion.div
      ref={ref}
      layoutId={layoutIds.playerCard(player.player_id)}
      className="v2-card pointer-events-auto relative w-[232px] overflow-hidden px-4 pb-3.5 pt-3"
      style={{ boxShadow: player.keystone ? "var(--shadow-lg), 0 0 0 1px var(--accent-ring)" : "var(--shadow-lg)" }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: compact ? 0.86 : 1, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(4px)", transition: { duration: 0.18 } }}
      transition={{ ...(springs.gentle as object), opacity: { duration: 0.25 } }}
    >
      <div className="flex h-5 items-center gap-1.5">
        {player.keystone && (
          <span className="rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-2 py-[1px] text-[10.5px] font-medium tracking-wide text-[var(--accent)]">
            Keystone
          </span>
        )}
        {drop !== null && drop > 0 && (
          <span className="v2-tabular rounded-[var(--radius-pill)] bg-[var(--bad-soft)] px-2 py-[1px] text-[10.5px] font-medium text-[var(--bad)]">
            Sessions -{drop}%
          </span>
        )}
        {player.churned_at && (
          <span className="rounded-[var(--radius-pill)] bg-[var(--bad-soft)] px-2 py-[1px] text-[10.5px] font-medium text-[var(--bad)]">
            Churned
          </span>
        )}
      </div>
      <div className="mt-2 truncate text-[19px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text)]">
        {player.gamer_tag}
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-[var(--text-faint)]">{pretty(player.archetype)}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-2.5">
        <Stat label="OVR">
          {player.ovr !== null ? <Ticker value={player.ovr} from={60} duration={0.8} /> : <span>n/a</span>}
        </Stat>
        <Stat label="VC">
          {player.vc !== null ? (
            <Ticker
              value={player.vc}
              duration={0.9}
              format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${Math.round(n)}`)}
            />
          ) : (
            <span>n/a</span>
          )}
        </Stat>
        <Stat label="Churn" color={churnTone}>
          <Ticker value={churnPct} duration={0.9} suffix="%" />
        </Stat>
      </div>
    </motion.div>
  );
});

function Stat({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">{label}</div>
      <div className="v2-tabular mt-0.5 text-[16px] font-semibold" style={{ color: color ?? "var(--text)" }}>
        {children}
      </div>
    </div>
  );
}
