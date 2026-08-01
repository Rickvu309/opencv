"use client";

import { DashboardPage } from "@/components/shell/dashboard-page";
import { PipelineHealthBand } from "@/components/strategy/pipeline-health-band";
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
    </DashboardPage>
  );
}
