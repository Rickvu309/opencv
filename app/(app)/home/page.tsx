"use client";

import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { AttentionQueue } from "@/components/home/attention-queue";
import { GreetingBand } from "@/components/home/greeting-band";
import { NextActionsCard } from "@/components/home/next-actions-card";
import { PipelineSnapshot } from "@/components/home/pipeline-snapshot";
import { WeeklyReviewBanner } from "@/components/home/weekly-review-banner";
import { Button } from "@/components/ui/button";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function HomePage() {
  useCopilotSurface("Home");
  const { state } = useStore();

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Home"
        primaryAction={
          <AddOpportunityDialog>
            <Button size="sm" variant="outline">
              <Plus className="size-4" />
              Add opportunity
            </Button>
          </AddOpportunityDialog>
        }
      />

      <div className="flex flex-col gap-8 p-6">
        <GreetingBand profile={state.profile} opportunities={state.opportunities} />

        <WeeklyReviewBanner />

        <AttentionQueue />

        <div className="grid grid-cols-2 gap-6">
          <NextActionsCard />
          <PipelineSnapshot opportunities={state.opportunities} />
        </div>
      </div>
    </div>
  );
}
