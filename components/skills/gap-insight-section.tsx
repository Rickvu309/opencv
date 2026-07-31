import { CopilotTag } from "@/components/shared/copilot-tag";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { SkillLevelMeter } from "@/components/skills/skill-level-meter";
import { Card, CardContent } from "@/components/ui/card";
import type { GapInsight, Skill } from "@/lib/types";

interface GapInsightSectionProps {
  gapInsights: GapInsight[];
  skills: Skill[];
}

/**
 * Zone 2: "What is between you and your target direction." A ranked list
 * (highest-priority gap first, order set in lib/data/insights.ts) of the 4
 * gap skills, each with why it matters, current versus needed level, a
 * confidence chip, and an honest uncertainty note where the signal is thin.
 */
export function GapInsightSection({ gapInsights, skills }: GapInsightSectionProps) {
  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2>What is between you and your target direction</h2>
          <CopilotTag />
        </div>

        <div className="flex flex-col gap-3">
          {gapInsights.map((insight, index) => {
            const skill = skills.find((candidate) => candidate.id === insight.skillId);
            if (!skill) return null;
            return (
              <div key={insight.id} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                    <p className="text-sm font-medium text-foreground">{skill.name}</p>
                  </div>
                  <ConfidenceChip confidence={insight.confidence} />
                </div>
                <div className="mt-1.5">
                  <SkillLevelMeter level={skill.level} targetLevel={skill.targetLevel} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{insight.note}</p>
                {insight.uncertaintyNote ? (
                  <p className="mt-2 rounded-md border border-dashed border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Honest note: </span>
                    {insight.uncertaintyNote}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
