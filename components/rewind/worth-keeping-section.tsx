import { CopilotTag } from "@/components/shared/copilot-tag";
import { Progress } from "@/components/ui/progress";
import { RewindCandidateCard } from "@/components/rewind/candidate-card";
import { reviewedCandidateCount } from "@/lib/rewind-utils";
import type { RewindCandidate, Skill } from "@/lib/types";

interface WorthKeepingSectionProps {
  candidates: RewindCandidate[];
  skills: Skill[];
}

/**
 * The core of Rewind: 3 evidence-backed candidates worth keeping. A live
 * "X of N reviewed" progress bar keeps review progress visible while
 * working through the list (Goal-Gradient).
 */
export function WorthKeepingSection({ candidates, skills }: WorthKeepingSectionProps) {
  const reviewed = reviewedCandidateCount(candidates);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2>Worth keeping</h2>
          <CopilotTag />
        </div>
        <p className="text-xs text-muted-foreground">
          {reviewed} of {candidates.length} reviewed
        </p>
      </div>
      <Progress value={candidates.length > 0 ? (reviewed / candidates.length) * 100 : 0} className="h-1.5" />
      <div className="flex flex-col gap-3">
        {candidates.map((candidate) => (
          <RewindCandidateCard key={candidate.id} candidate={candidate} skills={skills} />
        ))}
      </div>
    </section>
  );
}
