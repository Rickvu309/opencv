"use client";

import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { GoalStatus } from "@/lib/types";

const STATUS_STYLES: Record<GoalStatus, string> = {
  "not started": "bg-muted text-muted-foreground",
  "in progress": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "on track": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "at risk": "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export default function GoalsPage() {
  useCopilotSurface("Goals");
  const { state } = useStore();
  const gapInsights = state.insights.filter((insight) => insight.kind === "gap");

  return (
    <div className="flex flex-col">
      <PageHeader title="Goals" description={`${state.goals.length} active goals toward your target direction.`} />

      <div className="flex flex-col gap-3 p-6">
        {state.goals.map((goal) => {
          const linkedOpportunities = (goal.opportunityIds ?? [])
            .map((id) => state.opportunities.find((opportunity) => opportunity.id === id))
            .filter((opportunity): opportunity is NonNullable<typeof opportunity> => Boolean(opportunity));
          const linkedLearningItems = (goal.learningItemIds ?? [])
            .map((id) => state.learningItems.find((item) => item.id === id))
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

          return (
            <Card key={goal.id} className="ring-foreground/8">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h3>{goal.title}</h3>
                    <p className="text-xs text-muted-foreground">Target date: {goal.targetDate}</p>
                  </div>
                  <Badge className={`${STATUS_STYLES[goal.status]} capitalize`}>{goal.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{goal.why}</p>
                <p className="text-sm text-foreground">{goal.progressNote}</p>

                {linkedOpportunities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {linkedOpportunities.map((opportunity) => (
                      <Badge key={opportunity.id} variant="outline" asChild>
                        <Link href={`/opportunities/${opportunity.id}`}>{opportunity.company}</Link>
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {linkedLearningItems.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {linkedLearningItems.map((item) => (
                      <Badge key={item.id} variant="secondary">
                        {item.title}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {goal.id === "goal-1" && gapInsights.length > 0 ? (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Gap analysis</span>
                        <CopilotTag />
                      </div>
                      <div className="flex flex-col gap-2">
                        {gapInsights.map((insight) => {
                          const skill = state.skills.find((item) => item.id === insight.skillId);
                          return (
                            <div key={insight.id} className="rounded-lg border border-border bg-muted/30 p-2.5">
                              <p className="text-sm font-medium text-foreground">
                                {skill?.name ?? "Skill"} · level {skill?.level} of {skill?.targetLevel}
                              </p>
                              <p className="text-sm text-muted-foreground">{insight.note}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
