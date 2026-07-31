"use client";

import { Check, X } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function SkillsPage() {
  useCopilotSurface("Skills & Learning");
  const { state, acceptLearningItem, dismissLearningItem } = useStore();

  const categories = Array.from(new Set(state.skills.map((skill) => skill.category)));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Skills & Learning"
        description={`${state.skills.length} tracked skills, ${state.skills.filter((s) => s.isGap).length} flagged as gaps.`}
      />

      <div className="flex flex-col gap-6 p-6">
        <section className="flex flex-col gap-3">
          <h2>Skills</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((category) => (
              <Card key={category} className="ring-foreground/8">
                <CardContent className="flex flex-col gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">{category}</span>
                  <div className="flex flex-col gap-3">
                    {state.skills
                      .filter((skill) => skill.category === category)
                      .map((skill) => (
                        <div key={skill.id} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-foreground">{skill.name}</span>
                            <div className="flex items-center gap-1.5">
                              {skill.isGap ? (
                                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                                  Gap
                                </Badge>
                              ) : null}
                              <span className="text-xs text-muted-foreground">
                                {skill.level} / {skill.targetLevel}
                              </span>
                            </div>
                          </div>
                          <Progress value={(skill.level / 5) * 100} />
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2>Learning items</h2>
            <CopilotTag />
          </div>
          <div className="flex flex-col gap-2">
            {state.learningItems.map((item) => {
              const skill = item.skillId ? state.skills.find((s) => s.id === item.skillId) : undefined;
              const goal = item.goalId ? state.goals.find((g) => g.id === item.goalId) : undefined;
              return (
                <Card key={item.id} className="ring-foreground/8">
                  <CardContent className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="capitalize">
                          {item.type}
                        </Badge>
                        {skill ? <Badge variant="outline">{skill.name}</Badge> : null}
                        {goal ? <Badge variant="outline">{goal.title}</Badge> : null}
                      </div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.effort}</p>
                    </div>
                    {item.state === "suggested" ? (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label="Accept into plan"
                          onClick={() => acceptLearningItem(item.id)}
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Dismiss"
                          onClick={() => dismissLearningItem(item.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground capitalize">{item.state}</span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
