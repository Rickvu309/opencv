"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { getFocusItems } from "@/lib/opportunity-utils";
import { today, useStore } from "@/lib/store";

/**
 * Workspace-level Copilot cue: up to 3 opportunities worth looking at now,
 * each with a one-line reason. Quiet by design, dismissable for the
 * session, and renders nothing when there is nothing worth flagging.
 */
export function OpportunitiesFocusStrip() {
  const { state } = useStore();
  const [dismissed, setDismissed] = useState(false);

  const items = getFocusItems(state.opportunities, state.nextActions, state.nudges, today());

  if (dismissed || items.length === 0) return null;

  return (
    <Card className="ring-foreground/8 bg-indigo-50/40 dark:bg-indigo-500/5">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground">Focus</span>
            <CopilotTag />
          </div>
          <div className="flex flex-col gap-1.5">
            {items.map((item) => {
              const opportunity = state.opportunities.find((entry) => entry.id === item.opportunityId);
              if (!opportunity) return null;
              return (
                <Link
                  key={item.opportunityId}
                  href={`/opportunities/${item.opportunityId}`}
                  className="block truncate rounded-md px-1 py-0.5 text-sm hover:bg-indigo-100/60 dark:hover:bg-indigo-500/10"
                >
                  <span className="font-medium text-foreground">
                    {opportunity.role} · {opportunity.company}
                  </span>{" "}
                  <span className="text-muted-foreground">{item.reason}</span>
                </Link>
              );
            })}
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss Focus strip"
          onClick={() => setDismissed(true)}
        >
          <X className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
