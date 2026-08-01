"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { DetailPage } from "@/components/shell/detail-page";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CandidateIdentityBand } from "@/components/recruiter/candidate-identity-band";
import { CandidateAiSummaryBlock } from "@/components/recruiter/candidate-ai-summary-block";
import { CandidateHighlights } from "@/components/recruiter/candidate-highlights";
import { CandidateStageHistory } from "@/components/recruiter/candidate-stage-history";
import { CandidateReviewSection } from "@/components/recruiter/candidate-review-section";
import { CandidateOutreachSection } from "@/components/recruiter/candidate-outreach-section";
import { CandidateSubmissionSection } from "@/components/recruiter/candidate-submission-section";
import { CandidateNotes } from "@/components/recruiter/candidate-notes";
import { findRecruiterRole } from "@/lib/recruiter-utils";
import { resolveRecruiterCandidateSurface } from "@/lib/copilot-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function RecruiterCandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const { state } = useStore();
  const candidate = state.recruiterCandidates.find((item) => item.id === params.id);
  const role = candidate ? findRecruiterRole(candidate.roleId, state.recruiterRoles) : undefined;

  useCopilotSurface(
    candidate ? resolveRecruiterCandidateSurface(candidate.name) : "Recruiter Candidate Detail",
    candidate?.name
  );

  if (!candidate) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Candidate not found" />
        <div className="p-6">
          <EmptyState
            message="This candidate doesn't exist, or was removed."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/recruiter/candidates">Back to Candidates</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <DetailPage title={candidate.name} description={role ? `${role.title} at ${role.company}` : undefined}>
      <div className="flex flex-col gap-4">
        <CandidateIdentityBand candidate={candidate} />
        <CandidateAiSummaryBlock candidate={candidate} />

        <div className="grid grid-cols-2 gap-4">
          <CandidateHighlights candidate={candidate} />
          <CandidateStageHistory candidate={candidate} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CandidateReviewSection review={candidate.review} />
          <CandidateOutreachSection outreach={candidate.outreach} />
        </div>

        <CandidateSubmissionSection submission={candidate.submission} />

        <CandidateNotes candidate={candidate} />
      </div>
    </DetailPage>
  );
}
