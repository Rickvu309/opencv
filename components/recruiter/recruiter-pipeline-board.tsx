"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { RecruiterCandidateCard } from "@/components/recruiter/recruiter-candidate-card";
import { RECRUITER_STAGES } from "@/lib/recruiter-utils";
import type { RecruiterCandidate } from "@/lib/types";

interface RecruiterPipelineBoardProps {
  candidates: RecruiterCandidate[];
}

/** Columns per stage, mirroring OpportunityBoardView's shape for the same scanning pattern across both persona modes (Jakob's Law). */
export function RecruiterPipelineBoard({ candidates }: RecruiterPipelineBoardProps) {
  return (
    <div className="grid grid-cols-6 gap-3">
      {RECRUITER_STAGES.map((stage) => {
        const stageCandidates = candidates.filter((candidate) => candidate.stage === stage);
        return (
          <div key={stage} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-foreground">{stage}</span>
              <span className="text-xs text-muted-foreground">{stageCandidates.length}</span>
            </div>

            {stageCandidates.length === 0 ? (
              <EmptyState className="px-3 py-6" message={`Nobody in ${stage.toLowerCase()} right now.`} />
            ) : (
              <div className="flex flex-col gap-2">
                {stageCandidates.map((candidate) => (
                  <RecruiterCandidateCard key={candidate.id} candidate={candidate} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
