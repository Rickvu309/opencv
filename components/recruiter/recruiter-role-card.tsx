"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecruiterReadinessChip } from "@/components/recruiter/recruiter-readiness-chip";
import { RECRUITER_STAGES, daysInStage, type RecruiterRoleSummary } from "@/lib/recruiter-utils";
import { today } from "@/lib/store";

/** One role's summary: stage counts, how long it's been open, and the single candidate waiting longest for a decision. */
export function RecruiterRoleCard({ summary }: { summary: RecruiterRoleSummary }) {
  const { role, candidateCount, stageCounts, daysOpen, topWaitingCandidate } = summary;
  const todayIso = today();
  const activeStageCounts = RECRUITER_STAGES.filter((stage) => stageCounts[stage] > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <CardTitle>{role.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {role.company} · {role.location}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/recruiter?role=${role.id}`}>
              View pipeline
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {candidateCount} {candidateCount === 1 ? "candidate" : "candidates"}
          </span>
          <span aria-hidden="true">·</span>
          <span>Open {daysOpen} days</span>
        </div>

        {activeStageCounts.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {activeStageCounts.map((stage) => `${stageCounts[stage]} ${stage}`).join(" · ")}
          </p>
        ) : null}

        {topWaitingCandidate ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-xs font-medium text-muted-foreground">Top waiting candidate</p>
              <Link
                href={`/recruiter/candidates/${topWaitingCandidate.id}`}
                className="truncate text-sm font-medium text-foreground hover:underline"
              >
                {topWaitingCandidate.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {daysInStage(topWaitingCandidate, todayIso)} days in {topWaitingCandidate.stage}
              </p>
            </div>
            <RecruiterReadinessChip readiness={topWaitingCandidate.readiness} className="shrink-0" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
