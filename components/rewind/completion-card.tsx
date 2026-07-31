import { PartyPopper, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { savedAchievementCount, acceptedCarryForwardCount } from "@/lib/rewind-utils";
import type { RewindCandidate, RewindCarryForward } from "@/lib/types";

interface CompletionCardProps {
  weekLabel: string;
  candidates: RewindCandidate[];
  carryForwards: RewindCarryForward[];
  viewed: boolean;
  weeksReviewedBeforeThis: number;
}

/**
 * Rewind's end state (Peak-End): once you've made at least one decision this
 * session, a calm, satisfying summary of exactly what happened, plus a quiet
 * continuity marker. Before that, a lighter prompt nudging toward the work
 * above rather than a premature celebration.
 */
export function CompletionCard({
  weekLabel,
  candidates,
  carryForwards,
  viewed,
  weeksReviewedBeforeThis,
}: CompletionCardProps) {
  if (!viewed) {
    return (
      <Card className="ring-foreground/8 bg-muted/20">
        <CardContent className="flex items-center gap-3">
          <Sparkles className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Review what&rsquo;s above to close out this week: save or set aside each candidate, then decide what
            carries forward.
          </p>
        </CardContent>
      </Card>
    );
  }

  const savedCount = savedAchievementCount(candidates);
  const followUpsQueued = acceptedCarryForwardCount(carryForwards);
  const weeksReviewed = weeksReviewedBeforeThis + 1;

  return (
    <Card className="ring-foreground/8 bg-indigo-50/40 dark:bg-indigo-500/5">
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <PartyPopper className="size-6 text-muted-foreground" />
        <p className="font-medium text-foreground">
          {weekLabel} saved, {savedCount} {savedCount === 1 ? "achievement" : "achievements"} kept, {followUpsQueued}{" "}
          {followUpsQueued === 1 ? "follow-up" : "follow-ups"} queued.
        </p>
        <p className="text-xs text-muted-foreground">
          {weeksReviewed} {weeksReviewed === 1 ? "week" : "weeks"} reviewed.
        </p>
      </CardContent>
    </Card>
  );
}
