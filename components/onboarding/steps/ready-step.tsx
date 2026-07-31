import { Badge } from "@/components/ui/badge";
import type { OnboardingData } from "@/components/onboarding/onboarding-data";
import { SUGGESTED_GOALS } from "@/components/onboarding/onboarding-data";

export interface ReadyStepProps {
  data: OnboardingData;
}

export function ReadyStep({ data }: ReadyStepProps) {
  const goalTitles = [
    ...SUGGESTED_GOALS.filter((goal) => data.selectedGoalIds.includes(goal.id)).map((goal) => goal.title),
    ...data.customGoals.map((goal) => goal.title),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1>You&rsquo;re set</h1>
        <p className="text-sm text-muted-foreground">Here&rsquo;s what OpenPath now knows about you.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">About you</p>
          <p className="text-sm text-foreground">
            {data.currentRole || "Not set"} · {data.experienceLevel || "Not set"}
          </p>
          <p className="text-sm text-muted-foreground">{data.location || "Not set"}</p>
          {data.strengths.length > 0 ? (
            <ul className="flex flex-col gap-1 pt-1 text-xs text-muted-foreground">
              {data.strengths.map((strength) => (
                <li key={strength} className="truncate">
                  {strength}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Direction</p>
          <p className="text-sm text-foreground">{data.targetDirectionLabel || "Not set"}</p>
          <p className="text-sm text-muted-foreground">
            {data.workStyle || "Not set"} · {data.companySize || "Not set"}
          </p>
          <p className="text-xs text-muted-foreground">{data.nearTermPriority}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">Starting goals</p>
        <div className="flex flex-wrap gap-1.5">
          {goalTitles.map((title) => (
            <Badge key={title} variant="secondary">
              {title}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
