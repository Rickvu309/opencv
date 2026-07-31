"use client";

import { PlannerPage } from "@/components/shell/planner-page";
import { useCopilotSurface } from "@/lib/store";

/**
 * Rewind (RDS-980): the connected weekly review, promoted from a 4-step
 * dialog to a full route. The story of the week first, then the candidates
 * worth keeping, then what carries into next week. Every section below fills
 * in across this ticket's remaining commits.
 */
export default function RewindPage() {
  useCopilotSurface("Rewind");

  return (
    <PlannerPage title="Rewind" description="The story of your week, and what's worth keeping.">
      {null}
    </PlannerPage>
  );
}
