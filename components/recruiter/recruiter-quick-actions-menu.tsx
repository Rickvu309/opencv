"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecruiterAdvanceStageDialog } from "@/components/recruiter/recruiter-advance-stage-dialog";
import { RECRUITER_STAGES, nextRecruiterStage } from "@/lib/recruiter-utils";
import { useStore } from "@/lib/store";
import type { RecruiterCandidate, RecruiterStage } from "@/lib/types";

/**
 * The one quick-actions surface shared by board cards and list rows: advance
 * to the next stage (or move to any other stage), flag for review, and open
 * detail. Every stage move, whichever way it's chosen, opens the same named
 * confirmation dialog before it commits.
 */
export function RecruiterQuickActionsMenu({ candidate }: { candidate: RecruiterCandidate }) {
  const { toggleRecruiterCandidateFlag } = useStore();
  const router = useRouter();
  const [targetStage, setTargetStage] = useState<RecruiterStage | null>(null);

  const nextStage = nextRecruiterStage(candidate.stage);
  const otherStages = RECRUITER_STAGES.filter((stage) => stage !== candidate.stage);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Quick actions for ${candidate.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuLabel>{candidate.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {nextStage ? (
            <DropdownMenuItem onSelect={() => setTargetStage(nextStage)}>Advance to {nextStage}</DropdownMenuItem>
          ) : null}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to...</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherStages.map((stage) => (
                <DropdownMenuItem key={stage} onSelect={() => setTargetStage(stage)}>
                  {stage}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem onSelect={() => toggleRecruiterCandidateFlag(candidate.id)}>
            <Flag className={candidate.flaggedForReview ? "size-3.5 fill-current" : "size-3.5"} />
            {candidate.flaggedForReview ? "Remove flag" : "Flag for review"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => router.push(`/recruiter/candidates/${candidate.id}`)}>
            Open detail
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RecruiterAdvanceStageDialog
        candidate={targetStage ? candidate : null}
        targetStage={targetStage}
        onClose={() => setTargetStage(null)}
      />
    </>
  );
}
