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
import { useEffect, type ReactNode } from "react";
import { BrandAttachCard, CreatorEngagementCard } from "../creatorbrand";
import { CrewActPanel, CrewChurnPanel, LostCoreMemberCard } from "../crew";
import { Player360 } from "../player360";
import { PersonalizationFlow } from "../concept";
import { Reveal } from "../motion";
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

function StepFrame({ step, children, heading = true }: { step: StorylineStep; children: ReactNode; heading?: boolean }) {
  const meta = STEP_META[step];
  return (
    <div className="mx-auto w-full max-w-[1280px] px-8 pb-20 pt-8">
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
        <StepFrame step={step} heading={false}>
          <Player360 playerId={playerId} />
        </StepFrame>
      );
    case "METRICS":
      return (
        <StepFrame step={step}>
          <Reveal className="grid grid-cols-1 gap-4 xl:grid-cols-3" stagger={0.08} y={12} blur={4}>
            <CrewChurnPanel />
            <CreatorEngagementCard />
            <BrandAttachCard playerId={playerId} />
          </Reveal>
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
