"use client";

import { PlannerPage } from "@/components/shell/planner-page";
import { WeekStoryBand } from "@/components/rewind/week-story-band";
import { rewindWeekStory } from "@/lib/data/rewind";
import { useCopilotSurface } from "@/lib/store";

/**
 * Rewind (RDS-980): the connected weekly review, promoted from a 4-step
 * dialog to a full route. The story of the week first, then the candidates
 * worth keeping, then what carries into next week.
 */
export default function RewindPage() {
  useCopilotSurface("Rewind");

  return (
    <PlannerPage
      title="Rewind"
      description="The story of your week, and what's worth keeping."
      band={<WeekStoryBand story={rewindWeekStory} />}
    >
      {null}
    </PlannerPage>
  );
}
