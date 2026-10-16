"use client";

/**
 * StepMounts: what renders at each storyline step.
 *
 * MOUNT POINTS for feature agents (contract section 6). A feature component is
 * imported here only once its file exists; until then the step renders a
 * layout-only <MountSlot> labeled with the step (no fake data).
 *
 *   B_PLAYER / B_SOCIAL : <Player360 />            src/components/v2/player360
 *   METRICS             : <CrewChurnPanel />       src/components/v2/crew
 *                         <CreatorEngagementCard /> + <BrandAttachCard />  src/components/v2/creatorbrand
 *   C_CREWS             : <LostCoreMemberCard />   src/components/v2/crew
 *   ACT                 : <CrewActPanel />         src/components/v2/crew
 *   D_CONCEPT           : <PersonalizationFlow />  src/components/v2/concept (alias ConceptTest)
 */
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BrandAttachCard, CreatorEngagementCard, CreatorHubsViz, SocialHopsViz } from "../creatorbrand";
import { CrewActPanel, CrewChurnPanel, LostCoreMemberCard } from "../crew";
import { Player360 } from "../player360";
import { PersonalizationFlow } from "../concept";
import { ActiveIndicator, AnimatePresence, ease, useReducedMotion } from "../motion";
import { Home, type HomeProps } from "../home/Home";
import { LiveErrorNote } from "../home/atoms";
import { useLiveJson } from "../home/useLiveJson";
import { STEP_META, useStoryline, type StorylineStep } from "./StorylineProvider";


/**
 * Steps that share one scene keep the same component mounted across the step
 * change, so Player360 can animate ego -> social internally instead of being
 * torn down by the page transition.
 */
export function sceneOf(step: StorylineStep): string {
  if (step === "B_PLAYER" || step === "B_SOCIAL") return "B_PLAYER360";
  return step;
}

export function MountSlot({ step, component, className }: { step: StorylineStep; component: string; className?: string }) {
  const meta = STEP_META[step];
  return (
    <div
      className={`flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] text-center ${className ?? ""}`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--surface-3)] text-[12px] font-semibold text-[var(--text-dim)]">
        {meta.section}
      </span>
      <div className="text-[14px] font-medium text-[var(--text)]">{meta.label}</div>
      <code className="text-[11.5px] text-[var(--text-faint)]">{`<${component} />`}</code>
    </div>
  );
}

function StepFrame({
  step,
  children,
  heading = true,
  fill = false,
}: {
  step: StorylineStep;
  children: ReactNode;
  heading?: boolean;
  /** Full-bleed canvas scenes (Player 360): wider and less padding so the graph gets the room. */
  fill?: boolean;
}) {
  const meta = STEP_META[step];
  return (
    <div className={fill ? "mx-auto w-full max-w-[1560px] px-4 pb-2 pt-2" : "mx-auto w-full max-w-[1280px] px-8 pb-20 pt-8"}>
      {heading && (
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-semibold text-[var(--text-on-accent)]">
          {meta.section}
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--text)]">{meta.label}</h1>
      </div>
      )}
      {children}
    </div>
  );
}

/**
 * ACT scene. If Jamie jumps straight to ACT (step indicator) with no crews
 * selected, default the selection to the live "lost a core member this week"
 * crews so Pressure-Test is never disabled. Live GET, errors shown inline.
 */
function ActScene() {
  const { crewIds, setCrewIds } = useStoryline();
  const need = crewIds.length === 0;
  const { data, error, reload } = useLiveJson<{ crews: { clan_id: string }[] }>(
    need ? "/api/v2/crew/lost-core-member?days=7" : null,
  );
  useEffect(() => {
    if (need && data?.crews?.length) setCrewIds(data.crews.map((c) => c.clan_id));
  }, [need, data, setCrewIds]);
  return (
    <div className="flex flex-col gap-3">
      {need && error && <LiveErrorNote error={error} onRetry={reload} />}
      {need && data && data.crews.length === 0 && (
        <div className="text-[12.5px] text-[var(--text-faint)]">No crews lost a core member in the last 7 days.</div>
      )}
      <CrewActPanel crewIds={crewIds} />
    </div>
  );
}

/**
 * METRICS scene: one signal per view instead of three cramped columns.
 * Tabs: Crew churn (full width) · Creator impact (engagement + hubs) ·
 * Brand + Crew (attach + social hops). Task cards can deep-link via `focus`.
 */
type MetricsTab = "crew" | "creator" | "brand";
const METRIC_TABS: { id: MetricsTab; label: string; hint: string }[] = [
  { id: "crew", label: "Crew churn", hint: "" },
  { id: "creator", label: "Creator impact", hint: "Incremental players vs matched control" },
  { id: "brand", label: "Brand + Crew", hint: "Partners spread through co-play" },
];

function MetricsScene() {
  const { playerId, focus, goTo } = useStoryline();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<MetricsTab>(
    focus === "creator" ? "creator" : focus === "brand" ? "brand" : "crew",
  );
  const idx = METRIC_TABS.findIndex((t) => t.id === tab);
  const nextTab = METRIC_TABS[idx + 1];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Signals"
          className="relative inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] p-1"
        >
          {METRIC_TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setTab(t.id)}
                className={`v2-press relative h-9 rounded-[var(--radius-pill)] px-4 text-[13.5px] font-medium transition-colors ${
                  active ? "text-[var(--text)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                }`}
              >
                {active && (
                  <ActiveIndicator
                    layoutId="metrics-tab"
                    className="rounded-[var(--radius-pill)] bg-[var(--surface-3)] shadow-[var(--shadow-sm)]"
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>
        <span className="text-[13px] text-[var(--text-faint)]">{METRIC_TABS[idx].hint}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)" }}
          transition={{ duration: 0.26, ease: ease.out }}
        >
          {tab === "crew" && <CrewChurnPanel />}
          {tab === "creator" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CreatorEngagementCard />
              <CreatorHubsViz />
            </div>
          )}
          {tab === "brand" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <BrandAttachCard playerId={playerId} />
              <SocialHopsViz />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => (nextTab ? setTab(nextTab.id) : goTo("C_CREWS"))}
          className="v2-press inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-5 text-[13.5px] font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
        >
          {nextTab ? nextTab.label : "Crews that lost a core member"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Renders one scene. `step` is a prop (not read from context) so that while a
 * scene is exiting it keeps rendering its own step rather than the new one.
 */
export function StepContent({ step, homeProps }: { step: StorylineStep; homeProps: HomeProps }) {
  const { playerId } = useStoryline();

  switch (step) {
    case "A_HOME":
      return <Home {...homeProps} />;
    case "B_PLAYER":
    case "B_SOCIAL":
      return (
        <StepFrame step={step} heading={false} fill>
          {/* Fill the viewport below the 56px top bar so the graph renders as large as possible. */}
          <Player360 playerId={playerId} className="h-[calc(100vh-72px)]" />
        </StepFrame>
      );
    case "METRICS":
      return (
        <StepFrame step={step}>
          <MetricsScene />
        </StepFrame>
      );
    case "C_CREWS":
      return (
        <StepFrame step={step}>
          <LostCoreMemberCard />
        </StepFrame>
      );
    case "ACT":
      return (
        <StepFrame step={step}>
          <ActScene />
        </StepFrame>
      );
    case "D_CONCEPT":
      return (
        <StepFrame step={step} heading={false}>
          <PersonalizationFlow />
        </StepFrame>
      );
  }
}
