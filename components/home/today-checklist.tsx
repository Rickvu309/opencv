"use client";

import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Miller's Law, matching the decision queue's own 3-item cap one register up: a tight checklist reads at a glance, a longer one belongs on the full list. */
const TODAY_LIMIT = 5;

/**
 * Home's "Today" module (RDS-993): every accepted next action as one tight
 * checklist row, verb phrase plus object, a checkbox, and a due hint as
 * quiet meta, nothing else. The rationale that justified accepting the
 * action already did its job on the opportunity's own Actions tab; this
 * list is for doing, not re-arguing. Replaces the old NextActionsCard's
 * one-Card-per-action layout and its always-visible rationale line.
 */
export function TodayChecklist() {
  const { state, markNextActionDone } = useStore();
  const acceptedActions = state.nextActions.filter((action) => action.state === "accepted");
  const visible = acceptedActions.slice(0, TODAY_LIMIT);
  const overflowCount = acceptedActions.length - visible.length;

  return (
    <section className="flex flex-col gap-3">
      <h2>Today</h2>
      {visible.length === 0 ? (
        <EmptyState message="Nothing accepted yet. Accept a recommended next action from an opportunity to see it here." />
      ) : (
        <Card className="ring-foreground/8 py-0">
          <CardContent className="flex flex-col gap-0 px-0">
            {visible.map((action, index) => {
              const opportunity = state.opportunities.find((item) => item.id === action.opportunityId);
              return (
                <div
                  key={action.id}
                  className={cn("flex items-center gap-3 px-4 py-2.5", index > 0 && "border-t border-border")}
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={(checked) => checked === true && markNextActionDone(action.id)}
                    aria-label={`Mark done: ${action.verb}`}
                  />
                  <Link
                    href={opportunity ? `/opportunities/${opportunity.id}#actions` : "/opportunities"}
                    className="flex min-w-0 flex-1 items-center gap-2 text-sm hover:underline"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      <span className="font-medium">{action.verb}</span>
                      {opportunity ? <span className="text-muted-foreground"> · {opportunity.role}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{action.dueHint}</span>
                  </Link>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {overflowCount > 0 ? (
        <Link
          href="/opportunities"
          className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          +{overflowCount} more in Opportunities
        </Link>
      ) : null}
    </section>
  );
}
