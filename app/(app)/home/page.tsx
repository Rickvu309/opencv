"use client";

import Link from "next/link";
import { AlarmClock, Flame, Inbox, Plus, X } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { NudgeTrigger } from "@/lib/types";

const NUDGE_LABELS: Record<NudgeTrigger, string> = {
  "stale-opportunity": "Stale opportunity",
  "capture-prompt": "Capture prompt",
  "high-potential": "High potential",
};

export default function HomePage() {
  useCopilotSurface("Home");
  const { state, dismissNudge, snoozeNudge, markNextActionDone, dismissNextAction } = useStore();

  const activeNudges = state.nudges.filter((nudge) => nudge.state === "active");
  const acceptedActions = state.nextActions.filter((action) => action.state === "accepted");

  const activePipeline = state.opportunities.filter((opportunity) => opportunity.status !== "Closed");
  const inInterview = state.opportunities.filter((opportunity) => opportunity.status === "Interview").length;
  const offers = state.opportunities.filter((opportunity) => opportunity.status === "Offer").length;
  const dreamOpportunities = state.opportunities.filter((opportunity) => opportunity.isDream).length;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`Good to see you, ${state.profile.name.split(" ")[0]}`}
        description={`Steering toward ${state.profile.targetDirectionLabel}. Here's where things stand across your search.`}
        primaryAction={
          <AddOpportunityDialog>
            <Button size="sm" variant="outline">
              <Plus className="size-4" />
              Add opportunity
            </Button>
          </AddOpportunityDialog>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Active pipeline" value={activePipeline.length} />
          <StatCard label="In interview" value={inInterview} />
          <StatCard label="Offers" value={offers} />
          <StatCard label="Dream opportunities" value={dreamOpportunities} />
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2>Nudges</h2>
            <CopilotTag />
          </div>
          {activeNudges.length === 0 ? (
            <EmptyState message="No nudges right now. Copilot will flag stale or high-potential opportunities here as they come up." />
          ) : (
            <div className="flex flex-col gap-2">
              {activeNudges.map((nudge) => (
                <Card key={nudge.id} className="ring-foreground/8">
                  <CardContent className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        {nudge.trigger === "high-potential" ? (
                          <Flame className="size-3.5" />
                        ) : nudge.trigger === "stale-opportunity" ? (
                          <AlarmClock className="size-3.5" />
                        ) : (
                          <Inbox className="size-3.5" />
                        )}
                      </span>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {NUDGE_LABELS[nudge.trigger]}
                        </span>
                        <p className="text-sm text-foreground">{nudge.message}</p>
                        <p className="text-sm text-muted-foreground">{nudge.suggestedAction}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {nudge.relatedOpportunityId ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/opportunities/${nudge.relatedOpportunityId}`}>Open</Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline">
                          <Link href="/track-record">Open</Link>
                        </Button>
                      )}
                      <Button size="icon-sm" variant="ghost" aria-label="Snooze" onClick={() => snoozeNudge(nudge.id)}>
                        <AlarmClock className="size-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => dismissNudge(nudge.id)}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>Next actions</h2>
          {acceptedActions.length === 0 ? (
            <EmptyState message="Nothing accepted yet. Accept a recommended next action from an opportunity to see it here." />
          ) : (
            <div className="flex flex-col gap-2">
              {acceptedActions.map((action) => {
                const opportunity = state.opportunities.find((item) => item.id === action.opportunityId);
                return (
                  <Card key={action.id} className="ring-foreground/8">
                    <CardContent className="flex items-start gap-3">
                      <Checkbox
                        checked={false}
                        onCheckedChange={(checked) => checked === true && markNextActionDone(action.id)}
                        aria-label="Mark done"
                        className="mt-1"
                      />
                      <div className="flex flex-1 flex-col gap-1">
                        <Link
                          href={opportunity ? `/opportunities/${opportunity.id}#actions` : "/opportunities"}
                          className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {opportunity ? `${opportunity.role} · ${opportunity.company}` : "Opportunity"}
                        </Link>
                        <p className="text-sm text-foreground">{action.verb}</p>
                        <p className="text-xs text-muted-foreground">
                          {action.rationale} · {action.effort} · {action.dueHint}
                        </p>
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
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
