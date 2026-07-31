import { PlanItemCard } from "@/components/planner/plan-item-card";
import type { Goal, LearningItem, Opportunity, PlanItem, Skill, TrackRecordEntry } from "@/lib/types";

interface DoTodayCardProps {
  item?: PlanItem;
  skills: Skill[];
  goals: Goal[];
  opportunities: Opportunity[];
  trackRecordEntries: TrackRecordEntry[];
  learningItems: LearningItem[];
}

/**
 * Serial Position: the single most important next learning action, pinned
 * directly under the orientation band and kept visible while the milestone
 * journey scrolls beneath it. Reuses PlanItemCard, the exact same object
 * that's pinned as the Path Planner's next move and sits at stage 1 item 1
 * of the growth plan, so all three surfaces always agree on what "today"
 * means.
 */
export function DoTodayCard({ item, skills, goals, opportunities, trackRecordEntries, learningItems }: DoTodayCardProps) {
  if (!item) return null;

  return (
    <div className="sticky top-0 z-10 -mx-6 bg-background px-6 pb-4 pt-1">
      <div className="flex flex-col gap-1.5">
        <span className="text-section-label">Do this today</span>
        <PlanItemCard
          item={item}
          pinned
          skills={skills}
          goals={goals}
          opportunities={opportunities}
          trackRecordEntries={trackRecordEntries}
          learningItems={learningItems}
        />
      </div>
    </div>
  );
}
