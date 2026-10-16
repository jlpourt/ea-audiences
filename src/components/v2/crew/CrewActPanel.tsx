"use client";

/**
 * <CrewActPanel /> The "Act" step for Section C crews (storyline step ACT).
 *
 * Paints the whole decision on one screen without crowding it:
 *   1. Impact strip  - what's at stake for the selected crews (live Section C query)
 *   2. The offer     - the free retention gift, and why this item (live Spanner pick)
 *   3. The plan      - Pressure-Test -> Dispatch -> Measure, lighting up as it happens
 *   4. Who           - the crews in scope; click one to see its membership history
 *
 * Everything is read from live endpoints (Section C + crew churn); failures are
 * shown inline, never replaced with numbers.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Coins,
  FlaskConical,
  Gift,
  Inbox,
  LineChart,
  Send,
  ShoppingBag,
  Smartphone,
  TrendingDown,
  Users,
} from "lucide-react";
import type { CrewChurnResponse, CrewFocusGroupHandoff, LostCoreMemberResponse } from "@/lib/v2/crew";
import { useOptionalStoryline } from "@/components/v2/shell/StorylineProvider";
import { Ticker, ease } from "@/components/v2/motion";
import { CrewActButtons, type DispatchResult, type PressureTestResult } from "./CrewActButtons";
import { CrewTimeline } from "./CrewTimeline";
import { fmtAsOf, fmtUsd, useLive } from "./api";

export interface CrewActPanelProps {
  crewIds?: string[];
  onPressureTest?: (handoff: CrewFocusGroupHandoff, result: PressureTestResult) => void;
  onDispatched?: (result: DispatchResult) => void;
  showTimeline?: boolean;
  className?: string;
}

const CHANNELS = [
  { id: "IN_GAME_INBOX", label: "In-game inbox", icon: Inbox },
  { id: "PUSH_2K_MOBILE", label: "2K app push", icon: Smartphone },
];

export function CrewActPanel({ crewIds, onPressureTest, onDispatched, showTimeline = true, className }: CrewActPanelProps) {
  const story = useOptionalStoryline();
  const ids = useMemo(() => crewIds ?? story?.crewIds ?? [], [crewIds, story?.crewIds]);
  const reduce = !!useReducedMotion();

  const lost = useLive<LostCoreMemberResponse>("/api/v2/crew/lost-core-member?days=7");
  const churn = useLive<CrewChurnResponse>("/api/v2/crew/churn");

  const [tested, setTested] = useState<PressureTestResult | null>(null);
  const [dispatched, setDispatched] = useState<DispatchResult | null>(null);
  const [focusCrew, setFocusCrew] = useState<string | null>(null);

  // Crews in scope = the selected ids, enriched from the live Section C rows.
  const crews = useMemo(() => {
    const rows = lost.data?.crews ?? [];
    const set = new Set(ids);
    return rows.filter((c) => set.has(c.clan_id)).sort((a, b) => b.bookings_at_risk_usd - a.bookings_at_risk_usd);
  }, [lost.data, ids]);

  useEffect(() => {
    if (!focusCrew && crews[0]) setFocusCrew(crews[0].clan_id);
  }, [crews, focusCrew]);

  const totals = useMemo(() => {
    const crewmates = crews.reduce((s, c) => s + c.crewmates, 0);
    const fading = crews.reduce((s, c) => s + c.members_at_risk, 0);
    const bookings = crews.reduce((s, c) => s + c.bookings_at_risk_usd, 0);
    return { crewmates, fading, bookings };
  }, [crews]);

  const anchor = churn.data?.anchor_dependency ?? null;
  const offer = churn.data?.retention_offer ?? null;
  // Expected crewmates lost if we do nothing = crewmates x measured anchor-dependency drop.
  const expectedLoss = anchor ? Math.round((totals.crewmates * Math.abs(anchor.lift_pct)) / 100) : null;

  const step = dispatched ? 3 : tested ? 2 : 1;
  const focus = crews.find((c) => c.clan_id === focusCrew) ?? null;

  return (
    <section className={`v2-card flex flex-col gap-6 p-6 text-[var(--text)] ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-[var(--text-faint)]">Act</div>
          <h3 className="mt-1 text-[20px] font-semibold tracking-tight">Stabilize the crews before they scatter</h3>
          <p className="mt-1 text-[13px] text-[var(--text-dim)]">
            Each of these crews lost its most central player this week. Keep the rest together with one free gift.
          </p>
        </div>
        <div className="v2-tabular shrink-0 text-[12px] text-[var(--text-faint)]">{fmtAsOf(lost.data?.as_of)}</div>
      </div>

      {(lost.error || churn.error) && (
        <div className="rounded-[var(--radius-md)] border border-[var(--bad-soft)] bg-[var(--bad-soft)] px-3 py-2 text-[12px] text-[var(--bad)]">
          {(lost.error ?? churn.error)?.service ? `${(lost.error ?? churn.error)?.service}: ` : ""}
          {(lost.error ?? churn.error)?.message}
        </div>
      )}

      {/* 1. Impact strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Users size={14} />} label="Crews in scope" loading={lost.loading && !lost.data} delay={0}>
          <Ticker value={crews.length} />
        </Stat>
        <Stat
          icon={<Users size={14} />}
          label="Crewmates left behind"
          sub={<><Ticker value={totals.fading} /> already fading</>}
          loading={lost.loading && !lost.data}
          delay={0.05}
        >
          <Ticker value={totals.crewmates} />
        </Stat>
        <Stat
          icon={<TrendingDown size={14} />}
          label="Expected to leave if we do nothing"
          sub={anchor ? `crew retention ${anchor.lift_pct.toFixed(0)}% after an anchor exits` : undefined}
          tone="bad"
          loading={(lost.loading && !lost.data) || (churn.loading && !churn.data)}
          delay={0.1}
        >
          {expectedLoss !== null ? <Ticker value={expectedLoss} prefix="~" /> : "—"}
        </Stat>
        <Stat
          icon={<Coins size={14} />}
          label="Annual bookings at risk"
          sub="crewmates' yearly run-rate"
          tone="warn"
          loading={lost.loading && !lost.data}
          delay={0.15}
        >
          <Ticker value={totals.bookings} format={(n) => fmtUsd(n)} />
        </Stat>
      </div>

      {/* 2 + 3. Offer and plan */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[5fr_7fr]">
        {/* The offer */}
        <div className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-5">
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
            <Gift size={13} /> The offer
          </div>
          <div>
            <div className="text-[17px] font-semibold tracking-tight">Keystone Retention Gift</div>
            <div className="mt-1 inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--good-soft)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--good)]">
              Free · retention, not revenue
            </div>
          </div>
          {offer ? (
            <ul className="flex flex-col gap-2.5">
              <OfferLine icon={<Coins size={15} />} title={`${offer.vc_grant.toLocaleString("en-US")} VC`} sub="credited to every player in scope" />
              {offer.item && (
                <OfferLine
                  icon={<ShoppingBag size={15} />}
                  title={`Exclusive ${offer.item.name}`}
                  sub={`${offer.item.brand} · ${offer.item.crewmate_buys} of their crewmates already bought it`}
                />
              )}
            </ul>
          ) : (
            <div className="v2-skeleton h-14 w-full" />
          )}
          <p className="mt-auto text-[11.5px] leading-relaxed text-[var(--text-faint)]">
            Item picked live: the partner cosmetic these crews&apos; active players buy most (Spanner graph).
          </p>
        </div>

        {/* The plan */}
        <div className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-5">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-faint)]">The plan</div>
            <div className="text-[11.5px] text-[var(--text-faint)]">Step {step} of 3</div>
          </div>
          <ol className="flex flex-col gap-3">
            <PlanStep
              n={1}
              state={tested ? "done" : "active"}
              icon={<FlaskConical size={15} />}
              title="Pressure-test on synthetic twins"
              sub={
                tested
                  ? `${tested.target.count.toLocaleString("en-US")} live crewmates simulated · results in the Focus Group`
                  : "Twins of these exact players react alone, then with their crew captain, creators and Reddit"
              }
              reduce={reduce}
            />
            <PlanStep
              n={2}
              state={dispatched ? "done" : tested ? "active" : "todo"}
              icon={<Send size={15} />}
              title="Dispatch to the crews"
              sub={
                dispatched ? (
                  <span className="v2-tabular">Pub/Sub msg {dispatched.dispatch.messageId} · logged in BigQuery</span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {CHANNELS.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] px-2 py-0.5">
                        <c.icon size={12} /> {c.label}
                      </span>
                    ))}
                  </span>
                )
              }
              reduce={reduce}
            />
            <PlanStep
              n={3}
              state={dispatched ? "active" : "todo"}
              icon={<LineChart size={15} />}
              title="Measure the save"
              sub="5% held out as control · D14 crew retention read out in BigQuery"
              reduce={reduce}
            />
          </ol>
          <div className="mt-auto border-t border-[var(--border)] pt-4">
            {ids.length === 0 ? (
              <div className="text-[12px] text-[var(--text-faint)]">Select crews in Section C first.</div>
            ) : (
              <CrewActButtons
                kind="crews"
                ids={ids}
                label={`Crews that lost a core member (${ids.length})`}
                channels={CHANNELS.map((c) => c.id)}
                onPressureTest={onPressureTest}
                onTested={setTested}
                onDispatched={(r) => {
                  setDispatched(r);
                  onDispatched?.(r);
                }}
                compactMeta
              />
            )}
          </div>
        </div>
      </div>

      {/* 4. Who we're targeting + crew history */}
      {crews.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[5fr_7fr]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              <span>Who we&apos;re targeting</span>
              <span className="normal-case tracking-normal">top {Math.min(5, crews.length)} of {crews.length} by bookings</span>
            </div>
            <ul className="flex flex-col gap-1">
              {crews.slice(0, 5).map((c, i) => {
                const active = c.clan_id === focusCrew;
                return (
                  <motion.li
                    key={c.clan_id}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.24, delay: 0.04 * i, ease: ease.out }}
                  >
                    <button
                      type="button"
                      onClick={() => setFocusCrew(c.clan_id)}
                      className={`v2-press grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors ${
                        active ? "bg-[var(--surface-3)]" : "hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">{c.name}</span>
                        <span className="block truncate text-[11.5px] text-[var(--text-faint)]">lost {c.lost_player.gamer_tag}</span>
                      </span>
                      <span className="v2-tabular text-[12px] text-[var(--warn)]">{c.members_at_risk} fading</span>
                      <span className="v2-tabular w-16 text-right text-[12.5px] text-[var(--text)]">{fmtUsd(c.bookings_at_risk_usd)}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </div>
          {showTimeline && focus && (
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={focus.clan_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <CrewTimeline crewId={focus.clan_id} />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  icon,
  label,
  sub,
  tone,
  loading,
  delay,
  children,
}: {
  icon: ReactNode;
  label: string;
  sub?: ReactNode;
  tone?: "bad" | "warn";
  loading?: boolean;
  delay: number;
  children: ReactNode;
}) {
  const color = tone === "bad" ? "var(--bad)" : tone === "warn" ? "var(--warn)" : "var(--text)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: ease.out }}
      className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
    >
      <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-faint)]">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <div className="v2-skeleton mt-1 h-7 w-20" />
      ) : (
        <div className="v2-tabular text-[26px] font-semibold leading-tight tracking-tight" style={{ color }}>
          {children}
        </div>
      )}
      {sub && !loading && <div className="truncate text-[11.5px] text-[var(--text-dim)]">{sub}</div>}
    </motion.div>
  );
}

function OfferLine({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--surface-3)] text-[var(--text)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="block text-[12px] text-[var(--text-dim)]">{sub}</span>
      </span>
    </li>
  );
}

function PlanStep({
  n,
  state,
  icon,
  title,
  sub,
  reduce,
}: {
  n: number;
  state: "todo" | "active" | "done";
  icon: ReactNode;
  title: string;
  sub: ReactNode;
  reduce: boolean;
}) {
  const ring =
    state === "done"
      ? "bg-[var(--good-soft)] text-[var(--good)] border-[var(--good-soft)]"
      : state === "active"
        ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-ring)]"
        : "bg-[var(--surface-3)] text-[var(--text-faint)] border-[var(--border)]";
  return (
    <li className={`flex items-start gap-3 transition-opacity duration-300 ${state === "todo" ? "opacity-60" : "opacity-100"}`}>
      <span className={`relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${ring}`}>
        <AnimatePresence mode="wait" initial={false}>
          {state === "done" ? (
            <motion.span
              key="done"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, ease: ease.out }}
            >
              <Check size={15} />
            </motion.span>
          ) : (
            <motion.span key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {icon}
            </motion.span>
          )}
        </AnimatePresence>
        {state === "active" && !reduce && (
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-full border border-[var(--accent)] opacity-30" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">
          <span className="mr-1.5 text-[var(--text-faint)]">{n}.</span>
          {title}
        </span>
        <span className="mt-0.5 block text-[12px] text-[var(--text-dim)]">{sub}</span>
      </span>
    </li>
  );
}
