import Link from "next/link";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DirectionGapAnalysis, LearningItem, Skill } from "@/lib/types";

interface GapAnalysisSectionProps {
  gapAnalysis: DirectionGapAnalysis;
  skills: Skill[];
  learningItems: LearningItem[];
}

/**
 * Zone 3: gap analysis against the target direction, in three honest groups.
 * Missing items link out to the relevant skill and, once one exists, a
 * specific learning item, so the connections are already in place for
 * ticket 13's full learning plan to build on.
 */
export function GapAnalysisSection({ gapAnalysis, skills, learningItems }: GapAnalysisSectionProps) {
  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2>Gap analysis against the target direction</h2>
          <CopilotTag />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Already aligned</span>
          <div className="flex flex-col gap-2">
            {gapAnalysis.aligned.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-muted/30 p-2.5">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.evidenceNote}</p>
                {item.trackRecordEntryId ? (
                  <Badge variant="outline" className="mt-1.5" asChild>
                    <Link href="/track-record">See evidence in Track Record</Link>
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Missing</span>
          <div className="flex flex-col gap-2">
            {gapAnalysis.missing.map((item) => {
              const skill = item.skillId ? skills.find((candidate) => candidate.id === item.skillId) : undefined;
              const learningItem = item.learningItemId
                ? learningItems.find((candidate) => candidate.id === item.learningItemId)
                : undefined;
              return (
                <div key={item.id} className="rounded-lg border border-border bg-muted/30 p-2.5">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.note}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {learningItem ? (
                      <Badge variant="outline" asChild>
                        <Link href="/skills">{learningItem.title}</Link>
                      </Badge>
                    ) : skill ? (
                      <Badge variant="outline" asChild>
                        <Link href="/skills">{skill.name} on Skills &amp; Learning</Link>
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Uncertain</span>
          <div className="flex flex-col gap-2">
            {gapAnalysis.uncertain.map((item) => (
              <div key={item.id} className="rounded-lg border border-dashed border-border bg-muted/20 p-2.5">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {gapAnalysis.pathIntoLearningNote}{" "}
          <Link href="/skills" className="underline underline-offset-2 hover:text-foreground">
            Go to Skills &amp; Learning
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
