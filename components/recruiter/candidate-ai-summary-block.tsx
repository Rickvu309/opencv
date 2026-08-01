import { CopilotTag } from "@/components/shared/copilot-tag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecruiterCandidate } from "@/lib/types";

/** Copilot-tagged, exactly 3 labeled lines: strengths, watchouts, suggested next step. Progressive Disclosure: this is the summary, the full picture lives in Highlights and the sections below. */
export function CandidateAiSummaryBlock({ candidate }: { candidate: RecruiterCandidate }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI summary</CardTitle>
          <CopilotTag />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-muted-foreground">Strengths</dt>
            <dd className="text-sm text-foreground">{candidate.aiStrengths}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-muted-foreground">Watchouts</dt>
            <dd className="text-sm text-foreground">{candidate.aiWatchouts}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-muted-foreground">Suggested next step</dt>
            <dd className="text-sm text-foreground">{candidate.suggestedNextStep}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
