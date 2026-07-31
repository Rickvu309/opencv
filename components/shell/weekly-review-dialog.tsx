"use client";

import { Check, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { useStore } from "@/lib/store";

export function WeeklyReviewDialog({ children }: { children: React.ReactNode }) {
  const { state, acceptWeeklyReviewSuggestion, dismissWeeklyReviewSuggestion } = useStore();
  const { weeklyReview } = state;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Weekly Review</DialogTitle>
            <CopilotTag />
          </div>
          <DialogDescription>What happened, what changed, and where to focus next.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-foreground">What happened</h3>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {weeklyReview.whatHappened.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <Separator />

          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-foreground">What changed</h3>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {weeklyReview.whatChanged.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Suggested focus</h3>
            <div className="flex flex-col gap-2">
              {weeklyReview.suggestedFocus.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <p
                    className={
                      suggestion.state === "dismissed"
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }
                  >
                    {suggestion.text}
                  </p>
                  {suggestion.state === "suggested" ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        aria-label="Accept suggestion"
                        onClick={() => acceptWeeklyReviewSuggestion(suggestion.id)}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Dismiss suggestion"
                        onClick={() => dismissWeeklyReviewSuggestion(suggestion.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground capitalize">{suggestion.state}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
