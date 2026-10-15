"use client";

/**
 * Isolated dev page for the Crew · Churn + Section C components.
 * http://localhost:3103/v2-dev/crew
 */
import { StorylineProvider, useStoryline } from "@/components/v2/shell/StorylineProvider";
import { CrewActPanel, CrewChurnPanel, LostCoreMemberCard } from "@/components/v2/crew";

function Body() {
  const story = useStoryline();
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-8 py-10">
      <CrewChurnPanel />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <LostCoreMemberCard />
        <div className="flex flex-col gap-2">
          <div className="v2-tabular text-[11px] text-[var(--text-faint)]">storyline step: {story.step}</div>
          {story.step === "ACT" && <CrewActPanel />}
        </div>
      </div>
    </div>
  );
}

export default function CrewDevPage() {
  return (
    <div className="v2-root h-screen overflow-y-auto">
      <StorylineProvider initialStep="C_CREWS" syncHash={false}>
        <Body />
      </StorylineProvider>
    </div>
  );
}
