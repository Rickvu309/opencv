"use client";

import { Plus } from "lucide-react";

import { DashboardPage } from "@/components/shell/dashboard-page";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { DecisionQueue } from "@/components/home/decision-queue";
import { EntryTilesRow } from "@/components/home/entry-tiles-row";
import { GreetingBand } from "@/components/home/greeting-band";
import { StatTiles } from "@/components/home/stat-tiles";
import { TodayChecklist } from "@/components/home/today-checklist";
import { WhatChangedDigest } from "@/components/home/what-changed-digest";
import { Button } from "@/components/ui/button";
import { buildDecisionQueue } from "@/lib/home-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

/**
 * Home, the command center (RDS-993): the situation at a glance, what needs
 * a decision now, today's actions, one what-changed digest, then entry
 * tiles into the weekly-cadence surfaces. See docs/architecture.md
 * section 10 for the information architecture decision this redesign
 * follows, and docs/lessons.md for the UX-law review behind it.
 */
export default function HomePage() {
  useCopilotSurface("Home");
  const { state } = useStore();

  const { items: decisionItems, overflowCount: decisionOverflow } = buildDecisionQueue(
    state.aiSignals,
    state.nudges
  );
  const needsDecisionCount = decisionItems.length + decisionOverflow;

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

      <DecisionQueue />

      <TodayChecklist />

      <WhatChangedDigest />

      <EntryTilesRow />
    </DashboardPage>
  );
}
