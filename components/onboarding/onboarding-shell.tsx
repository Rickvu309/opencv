"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface OnboardingShellProps {
  stepIndex: number;
  stepCount: number;
  direction: 1 | -1;
  onBack?: () => void;
  onSkip?: () => void;
  primaryLabel: string;
  primaryIcon?: ReactNode;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  children: ReactNode;
}

/**
 * Chrome shared by every onboarding step: progress, back and skip
 * navigation, and a slide/fade transition between step contents. Step
 * components stay focused on their own fields and validation.
 */
export function OnboardingShell({
  stepIndex,
  stepCount,
  direction,
  onBack,
  onSkip,
  primaryLabel,
  primaryIcon,
  onPrimary,
  primaryDisabled,
  children,
}: OnboardingShellProps) {
  const progressValue = ((stepIndex + 1) / stepCount) * 100;

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-6 py-8">
      <div className="flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                OP
              </span>
              <span className="text-sm font-semibold text-foreground">OpenPath setup</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Step {stepIndex + 1} of {stepCount}
              </span>
              {onSkip ? (
                <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
                  Skip for now
                </Button>
              ) : null}
            </div>
          </div>
          <Progress value={progressValue} />
        </div>

        <div
          key={stepIndex}
          className={cn(
            "flex min-h-[420px] flex-col justify-center animate-in fade-in-0 duration-300",
            direction === 1 ? "slide-in-from-right-4" : "slide-in-from-left-4"
          )}
        >
          {children}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {onBack ? (
            <Button variant="ghost" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={onPrimary} disabled={primaryDisabled} className="gap-1.5">
            {primaryIcon}
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
