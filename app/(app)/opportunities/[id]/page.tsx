"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpportunitySummaryBand } from "@/components/opportunities/opportunity-summary-band";
import { OpportunityOverviewTab } from "@/components/opportunities/opportunity-overview-tab";
import { OpportunityAiAnalysisTab } from "@/components/opportunities/opportunity-ai-analysis-tab";
import { OpportunityActionsTab } from "@/components/opportunities/opportunity-actions-tab";
import { OpportunityMaterialsTab } from "@/components/opportunities/opportunity-materials-tab";
import { OpportunityActivityTab } from "@/components/opportunities/opportunity-activity-tab";
import { findOpportunityActivity, findPrimaryNextAction } from "@/lib/opportunity-utils";
import { resolveOpportunitySurface } from "@/lib/copilot-utils";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { CredibilityInsight, FitInsight, InterpretationInsight, SummaryInsight } from "@/lib/types";

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const { state } = useStore();
  const [activeTab, setActiveTab] = useState("overview");

  const opportunity = state.opportunities.find((item) => item.id === params.id);

  const TAB_VALUES = ["overview", "ai-analysis", "actions", "materials", "activity"];
  useEffect(() => {
    function syncTabFromHash() {
      const hash = window.location.hash.replace("#", "");
      if (TAB_VALUES.includes(hash)) {
        setActiveTab(hash);
      }
    }
    // A link into a specific tab (for example Home's Next actions card, or a
    // Copilot handoff) sets the location hash. Synced on mount and again on
    // every hash change, so a handoff clicked while already on this exact
    // opportunity still switches tabs, not just a fresh navigation here.
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useCopilotSurface(
    opportunity ? resolveOpportunitySurface(opportunity.company) : "Opportunity Detail",
    opportunity ? `${opportunity.role} at ${opportunity.company}` : undefined
  );

  if (!opportunity) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Opportunity not found" />
        <div className="p-6">
          <EmptyState
            message="This opportunity doesn't exist, or was removed."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/opportunities">Back to Opportunities</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const insights = state.insights.filter(
    (insight) => insight.hostType === "opportunity" && insight.hostId === opportunity.id
  );
  const summary = insights.find((insight): insight is SummaryInsight => insight.kind === "summary");
  const interpretation = insights.find(
    (insight): insight is InterpretationInsight => insight.kind === "interpretation"
  );
  const credibility = insights.find(
    (insight): insight is CredibilityInsight => insight.kind === "credibility"
  );
  const fit = insights.find((insight): insight is FitInsight => insight.kind === "fit");

  const actions = state.nextActions.filter((action) => action.opportunityId === opportunity.id);
  const primaryNextAction = findPrimaryNextAction(opportunity.id, state.nextActions);
  const cvVersion = opportunity.cvVersionId
    ? state.cvVersions.find((cv) => cv.id === opportunity.cvVersionId)
    : undefined;
  const relatedGoals = state.goals.filter((goal) => opportunity.goalIds?.includes(goal.id));
  const activity = findOpportunityActivity(opportunity.id, state.activityMoments);

  return (
    <div className="flex flex-col">
      <PageHeader title={opportunity.role} description={`${opportunity.company} · ${opportunity.location}`} />

      <div className="flex flex-col gap-4 p-6">
        <OpportunitySummaryBand opportunity={opportunity} primaryNextAction={primaryNextAction} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <OpportunityOverviewTab
              opportunity={opportunity}
              summary={summary}
              cvVersion={cvVersion}
              relatedGoals={relatedGoals}
            />
          </TabsContent>

          <TabsContent value="ai-analysis" className="pt-4">
            <OpportunityAiAnalysisTab
              opportunity={opportunity}
              interpretation={interpretation}
              credibility={credibility}
              fit={fit}
              onGoToActions={() => setActiveTab("actions")}
            />
          </TabsContent>

          <TabsContent value="actions" className="pt-4">
            <OpportunityActionsTab
              actions={actions}
              companyName={opportunity.company}
              objectLabel={`${opportunity.role} at ${opportunity.company}`}
              onGoToMaterials={() => setActiveTab("materials")}
            />
          </TabsContent>

          <TabsContent value="materials" className="pt-4">
            <OpportunityMaterialsTab opportunity={opportunity} cvVersion={cvVersion} />
          </TabsContent>

          <TabsContent value="activity" className="pt-4">
            <OpportunityActivityTab moments={activity} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
