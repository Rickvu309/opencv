import type { ReactNode } from "react";
import { Compass, History, ListChecks } from "lucide-react";

const VALUE_POINTS: Array<{ icon: ReactNode; title: string; detail: string }> = [
  {
    icon: <Compass className="size-4" />,
    title: "Understand opportunities",
    detail: "Copilot reads every saved role for fit and credibility before you spend time on it.",
  },
  {
    icon: <ListChecks className="size-4" />,
    title: "Decide next steps",
    detail: "Every opportunity comes with a suggested next action and the reasoning behind it.",
  },
  {
    icon: <History className="size-4" />,
    title: "Build career memory",
    detail: "Your track record, goals, and skills persist beyond any single application.",
  },
];

export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
        OP
      </span>
      <div className="flex flex-col gap-1.5">
        <h1>Welcome to OpenPath</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          OpenPath is an AI-native career workspace for Mai. Copilot participates in the work itself, drafting
          and suggesting at every step, while Mai always decides what happens next.
        </p>
      </div>
      <div className="grid w-full grid-cols-3 gap-3 text-left">
        {VALUE_POINTS.map((point) => (
          <div key={point.title} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
              {point.icon}
            </span>
            <p className="text-sm font-medium text-foreground">{point.title}</p>
            <p className="text-xs text-muted-foreground">{point.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
