import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { LinkChip } from "@/components/shared/link-chip";
import { SkillLevelMeter } from "@/components/skills/skill-level-meter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import type {
  AiInsight,
  DirectionUncertainItem,
  GapInsight,
  GapTiming,
  LearningItem,
  PlannerGapAnalysis,
  Skill,
} from "@/lib/types";

function TimingBadge({ timing }: { timing: GapTiming }) {
  return (
    <Badge variant={timing === "now" ? "default" : "secondary"}>
      {timing === "now" ? "Matters now" : "Matters by month 6"}
    </Badge>
  );
}

interface GapProofSectionProps {
  scenarioTitle: string;
  gapAnalysis: PlannerGapAnalysis;
  skills: Skill[];
  insights: AiInsight[];
  learningItems: LearningItem[];
  uncertain: DirectionUncertainItem[];
}

/**
 * Zone 4, placed immediately above the growth plan roadmap (Proximity: the
 * gaps sit right beside the path they block). Two ranked groups for the
 * working path, skills (the same 4 gap skills the rest of the app tracks,
 * re-ranked and timed for this path) and proof (evidence gaps with no
 * existing object type of their own), plus a third honest-uncertainty group
 * read straight from the store so it never drifts from Goals' own gap
 * analysis.
 */
export function GapProofSection({
  scenarioTitle,
  gapAnalysis,
  skills,
  insights,
  learningItems,
  uncertain,
}: GapProofSectionProps) {
  const { setSkillHighlight } = useStore();

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2>What&apos;s between you and {scenarioTitle}</h2>
            <CopilotTag />
          </div>
          <AskCopilotButton surface="Path Planner" objectLabel="Gap and proof analysis" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-section-label">Skills, ranked</span>
            <div className="flex flex-col gap-2">
              {gapAnalysis.skills.map((gapRef, index) => {
                const skill = skills.find((candidate) => candidate.id === gapRef.skillId);
                const insight = insights.find(
                  (candidate): candidate is GapInsight =>
                    candidate.kind === "gap" && candidate.skillId === gapRef.skillId
                );
                if (!skill) return null;
                return (
                  <div key={gapRef.skillId} className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                        <p className="text-sm font-medium text-foreground">{skill.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TimingBadge timing={gapRef.timing} />
                        {insight ? <ConfidenceChip confidence={insight.confidence} /> : null}
                      </div>
                    </div>
                    <SkillLevelMeter level={skill.level} targetLevel={skill.targetLevel} />
                    {insight ? <p className="text-xs text-muted-foreground">{insight.note}</p> : null}
                    <div>
                      <LinkChip href="/skills" onClick={() => setSkillHighlight(skill.id)}>
                        Open on Skills &amp; Learning
                      </LinkChip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-section-label">Proof, evidence gaps</span>
            <div className="flex flex-col gap-2">
              {gapAnalysis.proof.map((gap) => {
                const linkedLearningItem = gap.linkedLearningItemId
                  ? learningItems.find((item) => item.id === gap.linkedLearningItemId)
                  : undefined;
                return (
                  <div key={gap.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{gap.label}</p>
                      <TimingBadge timing={gap.timing} />
                    </div>
                    <p className="text-xs text-muted-foreground">{gap.note}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {linkedLearningItem ? (
                        <LinkChip href="/skills">{linkedLearningItem.title}</LinkChip>
                      ) : (
                        <LinkChip href={gap.proposedActionHref}>{gap.proposedActionLabel}</LinkChip>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {uncertain.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-section-label">Honest unknowns</span>
            <div className="flex flex-col gap-2">
              {uncertain.map((item) => (
                <div key={item.id} className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
