import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { WhyThisReading } from "@/components/shared/why-this-reading";
import { PlanItemCard } from "@/components/planner/plan-item-card";
import type { Goal, LearningItem, Opportunity, PathScenario, PlanItem, Skill, TrackRecordEntry } from "@/lib/types";

interface RecommendedPathCardProps {
  scenario: PathScenario;
  nextMove?: PlanItem;
  skills: Skill[];
  goals: Goal[];
  opportunities: Opportunity[];
  trackRecordEntries: TrackRecordEntry[];
  learningItems: LearningItem[];
}

/**
 * Zone 2, the decisive summary card: answers "what and why" in one
 * screenful. The path name, a two-line why grounded in evidence, a
 * confidence chip, and the single most important next move pinned visibly
 * (Serial Position: this is stage 1 item 1 of the roadmap below, the exact
 * same PlanItem object, not a paraphrase of it).
 */
export function RecommendedPathCard({
  scenario,
  nextMove,
  skills,
  goals,
  opportunities,
  trackRecordEntries,
  learningItems,
}: RecommendedPathCardProps) {
  return (
    <Card className="ring-primary/25">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CopilotTag />
            <span className="text-section-label">Recommended path</span>
          </div>
          <ConfidenceChip confidence={scenario.confidence} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-display break-words">{scenario.title}</p>
          <p className="text-sm text-muted-foreground">{scenario.whySummary}</p>
        </div>

        <WhyThisReading text={scenario.whyThisReading} />

        {nextMove ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-section-label">Your next move</span>
            <PlanItemCard
              item={nextMove}
              pinned
              skills={skills}
              goals={goals}
              opportunities={opportunities}
              trackRecordEntries={trackRecordEntries}
              learningItems={learningItems}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
