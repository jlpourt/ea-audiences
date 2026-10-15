"use client";

/**
 * <CrewActPanel /> The "Act" step for Section C crews (storyline step ACT).
 *
 * Reads crew ids from the storyline (set by <LostCoreMemberCard> "Act") or
 * from props, then runs Pressure-Test (existing Focus Group) -> Dispatch
 * (existing activation path) against the live members of those crews.
 */
import { Users } from "lucide-react";
import type { CrewFocusGroupHandoff } from "@/lib/v2/crew";
import { useOptionalStoryline } from "@/components/v2/shell/StorylineProvider";
import { CrewActButtons, type DispatchResult, type PressureTestResult } from "./CrewActButtons";
import { CrewTimeline } from "./CrewTimeline";

export interface CrewActPanelProps {
  crewIds?: string[];
  onPressureTest?: (handoff: CrewFocusGroupHandoff, result: PressureTestResult) => void;
  onDispatched?: (result: DispatchResult) => void;
  showTimeline?: boolean;
  className?: string;
}

export function CrewActPanel({ crewIds, onPressureTest, onDispatched, showTimeline = true, className }: CrewActPanelProps) {
  const story = useOptionalStoryline();
  const ids = crewIds ?? story?.crewIds ?? [];

  return (
    <section className={`v2-card flex flex-col gap-4 p-5 text-[var(--text)] ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-[var(--text-faint)]">Act</div>
          <h3 className="mt-1 text-[18px] font-semibold tracking-tight">Stabilize the crews</h3>
        </div>
        <div className="v2-tabular flex items-center gap-2 text-[13px] text-[var(--text-dim)]">
          <Users size={14} />
          {ids.length} crews
        </div>
      </div>
      {ids.length === 0 ? (
        <div className="text-[12px] text-[var(--text-faint)]">Select crews in Section C first.</div>
      ) : (
        <CrewActButtons
          kind="crews"
          ids={ids}
          label={`Crews that lost a core member (${ids.length})`}
          onPressureTest={onPressureTest}
          onDispatched={onDispatched}
        />
      )}
      {showTimeline && ids[0] && (
        <div className="border-t border-[var(--border)] pt-4">
          <CrewTimeline crewId={ids[0]} />
        </div>
      )}
    </section>
  );
}
