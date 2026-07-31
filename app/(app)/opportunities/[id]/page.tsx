"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, Star, X } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { FitChip } from "@/components/shared/fit-chip";
import { PriorityChip } from "@/components/shared/priority-chip";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { CredibilityInsight, FitInsight, SummaryInsight, TailoringInsight } from "@/lib/types";

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const {
    state,
    toggleDream,
    acceptNextAction,
    dismissNextAction,
    markNextActionDone,
    acceptTailoringSuggestion,
    dismissTailoringSuggestion,
  } = useStore();

  const opportunity = state.opportunities.find((item) => item.id === params.id);

  useCopilotSurface(
    "Opportunity Detail",
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
  const credibility = insights.find((insight): insight is CredibilityInsight => insight.kind === "credibility");
  const fit = insights.find((insight): insight is FitInsight => insight.kind === "fit");
  const tailoring = insights.find((insight): insight is TailoringInsight => insight.kind === "tailoring");

  const actions = state.nextActions.filter((action) => action.opportunityId === opportunity.id);
  const cvVersion = opportunity.cvVersionId
    ? state.cvVersions.find((cv) => cv.id === opportunity.cvVersionId)
    : undefined;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={opportunity.role}
        description={`${opportunity.company} · ${opportunity.location}`}
        primaryAction={
          <Button
            size="sm"
            variant={opportunity.isDream ? "secondary" : "outline"}
            onClick={() => toggleDream(opportunity.id)}
          >
            <Star className={opportunity.isDream ? "size-4 fill-current" : "size-4"} />
            {opportunity.isDream ? "Dream" : "Flag as Dream"}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip status={opportunity.status} />
          <FitChip fit={opportunity.fit} />
          <PriorityChip priority={opportunity.priority} />
          {opportunity.hasCredibilityFlag ? <Badge variant="destructive">Credibility flag</Badge> : null}
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-3 pt-4">
            <Card>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-foreground">{opportunity.description}</p>
                <Separator />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Salary range" value={opportunity.salaryRange} />
                  <Field label="Source" value={opportunity.source} />
                  <Field label="Saved" value={opportunity.savedAt} />
                  <Field label="Last activity" value={opportunity.lastActivityAt} />
                </dl>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-analysis" className="flex flex-col gap-3 pt-4">
            {summary ? (
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Summary</span>
                    <CopilotTag />
                  </div>
                  <p className="text-sm text-foreground">{summary.body}</p>
                </CardContent>
              </Card>
            ) : null}

            {credibility ? (
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Credibility check</span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        className={
                          credibility.verdict === "pass"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        }
                      >
                        {credibility.verdict === "pass" ? "Passes checks" : "Fails checks"}
                      </Badge>
                      <ConfidenceChip confidence={credibility.confidence} />
                      <CopilotTag />
                    </div>
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {credibility.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {fit ? (
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Fit judgment</span>
                    <div className="flex items-center gap-1.5">
                      <FitChip fit={fit.level} />
                      <ConfidenceChip confidence={fit.confidence} />
                      <CopilotTag />
                    </div>
                  </div>
                  <FitSection label="Strengths" items={fit.strengths} />
                  <FitSection label="Concerns" items={fit.concerns} />
                  <FitSection label="Unknowns" items={fit.unknowns} />
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="actions" className="flex flex-col gap-2 pt-4">
            {actions.length === 0 ? (
              <EmptyState message="Copilot hasn't suggested a next action for this opportunity yet." />
            ) : (
              actions.map((action) => (
                <Card key={action.id}>
                  <CardContent className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <CopilotTag />
                        <span className="text-xs text-muted-foreground capitalize">{action.state}</span>
                      </div>
                      <p className="text-sm text-foreground">{action.verb}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.rationale} · {action.effort} · {action.dueHint}
                      </p>
                    </div>
                    {action.state === "suggested" ? (
                      <div className="flex shrink-0 gap-1.5">
                        <Button size="icon-sm" variant="outline" aria-label="Accept" onClick={() => acceptNextAction(action.id)}>
                          <Check className="size-3.5" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => dismissNextAction(action.id)}>
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : action.state === "accepted" ? (
                      <Button size="sm" variant="outline" onClick={() => markNextActionDone(action.id)}>
                        Mark done
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="materials" className="flex flex-col gap-3 pt-4">
            {cvVersion ? (
              <Card>
                <CardContent className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{cvVersion.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {cvVersion.kind === "tailored" ? "Tailored version" : "Base version"} · last edited{" "}
                      {cvVersion.lastEditedAt}
                    </span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/cvs/${cvVersion.id}`}>Open CV</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                message="No CV version linked yet. Link one from CV Versions to tailor it for this role."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/cvs">Go to CV Versions</Link>
                  </Button>
                }
              />
            )}

            {tailoring ? (
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Tailoring suggestions</span>
                    <div className="flex items-center gap-1.5">
                      <ConfidenceChip confidence={tailoring.confidence} />
                      <CopilotTag />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {tailoring.suggestions.map((suggestion) => (
                      <div key={suggestion.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-muted-foreground">{suggestion.section}</span>
                          <p
                            className={
                              suggestion.state === "dismissed"
                                ? "text-sm text-muted-foreground line-through"
                                : "text-sm text-foreground"
                            }
                          >
                            {suggestion.suggestion}
                          </p>
                        </div>
                        {suggestion.state === "suggested" ? (
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label="Accept suggestion"
                              onClick={() => acceptTailoringSuggestion(tailoring.id, suggestion.id)}
                            >
                              <Check className="size-3.5" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Dismiss suggestion"
                              onClick={() => dismissTailoringSuggestion(tailoring.id, suggestion.id)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground capitalize">{suggestion.state}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="activity" className="flex flex-col gap-2 pt-4">
            <Card>
              <CardContent className="flex flex-col gap-3 text-sm">
                <ActivityRow date={opportunity.savedAt} label={`Saved as ${opportunity.status === "Saved" ? "Saved" : "an opportunity"}`} />
                {opportunity.status !== "Saved" ? (
                  <ActivityRow date={opportunity.lastActivityAt} label={`Status moved to ${opportunity.status}`} />
                ) : null}
                {opportunity.isDream ? <ActivityRow date={opportunity.lastActivityAt} label="Flagged as a Dream opportunity" /> : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function FitSection({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ActivityRow({ date, label }: { date: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{date}</span>
      <span className="text-foreground">{label}</span>
    </div>
  );
}
