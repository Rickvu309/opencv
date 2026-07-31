"use client";

import { CalendarCheck } from "lucide-react";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";

/**
 * Home's prompt into Weekly Review, shown only while it hasn't been viewed
 * this session. Disappears on its own once the review is completed, since
 * that's what marks it viewed.
 */
export function WeeklyReviewBanner() {
  const { state, openWeeklyReview } = useStore();

  if (state.weeklyReviewViewedThisSession) return null;

  return (
    <Card className="ring-foreground/8 bg-indigo-50/40 dark:bg-indigo-500/5">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CalendarCheck className="size-3.5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-foreground">Your Weekly Review is ready</p>
              <CopilotTag />
            </div>
            <p className="text-xs text-muted-foreground">
              What moved, what Copilot noticed, and where to focus next.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openWeeklyReview}>
          Open Weekly Review
        </Button>
      </CardContent>
    </Card>
  );
}
