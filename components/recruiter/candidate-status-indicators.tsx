import { Clock, PackageCheck, PauseCircle } from "lucide-react";

import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isSubmissionReady } from "@/lib/recruiter-utils";
import type { RecruiterCandidate } from "@/lib/types";

/**
 * All new RDS-989 pipeline states, reflected back onto the board card and
 * list row: a Held chip with its reason on hover, a waiting-on-reply
 * indicator, and a submission-ready indicator. Renders nothing when none
 * apply, so a candidate with no new state costs zero extra width.
 */
export function CandidateStatusIndicators({ candidate }: { candidate: RecruiterCandidate }) {
  const waitingOnReply = candidate.outreach.status === "Awaiting reply";
  const submissionReady = isSubmissionReady(candidate);

  if (!candidate.hold && !waitingOnReply && !submissionReady) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {candidate.hold ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Chip label="Held" icon={<PauseCircle className="size-3" />} className={CHIP_TONES.warning.className} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{candidate.hold.reason}</TooltipContent>
        </Tooltip>
      ) : null}
      {waitingOnReply ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Clock className="size-3.5 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Waiting on a reply</TooltipContent>
        </Tooltip>
      ) : null}
      {submissionReady ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <PackageCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Ready to submit to the hiring manager</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
