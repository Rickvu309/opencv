"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Plus, Star } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip } from "@/components/shared/status-chip";
import { FitChip } from "@/components/shared/fit-chip";
import { PriorityChip } from "@/components/shared/priority-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { OpportunityStatus } from "@/lib/types";

const STATUS_OPTIONS: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];

export default function OpportunitiesPage() {
  useCopilotSurface("Opportunities");
  const { state, toggleDream, setOpportunityStatus, clearOpportunityHighlight } = useStore();
  const highlightedId = state.highlightedOpportunityId;

  useEffect(() => {
    if (!highlightedId) return;
    const timeout = setTimeout(() => clearOpportunityHighlight(highlightedId), 2500);
    return () => clearTimeout(timeout);
  }, [highlightedId, clearOpportunityHighlight]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Opportunities"
        description={`${state.opportunities.length} tracked, across every stage from saved to closed.`}
        primaryAction={
          <AddOpportunityDialog>
            <Button size="sm">
              <Plus className="size-4" />
              Add opportunity
            </Button>
          </AddOpportunityDialog>
        }
      />

      <div className="flex flex-col gap-3 p-6">
        {state.opportunities.length === 0 ? (
          <EmptyState message="No opportunities yet. Save one to start tracking it here." />
        ) : (
          state.opportunities.map((opportunity) => (
            <Card
              key={opportunity.id}
              className={cn(
                "ring-foreground/8 transition-colors duration-700",
                opportunity.id === highlightedId &&
                  "ring-2 ring-indigo-400 bg-indigo-50/50 dark:ring-indigo-500/60 dark:bg-indigo-500/5"
              )}
            >
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <CardTitle>{opportunity.role}</CardTitle>
                      {opportunity.isDream ? (
                        <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          <Star className="size-3 fill-current" /> Dream
                        </Badge>
                      ) : null}
                    </div>
                    <CardDescription>
                      {opportunity.company} · {opportunity.location} · {opportunity.salaryRange}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="icon-sm"
                      variant={opportunity.isDream ? "secondary" : "ghost"}
                      aria-label="Toggle Dream"
                      onClick={() => toggleDream(opportunity.id)}
                    >
                      <Star className={opportunity.isDream ? "size-4 fill-current" : "size-4"} />
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/opportunities/${opportunity.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip status={opportunity.status} />
                  <FitChip fit={opportunity.fit} />
                  <PriorityChip priority={opportunity.priority} />
                  {opportunity.hasCredibilityFlag ? (
                    <Badge variant="destructive">Credibility flag</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">{opportunity.description}</CardContent>
              <CardContent className="flex items-center justify-between pt-0">
                <span className="text-xs text-muted-foreground">Source: {opportunity.source}</span>
                <Select
                  value={opportunity.status}
                  onValueChange={(value) => setOpportunityStatus(opportunity.id, value as OpportunityStatus)}
                >
                  <SelectTrigger size="sm" aria-label="Change status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
