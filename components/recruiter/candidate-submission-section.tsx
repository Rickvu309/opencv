import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import type { RecruiterSubmissionScaffold } from "@/lib/types";

const STATUS_TONE: Record<RecruiterSubmissionScaffold["status"], keyof typeof CHIP_TONES> = {
  "Not started": "neutral",
  "Packet in progress": "warning",
  "Submitted to hiring manager": "success",
  "Feedback pending": "warning",
};

/** What a submission packet to the hiring manager looks like today, the pattern ticket 06 established: structured content now, that RDS-30 deepens into a real submission workflow. */
export function CandidateSubmissionSection({ submission }: { submission: RecruiterSubmissionScaffold }) {
  const tone = CHIP_TONES[STATUS_TONE[submission.status]];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Submission</CardTitle>
          <Chip label={submission.status} dotClassName={tone.dot} className={tone.className} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Hiring manager</span>
          <span className="text-foreground">{submission.hiringManager}</span>
        </div>
        {submission.targetDate ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Target date</span>
            <span className="text-foreground">{submission.targetDate}</span>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">Package includes</span>
          <span className="text-sm text-foreground">{submission.packageIncludes.join(", ")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
