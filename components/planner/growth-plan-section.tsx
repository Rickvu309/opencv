import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";
import { PlanItemCard } from "@/components/planner/plan-item-card";
import { PLAN_STAGES, computeStageProgress, groupPlanItemsByStage } from "@/lib/planner-utils";
import type { Goal, LearningItem, Opportunity, PlanItem, Skill, TrackRecordEntry } from "@/lib/types";

interface GrowthPlanSectionProps {
  items: PlanItem[];
  skills: Skill[];
  goals: Goal[];
  opportunities: Opportunity[];
  trackRecordEntries: TrackRecordEntry[];
  learningItems: LearningItem[];
}

/**
 * Zone 5, the visual layer: a staged progression map as a plain CSS grid, no
 * graph library. Three columns (Miller's Law chunking), each with 2 to 4
 * concrete items and a subtle Goal-Gradient progress line. No outer Card
 * wrapper here, PlanItemCard is already a full Card and the rest of this
 * app never nests one Card directly inside another (see LearningPlanSection
 * for the same pattern with LearningItemCard).
 */
export function GrowthPlanSection({
  items,
  skills,
  goals,
  opportunities,
  trackRecordEntries,
  learningItems,
}: GrowthPlanSectionProps) {
  const grouped = groupPlanItemsByStage(items);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2>Growth plan</h2>
          <CopilotTag />
        </div>
        <AskCopilotButton surface="Path Planner" objectLabel="Growth plan" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLAN_STAGES.map((stage) => {
          const stageItems = grouped[stage.key];
          const progress = computeStageProgress(stageItems);
          const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

          return (
            <div key={stage.key} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-section-label">{stage.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {progress.done} of {progress.total} already in motion
                </span>
              </div>
              <Progress value={percent} />
              <div className="flex flex-col gap-2">
                {stageItems.length === 0 ? (
                  <EmptyState message="Nothing staged here yet." />
                ) : (
                  stageItems.map((item) => (
                    <PlanItemCard
                      key={item.id}
                      item={item}
                      skills={skills}
                      goals={goals}
                      opportunities={opportunities}
                      trackRecordEntries={trackRecordEntries}
                      learningItems={learningItems}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
