import { PartyPopper, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { STRATEGY_REVIEWS_BEFORE_THIS } from "@/lib/data/strategy";

interface StrategyPlanCompletionCardProps {
  totalMoves: number;
  approvedCount: number;
  decidedCount: number;
}

/**
 * The weekly focus plan's end state (Peak-End), the same shape Rewind's own
 * CompletionCard uses: a light prompt before any decision, then a calm
 * summary of exactly how many moves were made plus a quiet "weeks
 * reviewed" continuity marker once at least one move has been decided.
 */
export function StrategyPlanCompletionCard({
  totalMoves,
  approvedCount,
  decidedCount,
}: StrategyPlanCompletionCardProps) {
  if (decidedCount === 0) {
    return (
      <Card className="ring-foreground/8 bg-muted/20">
        <CardContent className="flex items-center gap-3">
          <Sparkles className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Approve, adjust, or set aside each move above to close out this week&rsquo;s plan.
          </p>
        </CardContent>
      </Card>
    );
  }

  const weeksReviewed = STRATEGY_REVIEWS_BEFORE_THIS + 1;

  return (
    <Card className="ring-foreground/8 bg-indigo-50/40 dark:bg-indigo-500/5">
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <PartyPopper className="size-6 text-muted-foreground" />
        <p className="font-medium text-foreground">
          {approvedCount} of {totalMoves} moves made this week.
        </p>
        <p className="text-xs text-muted-foreground">
          {weeksReviewed} {weeksReviewed === 1 ? "week" : "weeks"} reviewed.
        </p>
      </CardContent>
    </Card>
  );
}
