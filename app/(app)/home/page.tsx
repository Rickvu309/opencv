"use client";

import { Plus } from "lucide-react";

import { DashboardPage } from "@/components/shell/dashboard-page";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { AttentionQueue } from "@/components/home/attention-queue";
import { GreetingBand } from "@/components/home/greeting-band";
import { NextActionsCard } from "@/components/home/next-actions-card";
import { StatTiles } from "@/components/home/stat-tiles";
import { WeeklyReviewBanner } from "@/components/home/weekly-review-banner";
import { Button } from "@/components/ui/button";
import { getAttentionQueue } from "@/lib/nudge-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function HomePage() {
  useCopilotSurface("Home");
  const { state } = useStore();

  const needsDecisionCount =
    state.aiSignals.filter((signal) => signal.state === "proposed").length +
    getAttentionQueue(state.nudges).length;

  return (
    <DashboardPage
      title="Home"
      primaryAction={
        <AddOpportunityDialog>
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            Add opportunity
          </Button>
        </AddOpportunityDialog>
      }
    >
      <GreetingBand profile={state.profile} />

      <StatTiles opportunities={state.opportunities} needsDecisionCount={needsDecisionCount} />

      <WeeklyReviewBanner />

      <AttentionQueue />

      <NextActionsCard />
    </DashboardPage>
  );
}
