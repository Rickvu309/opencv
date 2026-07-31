import Link from "next/link";
import { Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { MAX_COMPARISON, MIN_COMPARISON } from "@/lib/comparison-utils";

export type ComparisonRecoverReason = "invalid" | "empty";

const MESSAGE: Record<ComparisonRecoverReason, string> = {
  invalid: `That comparison link isn't valid. Pick ${MIN_COMPARISON} to ${MAX_COMPARISON} opportunities from your workspace and compare again.`,
  empty: `Nothing to compare yet. Pick ${MIN_COMPARISON} to ${MAX_COMPARISON} opportunities from your workspace to start a comparison.`,
};

/**
 * The designed recover state for /opportunities/compare: a bad or missing
 * `ids` query, and no valid last comparison to fall back to. Sends the user
 * straight back into selection mode rather than a dead end.
 */
export function ComparisonRecoverState({ reason }: { reason: ComparisonRecoverReason }) {
  return (
    <EmptyState
      icon={<Scale className="size-6 text-muted-foreground" />}
      message={MESSAGE[reason]}
      action={
        <Button asChild size="sm">
          <Link href="/opportunities?compare=1">Back to Opportunities</Link>
        </Button>
      }
      className="py-16"
    />
  );
}
