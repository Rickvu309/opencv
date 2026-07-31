"use client";

import { useEffect, useState } from "react";

import { AiThinking } from "@/components/shared/ai-thinking";
import { CopilotTag } from "@/components/shared/copilot-tag";
import type { OnboardingData } from "@/components/onboarding/onboarding-data";
import { SUGGESTED_GOALS } from "@/components/onboarding/onboarding-data";

export interface CopilotStepProps {
  data: OnboardingData;
  onReady: () => void;
}

/**
 * The expectation-setting moment: Copilot "prepares the workspace" with a
 * brief simulated thinking state, then surfaces 3 lines that reference the
 * exact inputs just given, so the trust boundary reads as concrete from
 * the very first use rather than a lecture page.
 */
export function CopilotStep({ data, onReady }: CopilotStepProps) {
  const [thinking, setThinking] = useState(true);

  useEffect(() => {
    const delay = 700 + Math.random() * 500;
    const timeout = setTimeout(() => {
      setThinking(false);
      onReady();
    }, delay);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goalTitles = [
    ...SUGGESTED_GOALS.filter((goal) => data.selectedGoalIds.includes(goal.id)).map((goal) => goal.title),
    ...data.customGoals.map((goal) => goal.title),
  ];

  const direction = data.targetDirectionLabel || "your target direction";
  const priority = data.nearTermPriority || "your near-term priority";
  const firstGoal = goalTitles[0] ?? "your first goal";

  const lines = [
    `You're aiming at ${direction}, so I will judge every opportunity against that direction first.`,
    `Your near-term priority is to ${priority.charAt(0).toLowerCase()}${priority.slice(1)}, so nudges and next actions will follow that pace.`,
    `You picked ${goalTitles.length} starting goal${goalTitles.length === 1 ? "" : "s"}, including "${firstGoal}", so I will track progress and flag skill gaps against them.`,
  ];

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex items-center gap-2">
        <CopilotTag />
        <h1>Preparing your workspace</h1>
      </div>

      {thinking ? (
        <AiThinking label="Reading your setup" className="justify-center" />
      ) : (
        <div className="flex w-full max-w-md flex-col gap-2.5 text-left">
          {lines.map((line) => (
            <p
              key={line}
              className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground duration-300"
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
