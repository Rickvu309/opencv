"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { SaveBackConfirmation } from "@/components/ai/save-back-confirmation";
import { RecruiterAdvanceStageDialog } from "@/components/recruiter/recruiter-advance-stage-dialog";
import { RecruiterDecisionDialog } from "@/components/recruiter/recruiter-decision-dialog";
import { decisionCallLabel, nextRecruiterStage, secondaryDecisionCalls } from "@/lib/recruiter-utils";
import { useStore } from "@/lib/store";
import type { RecruiterCandidate, RecruiterDecisionCall, RecruiterStage } from "@/lib/types";

/**
 * Candidate detail's Decision block (RDS-989), directly under Review
 * (Proximity): the recommended call with its two-line why, and the other 3
 * calls as quiet secondary actions (Hick's Law). Advance runs the existing
 * stage-advance confirmation and its own established toast; Hold, Request
 * more info, and Do not advance each require a one-line reason and, once
 * applied, show this block's own inline save-back confirmation with Undo.
 */
export function CandidateDecisionBlock({ candidate }: { candidate: RecruiterCandidate }) {
  const { undoRecruiterDecision } = useStore();
  const [dialogCall, setDialogCall] = useState<Exclude<RecruiterDecisionCall, "advance"> | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<RecruiterStage | null>(null);

  if (candidate.pendingDecisionUndo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Decision</CardTitle>
        </CardHeader>
        <CardContent>
          <SaveBackConfirmation
            message={candidate.pendingDecisionUndo.confirmationMessage}
            onUndo={() => undoRecruiterDecision(candidate.id)}
          />
        </CardContent>
      </Card>
    );
  }

  if (candidate.stage === "Hired" || candidate.stage === "Closed" || !candidate.decision) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Decision</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {candidate.stage === "Hired"
              ? `${candidate.name} is hired. No further decision needed.`
              : `This search is closed for ${candidate.name}. No further decision needed.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { recommended, why } = candidate.decision;
  const secondaryCalls = secondaryDecisionCalls(candidate);

  function handleCallClick(call: RecruiterDecisionCall) {
    if (call === "advance") {
      setAdvanceTarget(nextRecruiterStage(candidate.stage) ?? null);
    } else {
      setDialogCall(call);
    }
  }

  return (
    <Card className="ring-primary/25">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Decision</CardTitle>
          <CopilotTag />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{decisionCallLabel(recommended, candidate)}</p>
          <p className="text-xs text-muted-foreground">{why}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => handleCallClick(recommended)}>
            {decisionCallLabel(recommended, candidate)}
          </Button>
          {secondaryCalls.map((call) => (
            <Button key={call} size="sm" variant="ghost" onClick={() => handleCallClick(call)}>
              {decisionCallLabel(call, candidate)}
            </Button>
          ))}
        </div>
      </CardContent>

      <RecruiterAdvanceStageDialog
        candidate={advanceTarget ? candidate : null}
        targetStage={advanceTarget}
        onClose={() => setAdvanceTarget(null)}
      />
      <RecruiterDecisionDialog candidate={dialogCall ? candidate : null} call={dialogCall} onClose={() => setDialogCall(null)} />
    </Card>
  );
}
