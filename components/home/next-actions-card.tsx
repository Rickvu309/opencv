"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";

/**
 * Ticket 08's Next actions card, unchanged in behavior: every accepted next
 * action across all opportunities, mark done or dismiss inline, each row
 * deep-linking back to its opportunity's Actions tab.
 */
export function NextActionsCard() {
  const { state, markNextActionDone, dismissNextAction } = useStore();
  const acceptedActions = state.nextActions.filter((action) => action.state === "accepted");

  return (
    <section className="flex flex-col gap-3">
      <h2>Next actions</h2>
      {acceptedActions.length === 0 ? (
        <EmptyState message="Nothing accepted yet. Accept a recommended next action from an opportunity to see it here." />
      ) : (
        <div className="flex flex-col gap-2">
          {acceptedActions.map((action) => {
            const opportunity = state.opportunities.find((item) => item.id === action.opportunityId);
            return (
              <Card key={action.id} className="ring-foreground/8 py-0">
                <CardContent className="flex items-start gap-3 py-2.5">
                  <Checkbox
                    checked={false}
                    onCheckedChange={(checked) => checked === true && markNextActionDone(action.id)}
                    aria-label="Mark done"
                    className="mt-1"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-sm text-foreground">
                      <span className="font-medium">{action.verb}</span>
                      <span className="text-muted-foreground"> · {action.effort} · {action.dueHint}</span>
                    </p>
                    <Link
                      href={opportunity ? `/opportunities/${opportunity.id}#actions` : "/opportunities"}
                      className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {opportunity ? `${opportunity.role} · ${opportunity.company}` : "Opportunity"}
                      {" — "}
                      {action.rationale}
                    </Link>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Dismiss"
                    onClick={() => dismissNextAction(action.id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
