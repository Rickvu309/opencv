"use client";

import { DashboardPage } from "@/components/shell/dashboard-page";
import { KeyObservations } from "@/components/strategy/key-observations";
import { PipelineHealthBand } from "@/components/strategy/pipeline-health-band";
import { SegmentStrip } from "@/components/strategy/segment-strip";
import { WeeklyFocusPlan } from "@/components/strategy/weekly-focus-plan";
import { today, useCopilotSurface, useStore } from "@/lib/store";

/**
 * Strategy (RDS-986): the coaching surface. Strategic clarity that changes
 * behavior, not another analytics page, per docs/design.md. Reads live off
 * Opportunity, NextAction, ActivityMoment, and Goal state through
 * lib/strategy-utils.ts.
 */
export default function StrategyPage() {
  useCopilotSurface("Strategy");
  const { state } = useStore();
  const todayIso = today();

  return (
    <DashboardPage
      title="Strategy"
      description="Strategic clarity that changes what you do this week, not another dashboard."
    >
      <PipelineHealthBand opportunities={state.opportunities} nextActions={state.nextActions} todayIso={todayIso} />

      <KeyObservations opportunities={state.opportunities} todayIso={todayIso} />

      <WeeklyFocusPlan
        opportunities={state.opportunities}
        nextActions={state.nextActions}
        goals={state.goals}
        todayIso={todayIso}
      />

      <SegmentStrip opportunities={state.opportunities} nextActions={state.nextActions} todayIso={todayIso} />
    </DashboardPage>
  );
}
