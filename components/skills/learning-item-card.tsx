"use client";

import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LinkChip } from "@/components/shared/link-chip";
import { useStore } from "@/lib/store";
import type { Goal, LearningItem } from "@/lib/types";

const STATE_LABELS: Record<LearningItem["state"], string> = {
  suggested: "Suggested",
  planned: "In your plan",
  dismissed: "Dismissed",
};

interface LearningItemCardProps {
  item: LearningItem;
  goal?: Goal;
}

/**
 * One learning item card: type badge, effort, the expected-benefit line, the
 * linked goal chip, and a "Start here" marker on the one recommended first
 * step. Suggested items get accept/dismiss, everything else shows its state.
 */
export function LearningItemCard({ item, goal }: LearningItemCardProps) {
  const { acceptLearningItem, dismissLearningItem, setGoalHighlight } = useStore();

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {item.type}
            </Badge>
            {item.startHereReason ? <Badge variant="secondary">Start here</Badge> : null}
            {goal ? (
              <LinkChip href="/goals" onClick={() => setGoalHighlight(goal.id)}>
                {goal.title}
              </LinkChip>
            ) : null}
          </div>
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.effort}</p>
          <p className="text-xs text-foreground">{item.expectedBenefit}</p>
          {item.startHereReason ? (
            <p className="text-xs text-muted-foreground italic">{item.startHereReason}</p>
          ) : null}
        </div>
        {item.state === "suggested" ? (
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Add to plan"
              onClick={() => acceptLearningItem(item.id)}
            >
              <Check className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Not now"
              onClick={() => dismissLearningItem(item.id)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">{STATE_LABELS[item.state]}</span>
        )}
      </CardContent>
    </Card>
  );
}
