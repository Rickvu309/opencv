import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { LearningItemCard } from "@/components/skills/learning-item-card";
import { Badge } from "@/components/ui/badge";
import type { Goal, LearningItem, Skill } from "@/lib/types";

interface LearningPlanSectionProps {
  skills: Skill[];
  learningItems: LearningItem[];
  goals: Goal[];
}

/**
 * Zone 3: the learning plan. A "Your plan" strip surfaces every accepted
 * item up top, then the full set of learning items renders as cards grouped
 * by linked skill, in the seed order authored highest expected benefit first
 * within each group.
 */
export function LearningPlanSection({ skills, learningItems, goals }: LearningPlanSectionProps) {
  const plannedItems = learningItems.filter((item) => item.state === "planned");

  const skillGroups = skills
    .map((skill) => ({
      skill,
      items: learningItems.filter((item) => item.skillId === skill.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2>Learning plan</h2>
          <CopilotTag />
        </div>
        <AskCopilotButton surface="Skills & Learning" objectLabel="Learning plan" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Your plan</span>
        {plannedItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {plannedItems.map((item) => (
              <Badge key={item.id} variant="secondary">
                {item.title}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nothing accepted into your plan yet. Add an item below to start one.
          </p>
        )}
      </div>

      {skillGroups.length === 0 ? (
        <EmptyState message="No learning items yet." />
      ) : (
        <div className="flex flex-col gap-5">
          {skillGroups.map(({ skill, items }) => (
            <div key={skill.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">{skill.name}</h3>
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <LearningItemCard
                    key={item.id}
                    item={item}
                    goal={item.goalId ? goals.find((candidate) => candidate.id === item.goalId) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
