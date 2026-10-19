"use client";

/**
 * <PlaysRow /> "Act on it" cards on the Take-Two landing: one per
 * cross-franchise play, with the live audience size of its first segment.
 * <Playbook /> launched actions from BigQuery (t2_actions).
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Database, Gift, Rocket, ShieldCheck, LifeBuoy } from "lucide-react";
import { PLAYS, PLAY_ORDER, type AudienceResponse, type PlayId, type PlaybookEntry } from "@/lib/v2/plays";
import { ease } from "../motion";

const ICON: Record<PlayId, React.ReactNode> = {
  warm_intro: <Gift size={15} />,
  gta6_window: <ShieldCheck size={15} />,
  save_elsewhere: <LifeBuoy size={15} />,
};

function useAudienceCount(play: PlayId) {
  const [n, setN] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/v2/actions/audience?play=${play}&segment=${PLAYS[play].segments[0].id}`, { signal: ac.signal, cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(`${b.service ?? "api"}: ${b.message ?? b.error}`);
        setN((b as AudienceResponse).count);
      })
      .catch((e) => e?.name !== "AbortError" && setErr(String(e.message ?? e)));
    return () => ac.abort();
  }, [play]);
  return { n, err };
}

function PlayCard({ play, i, onAct }: { play: PlayId; i: number; onAct: (p: PlayId) => void }) {
  const def = PLAYS[play];
  const { n, err } = useAudienceCount(play);
  return (
    <motion.button
      type="button"
      onClick={() => onAct(play)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 30, delay: 0.05 * i }}
      className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow)] hover:border-[var(--border-strong)]"
    >
      <div className="flex items-center gap-2 text-[var(--text-faint)]">
        {ICON[play]}
        <span className="text-[11.5px] uppercase tracking-[0.08em]">{def.segments.length > 1 ? `${def.segments.length} audiences` : "1 audience"}</span>
      </div>
      <div className="mt-2 text-[16px] font-semibold text-[var(--text)]">{def.name}</div>
      <div className="mt-1 text-[13px] leading-snug text-[var(--text-dim)]">{def.insight}</div>
      <div className="mt-auto flex items-end justify-between pt-4">
        <div>
          {err ? (
            <span className="text-[11.5px] text-[var(--bad)]">{err}</span>
          ) : n == null ? (
            <span className="v2-skeleton inline-block h-6 w-16 rounded" />
          ) : (
            <>
              <div className="text-[22px] font-semibold leading-none text-[var(--text)] v2-tabular">{n.toLocaleString("en-US")}</div>
              <div className="mt-1 text-[11px] text-[var(--text-faint)]">{def.segments[0].label}</div>
            </>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-accent)]">
          Act
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.button>
  );
}

export function PlaysRow({ onAct }: { onAct: (p: PlayId) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]">Act on it</div>
        <div className="text-[11.5px] text-[var(--text-faint)]">Audience · Plan · Pressure test · Launch</div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {PLAY_ORDER.map((p, i) => (
          <PlayCard key={p} play={p} i={i} onAct={onAct} />
        ))}
      </div>
    </div>
  );
}

export function Playbook({ refreshKey, onAct }: { refreshKey: number; onAct: (p: PlayId) => void }) {
  const [rows, setRows] = useState<PlaybookEntry[] | null>(null);
  const [dataset, setDataset] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    setRows(null);
    fetch("/api/v2/actions", { signal: ac.signal, cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(`${b.service ?? "api"}: ${b.message ?? b.error}`);
        setRows(b.actions);
        setDataset(b.dataset);
      })
      .catch((e) => e?.name !== "AbortError" && setErr(String(e.message ?? e)));
    return () => ac.abort();
  }, [refreshKey]);
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--text)]">
          <Rocket size={15} className="text-[var(--text-faint)]" /> Playbook
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
          <Database size={11} /> BigQuery · {dataset || "take_two_portfolio"}.t2_actions
        </span>
      </div>
      <div className="mb-4 text-[12.5px] text-[var(--text-dim)]">Launched cross-franchise actions, each with a randomized holdout and a readout date.</div>
      {err ? (
        <div className="text-[12px] text-[var(--bad)]">{err}</div>
      ) : !rows ? (
        <div className="v2-skeleton h-24 w-full rounded" />
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-between rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-4 text-[12.5px] text-[var(--text-dim)]">
          No actions launched yet.
          <button type="button" onClick={() => onAct("warm_intro")} className="v2-press inline-flex items-center gap-1 text-[var(--text)]">
            Start with Warm intro <ArrowRight size={12} />
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {rows.map((r, i) => (
            <motion.div
              key={r.action_id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25, ease: ease.out }}
              className="grid grid-cols-[1.4fr_1fr_0.9fr_0.8fr] items-center gap-3 py-3 text-[12px]"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-[var(--text)]">
                  {PLAYS[r.play]?.name ?? r.play} · {PLAYS[r.play]?.segments.find((s) => s.id === r.segment)?.label ?? r.segment}
                </div>
                <div className="truncate text-[11px] text-[var(--text-faint)]">
                  {r.variant_name} · {r.channel.replace(/_/g, " ")}
                </div>
              </div>
              <div className="text-[var(--text-dim)] v2-tabular">
                {r.treatment_n.toLocaleString()} treated · {r.control_n.toLocaleString()} holdout
              </div>
              <div className="text-[var(--text-dim)]">launched {new Date(r.launched_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              <div className="text-right">
                <span className="rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--warn)]">readout {r.readout_date}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
