import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { MilestoneNode } from "@/components/roadmap/milestone-node";
import { getResourcesForMilestone, type MilestoneProgress } from "@/lib/roadmap-utils";
import { cn } from "@/lib/utils";
import type { MilestoneStatus, PlanItem, RoadmapMilestone, RoadmapResource, Skill, TrackRecordEntry } from "@/lib/types";

interface MilestoneJourneySectionProps {
  milestones: RoadmapMilestone[];
  statuses: Record<string, MilestoneStatus>;
  progressByMilestoneId: Record<string, MilestoneProgress>;
  resources: RoadmapResource[];
  skills: Skill[];
  planItems: PlanItem[];
  trackRecordEntries: TrackRecordEntry[];
}

const CIRCLE_STYLES: Record<MilestoneStatus, string> = {
  "in-progress": "border-primary bg-primary text-primary-foreground",
  "up-next": "border-primary bg-background text-primary",
  later: "border-border bg-muted text-muted-foreground",
};

/**
 * Zone 3, the main experience: the 3 milestones as one connected
 * progression, a plain-CSS vertical journey line (no graph library)
 * connecting each numbered node to the next, colored by how far the journey
 * above it has actually progressed rather than a fixed design.
 */
export function MilestoneJourneySection({
  milestones,
  statuses,
  progressByMilestoneId,
  resources,
  skills,
  planItems,
  trackRecordEntries,
}: MilestoneJourneySectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2>The milestone journey</h2>
          <CopilotTag />
        </div>
        <AskCopilotButton surface="Roadmap" objectLabel="Milestone journey" />
      </div>

      <div className="flex flex-col">
        {milestones.map((milestone, index) => {
          const status = statuses[milestone.id];
          const progress = progressByMilestoneId[milestone.id] ?? { done: 0, total: 0 };
          const hasProgress = progress.done > 0;

          return (
            <div key={milestone.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                    CIRCLE_STYLES[status]
                  )}
                >
                  {index + 1}
                </div>
                {index < milestones.length - 1 ? (
                  <div className={cn("my-1 w-1 flex-1 rounded-full", hasProgress ? "bg-primary/70" : "bg-border")} />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <MilestoneNode
                  milestone={milestone}
                  status={status}
                  progress={progress}
                  resources={getResourcesForMilestone(resources, milestone.id)}
                  skills={skills}
                  planItems={planItems}
                  trackRecordEntries={trackRecordEntries}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
