"use client";

/**
 * <DeepDiveSheet /> Ashmita's 2K agenda, Sections B-D, inside the Take-Two
 * command center. Each tab is the 2K component from the Courtside storyline
 * (unchanged) plus a Take-Two layer: one live cross-label number and the play
 * that acts on it.
 *
 *   B · Crew churn       CrewChurnPanel (churn exposure, anchor dependency, keystones, crew timeline)
 *   B · Creators         CreatorEngagementCard (incremental players vs control) + CreatorHubsViz
 *   B · Brand + crew     BrandAttachCard + SocialHopsViz (2K) + SocialHopsViz across labels
 *   C · Spanner + BigQuery  LostCoreMemberCard (one federated query) -> CrewActPanel
 *   D · Synthetic testing   PersonalizationFlow (Curtis nodal workflow: NBA vs WNBA vs College)
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Database, Layers, X } from "lucide-react";
import { BrandAttachCard, CreatorEngagementCard, CreatorHubsViz, SocialHopsViz } from "../creatorbrand";
import { CrewActPanel, CrewChurnPanel, LostCoreMemberCard } from "../crew";
import { PersonalizationFlow } from "../concept";
import type { AudienceResponse, PlayId } from "@/lib/v2/plays";
import type { CrossLabelCreatorsResponse } from "@/app/api/v2/crosslabel/creators/route";

export type DeepTab = "crew" | "creator" | "brand" | "lost" | "concept";

export const DEEP_TABS: { id: DeepTab; section: "B" | "C" | "D"; label: string }[] = [
  { id: "crew", section: "B", label: "Crew churn" },
  { id: "creator", section: "B", label: "Creators" },
  { id: "brand", section: "B", label: "Brand + crew" },
  { id: "lost", section: "C", label: "Spanner + BigQuery" },
  { id: "concept", section: "D", label: "Synthetic testing" },
];

function useJson<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    const ac = new AbortController();
    setData(null);
    setErr(null);
    fetch(url, { signal: ac.signal, cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(`${b.service ?? "api"}: ${b.message ?? b.error}`);
        setData(b as T);
      })
      .catch((e) => e?.name !== "AbortError" && setErr(String(e.message ?? e)));
    return () => ac.abort();
  }, [url]);
  return { data, err };
}

/** The Take-Two layer on every tab: one cross-label fact + the play that acts on it. */
export function TakeTwoLayer({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--warn)_35%,var(--border))] bg-[color-mix(in_oklab,var(--warn)_7%,var(--surface))] px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5 text-[13px] leading-snug text-[var(--text)]">
        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--warn)]">
          Across Take-Two
        </span>
        <span>{children}</span>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="v2-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)]"
        >
          {action.label}
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const int = (n: number) => n.toLocaleString("en-US");

export function CrewTab({ onAct, showActions = true }: { onAct: (p: PlayId, seg?: string) => void; showActions?: boolean }) {
  const { data, err } = useJson<AudienceResponse>("/api/v2/actions/audience?play=save_elsewhere&segment=fading_2k");
  return (
    <>
      <TakeTwoLayer action={{ label: "Act: Save them elsewhere", onClick: () => onAct("save_elsewhere", "fading_2k") }}>
        {err ? (
          <span className="text-[var(--bad)]">{err}</span>
        ) : data ? (
          <>
            Churn exposure stops at 2K&apos;s walls. <b>{int(data.count)}</b> 2K players with falling sessions are still active this week in a Rockstar or Zynga title:
            they didn&apos;t leave Take-Two.
          </>
        ) : (
          "Checking who is still active in other labels..."
        )}
      </TakeTwoLayer>
      <CrewChurnPanel showActions={showActions} />
    </>
  );
}

export function CreatorTab() {
  const { data, err } = useJson<CrossLabelCreatorsResponse>("/api/v2/crosslabel/creators");
  const top = data?.creators.slice().sort((a, b) => b.cross_share - a.cross_share)[0];
  return (
    <>
      <TakeTwoLayer>
        {err ? (
          <span className="text-[var(--bad)]">{err}</span>
        ) : data ? (
          <>
            2K creator audiences already reach other labels: <b>{pct(data.also_rockstar / Math.max(1, data.followers))}</b> of {int(data.followers)} creator
            followers also play a Rockstar title, <b>{pct(data.also_zynga / Math.max(1, data.followers))}</b> a Zynga title
            {top ? (
              <>
                . Biggest bridge: <b>{top.handle}</b> ({pct(top.cross_share)} of followers).
              </>
            ) : (
              "."
            )}{" "}
            Creator data for Rockstar and Zynga creators plugs into the same graph.
          </>
        ) : (
          "Measuring how far 2K creator audiences reach..."
        )}
      </TakeTwoLayer>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CreatorEngagementCard />
        <CreatorHubsViz />
      </div>
    </>
  );
}

export function BrandTab({ playerId, onAct }: { playerId: string | null; onAct: (p: PlayId, seg?: string) => void }) {
  return (
    <>
      <TakeTwoLayer action={{ label: "Act: Warm intro", onClick: () => onAct("warm_intro", "rockstar-nba2k") }}>
        Social hops don&apos;t stop at a label either: the right-hand path runs from a 2K Rec crew captain to a GTA Online heist crew, live. &ldquo;Players like you
        bought&rdquo; becomes &ldquo;friends like you already play&rdquo;.
      </TakeTwoLayer>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BrandAttachCard playerId={playerId} />
        <div className="flex flex-col gap-4">
          <SocialHopsViz />
          <div>
            <div className="mb-2 text-[12px] font-medium text-[var(--text-dim)]">Across labels · 2K Rec crew captain → GTA Online heist crew</div>
            <SocialHopsViz from="archetype:REC_CREW_CAPTAIN" to="archetype:GTAO_HEIST_CREW" />
          </div>
        </div>
      </div>
    </>
  );
}

export function LostTab({ onAct }: { onAct: (p: PlayId, seg?: string) => void }) {
  const [crewIds, setCrewIds] = useState<string[] | null>(null);
  return (
    <>
      <TakeTwoLayer action={{ label: "Act: Save them elsewhere", onClick: () => onAct("save_elsewhere", "fading_2k") }}>
        One statement joins live Spanner crews with BigQuery history, with no separate analytics hop. Every cross-label Act uses the same pattern: audience from
        Spanner, holdout and readout in BigQuery.
      </TakeTwoLayer>
      <LostCoreMemberCard onAct={(ids) => setCrewIds(ids)} />
      {crewIds && (
        <div className="mt-4">
          <CrewActPanel crewIds={crewIds} />
        </div>
      )}
    </>
  );
}

export function ConceptTab({ onAct }: { onAct: (p: PlayId, seg?: string) => void }) {
  return (
    <>
      <TakeTwoLayer action={{ label: "Pressure-test a cross-label play", onClick: () => onAct("gta6_window", "day_one") }}>
        The same synthetic engine, with personas built from real graph rows, pressure-tests every cross-label play in Act before anything ships.
      </TakeTwoLayer>
      <PersonalizationFlow />
    </>
  );
}

export function DeepDiveSheet({
  tab,
  onTab,
  onClose,
  onAct,
  playerId,
}: {
  tab: DeepTab | null;
  onTab: (t: DeepTab) => void;
  onClose: () => void;
  onAct: (p: PlayId, seg?: string) => void;
  playerId: string | null;
}) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!tab) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tab, onClose]);
  return (
    <>
    <AnimatePresence>
      {tab && (
        <motion.div
          key="deep-scrim"
          className="fixed inset-0 z-[72] bg-[var(--overlay)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        />
      )}
    </AnimatePresence>
      {/* Enter animation only: the 2K panels use shared-layout ids, which never
          release inside an exiting AnimatePresence child, so the sheet unmounts instantly. */}
      {tab && (
        <motion.aside
          key="deep-sheet"
          role="dialog"
          aria-label="2K deep dive"
          className="fixed inset-3 z-[73] flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)]"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 360, damping: 34 }}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
                <Layers size={15} className="text-[var(--text-faint)]" /> 2K deep dive
              </div>
              <div className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] p-1">
                {DEEP_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTab(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition-[background-color,color] duration-200 ${
                      tab === t.id ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                    }`}
                  >
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--surface-3)] text-[9.5px] font-bold text-[var(--text-dim)]">{t.section}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1.5 text-[11px] text-[var(--text-faint)] md:inline-flex">
                <Database size={11} /> Spanner Graph · BigQuery · Gemini, live
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close deep dive"
                className="v2-press grid h-8 w-8 place-items-center rounded-full text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {/* Keyed, enter-only (a nested AnimatePresence would block the sheet's exit). */}
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              {tab === "crew" && <CrewTab onAct={onAct} />}
              {tab === "creator" && <CreatorTab />}
              {tab === "brand" && <BrandTab playerId={playerId} onAct={onAct} />}
              {tab === "lost" && <LostTab onAct={onAct} />}
              {tab === "concept" && <ConceptTab onAct={onAct} />}
            </motion.div>
          </div>
        </motion.aside>
      )}
    </>
  );
}

export default DeepDiveSheet;
