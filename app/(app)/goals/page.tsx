"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DirectionBand } from "@/components/goals/direction-band";
import { GapAnalysisSection } from "@/components/goals/gap-analysis-section";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { PathScenarioCard } from "@/components/goals/path-scenario-card";
import { computeDirectionAlignment } from "@/lib/opportunity-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

const GOAL_HIGHLIGHT_DURATION_MS = 2500;

export default function GoalsPage() {
  useCopilotSurface("Goals");
  const { state, clearGoalHighlight } = useStore();

  const highlightedId = state.highlightedGoalId;

  useEffect(() => {
    if (!highlightedId) return;
    const timeout = setTimeout(() => clearGoalHighlight(highlightedId), GOAL_HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [highlightedId, clearGoalHighlight]);

  const alignment = computeDirectionAlignment(state.opportunities);
  const nearTermGoals = state.goals.filter((goal) => goal.horizon === "near term");
  const longTermGoals = state.goals.filter((goal) => goal.horizon === "long term");

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Goals"
        description={`${state.goals.length} active goals toward your target direction.`}
      />

      <DirectionBand profile={state.profile} alignment={alignment} />

      <div className="flex flex-col gap-8 p-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2>Active goals</h2>
            <GoalFormDialog>
              <Button size="sm">
                <Plus className="size-4" />
                Add goal
              </Button>
            </GoalFormDialog>
          </div>

          {state.goals.length === 0 ? (
            <EmptyState
              message="No goals yet. Add one to start tracking progress toward your target direction."
              action={
                <GoalFormDialog>
                  <Button size="sm">
                    <Plus className="size-4" />
                    Add goal
                  </Button>
                </GoalFormDialog>
              }
            />
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-muted-foreground">Near term</h3>
                {nearTermGoals.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {nearTermGoals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        opportunities={state.opportunities}
                        learningItems={state.learningItems}
                        highlighted={goal.id === highlightedId}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No near-term goals right now.</p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-muted-foreground">Long term</h3>
                {longTermGoals.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {longTermGoals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        opportunities={state.opportunities}
                        learningItems={state.learningItems}
                        highlighted={goal.id === highlightedId}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No long-term goals right now.</p>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2>Where this can go</h2>
            <CopilotTag />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {state.pathScenarios.map((scenario) => (
              <PathScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </section>

        <section>
          <GapAnalysisSection
            gapAnalysis={state.directionGapAnalysis}
            skills={state.skills}
            learningItems={state.learningItems}
          />
        </section>
      </div>
    </div>
  );
}
