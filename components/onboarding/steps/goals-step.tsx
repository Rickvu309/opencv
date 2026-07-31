"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingData } from "@/components/onboarding/onboarding-data";
import { SUGGESTED_GOALS, createCustomGoal } from "@/components/onboarding/onboarding-data";
import { cn } from "@/lib/utils";

export interface GoalsStepProps {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
}

const MAX_GOALS = 4;
const MIN_GOALS = 2;

export function GoalsStep({ data, onChange }: GoalsStepProps) {
  const [goalDraft, setGoalDraft] = useState("");
  const totalSelected = data.selectedGoalIds.length + data.customGoals.length;
  const atMax = totalSelected >= MAX_GOALS;

  function toggleGoal(id: string) {
    if (data.selectedGoalIds.includes(id)) {
      onChange({ selectedGoalIds: data.selectedGoalIds.filter((goalId) => goalId !== id) });
    } else if (!atMax) {
      onChange({ selectedGoalIds: [...data.selectedGoalIds, id] });
    }
  }

  function addCustomGoal() {
    const trimmed = goalDraft.trim();
    if (!trimmed || atMax) return;
    onChange({ customGoals: [...data.customGoals, createCustomGoal(trimmed, data.targetDirectionLabel)] });
    setGoalDraft("");
  }

  function removeCustomGoal(id: string) {
    onChange({ customGoals: data.customGoals.filter((goal) => goal.id !== id) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1>Goals</h1>
          <p className="text-sm text-muted-foreground">Pick or write 2 to 4 goals to start tracking.</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{totalSelected} of {MAX_GOALS} selected</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SUGGESTED_GOALS.map((goal) => {
          const selected = data.selectedGoalIds.includes(goal.id);
          const disabled = !selected && atMax;
          return (
            <button
              key={goal.id}
              type="button"
              disabled={disabled}
              onClick={() => toggleGoal(goal.id)}
              aria-pressed={selected}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-accent/50"
                  : "border-border bg-muted/30 hover:bg-muted/60",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{goal.title}</p>
                {selected ? (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{goal.why}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Write your own</Label>
        <div className="flex gap-1.5">
          <Input
            placeholder="For example, Lead a design team of 3 or more"
            value={goalDraft}
            disabled={atMax}
            onChange={(event) => setGoalDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomGoal();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" aria-label="Add goal" disabled={atMax} onClick={addCustomGoal}>
            <Plus className="size-4" />
          </Button>
        </div>
        {data.customGoals.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {data.customGoals.map((goal) => (
              <span
                key={goal.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {goal.title}
                <button type="button" aria-label={`Remove ${goal.title}`} onClick={() => removeCustomGoal(goal.id)}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {totalSelected < MIN_GOALS ? (
        <p className="text-xs text-muted-foreground">Choose at least {MIN_GOALS} to continue.</p>
      ) : null}
    </div>
  );
}
