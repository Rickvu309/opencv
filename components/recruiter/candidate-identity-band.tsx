"use client";

import { useState } from "react";
import { Check, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecruiterAdvanceStageDialog } from "@/components/recruiter/recruiter-advance-stage-dialog";
import { RecruiterReadinessChip } from "@/components/recruiter/recruiter-readiness-chip";
import { RecruiterSourceChip } from "@/components/recruiter/recruiter-source-chip";
import { RecruiterStageChip } from "@/components/recruiter/recruiter-stage-chip";
import { RECRUITER_STAGES, daysInStage } from "@/lib/recruiter-utils";
import { today, useStore } from "@/lib/store";
import type { RecruiterCandidate, RecruiterStage } from "@/lib/types";

/**
 * The band that stays visible above the detail sections: identity context
 * plus the inline stage control (click the stage chip, pick a stage, confirm
 * the named move), readiness, source, and flag for review. The candidate's
 * name and the role applied for already live in the page header above, this
 * band never repeats them (matching the same rule OpportunitySummaryBand's
 * own doc comment states).
 */
export function CandidateIdentityBand({ candidate }: { candidate: RecruiterCandidate }) {
  const { toggleRecruiterCandidateFlag } = useStore();
  const [targetStage, setTargetStage] = useState<RecruiterStage | null>(null);
  const days = daysInStage(candidate, today());

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {candidate.currentTitle} at {candidate.currentCompany} · {days} {days === 1 ? "day" : "days"} in{" "}
        {candidate.stage}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <RecruiterStageChip stage={candidate.stage} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {RECRUITER_STAGES.map((stage) => (
              <DropdownMenuItem key={stage} onSelect={() => setTargetStage(stage)}>
                {stage === candidate.stage ? <Check className="size-3.5" /> : null}
                {stage}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <RecruiterReadinessChip readiness={candidate.readiness} />
        <RecruiterSourceChip source={candidate.source} />

        <Button
          size="sm"
          variant={candidate.flaggedForReview ? "secondary" : "outline"}
          aria-pressed={candidate.flaggedForReview}
          onClick={() => toggleRecruiterCandidateFlag(candidate.id)}
        >
          <Flag className={candidate.flaggedForReview ? "size-3.5 fill-current" : "size-3.5"} />
          {candidate.flaggedForReview ? "Flagged" : "Flag for review"}
        </Button>
      </div>

      <RecruiterAdvanceStageDialog
        candidate={targetStage && targetStage !== candidate.stage ? candidate : null}
        targetStage={targetStage !== candidate.stage ? targetStage : null}
        onClose={() => setTargetStage(null)}
      />
    </div>
  );
}
