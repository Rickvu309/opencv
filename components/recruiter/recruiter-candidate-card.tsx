"use client";

import Link from "next/link";
import { Flag } from "lucide-react";

import { Card } from "@/components/ui/card";
import { AttentionDot } from "@/components/opportunities/attention-dot";
import { RecruiterReadinessChip } from "@/components/recruiter/recruiter-readiness-chip";
import { RecruiterSourceChip } from "@/components/recruiter/recruiter-source-chip";
import { RecruiterQuickActionsMenu } from "@/components/recruiter/recruiter-quick-actions-menu";
import { daysInStage, isStaleInStage } from "@/lib/recruiter-utils";
import { today } from "@/lib/store";
import type { RecruiterCandidate } from "@/lib/types";

/**
 * Dense board card: identity, stage signals, and source grouped tightly
 * (Proximity), the same anatomy shape OpportunityBoardView's BoardCard
 * already establishes for the candidate-side board (Jakob's Law).
 */
export function RecruiterCandidateCard({ candidate }: { candidate: RecruiterCandidate }) {
  const todayIso = today();
  const days = daysInStage(candidate, todayIso);
  const stale = isStaleInStage(candidate, todayIso);

  return (
    <Link href={`/recruiter/candidates/${candidate.id}`} className="block">
      <Card size="sm" className="ring-foreground/8 gap-2 transition-colors hover:ring-foreground/20">
        <div className="flex flex-col gap-1.5 px-3">
          <div className="flex items-start justify-between gap-1">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {candidate.flaggedForReview ? (
                <Flag className="size-3 shrink-0 fill-amber-500 text-amber-500" />
              ) : null}
              <span className="truncate text-sm font-medium text-foreground">{candidate.name}</span>
              {stale ? <AttentionDot reason={`${days} days in ${candidate.stage}`} /> : null}
            </div>
            <RecruiterQuickActionsMenu candidate={candidate} />
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {candidate.currentTitle} at {candidate.currentCompany}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <RecruiterReadinessChip readiness={candidate.readiness} />
            <RecruiterSourceChip source={candidate.source} />
          </div>
          <p className="text-xs text-muted-foreground">
            {days} {days === 1 ? "day" : "days"} in {candidate.stage}
          </p>
        </div>
      </Card>
    </Link>
  );
}
