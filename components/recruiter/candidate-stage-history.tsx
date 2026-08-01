import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecruiterStageChip } from "@/components/recruiter/recruiter-stage-chip";
import type { RecruiterCandidate } from "@/lib/types";

export function CandidateStageHistory({ candidate }: { candidate: RecruiterCandidate }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage history</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {candidate.stageHistory.map((entry, index) => (
            <li key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                {index < candidate.stageHistory.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-3">
                <div className="flex items-center gap-2">
                  <RecruiterStageChip stage={entry.stage} />
                  <span className="text-xs text-muted-foreground">{entry.enteredAt}</span>
                </div>
                {entry.note ? <p className="text-xs text-muted-foreground">{entry.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
