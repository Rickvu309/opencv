"use client";

import { useState } from "react";
import { Check, Circle, Pencil, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { computeSubmissionChecklist, isSubmissionEligible } from "@/lib/recruiter-utils";
import { getHiringManagerSummaryDraft } from "@/lib/recruiter-submission-utils";
import { useStore } from "@/lib/store";
import type { RecruiterCandidate, RecruiterHiringManagerSummary, RecruiterSubmission } from "@/lib/types";

const STATUS_TONE: Record<RecruiterSubmission["status"], keyof typeof CHIP_TONES> = {
  "Not started": "neutral",
  "Packet in progress": "warning",
  "Submitted to hiring manager": "success",
  "Feedback pending": "warning",
};

const SUMMARY_FIELDS: { key: keyof RecruiterHiringManagerSummary; label: string }[] = [
  { key: "recommendation", label: "Recommendation" },
  { key: "evidence", label: "Evidence" },
  { key: "risk", label: "Risk" },
];

/**
 * Submission readiness for candidates at Interview or later (RDS-989): a
 * checklist computed live off real state, a Copilot-drafted hiring-manager
 * summary editable before "Prepare submission packet", and the resulting
 * packet preview with a simulated "Share with hiring manager". Candidates
 * not yet eligible show what's missing, honestly.
 */
export function CandidateSubmissionSection({ candidate }: { candidate: RecruiterCandidate }) {
  const { prepareRecruiterSubmissionPacket, shareRecruiterSubmissionPacket } = useStore();
  const submission = candidate.submission;
  const tone = CHIP_TONES[STATUS_TONE[submission.status]];
  const eligible = isSubmissionEligible(candidate);
  const checklist = computeSubmissionChecklist(candidate);
  const [summary, setSummary] = useState<RecruiterHiringManagerSummary>(() => getHiringManagerSummaryDraft(candidate));
  const [isEditingSummary, setIsEditingSummary] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Submission</CardTitle>
          <Chip
            label={eligible ? submission.status : "Not eligible yet"}
            dotClassName={eligible ? tone.dot : CHIP_TONES.muted.dot}
            className={eligible ? tone.className : CHIP_TONES.muted.className}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!eligible ? (
          <p className="text-sm text-muted-foreground">
            {candidate.name} hasn&apos;t reached Interview yet. Submission opens up once they do.
          </p>
        ) : (
          <>
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

            <div className="flex flex-col gap-1.5">
              <p className="text-section-label">Readiness checklist</p>
              <ul className="flex flex-col gap-1">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm">
                    {item.done ? (
                      <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!submission.packet ? (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Hiring-manager summary</p>
                  <CopilotTag />
                </div>
                <div className="flex flex-col gap-2">
                  {SUMMARY_FIELDS.map((field) => (
                    <div key={field.key} className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
                      {isEditingSummary ? (
                        <Textarea
                          rows={2}
                          value={summary[field.key]}
                          onChange={(event) => setSummary((current) => ({ ...current, [field.key]: event.target.value }))}
                          className="text-sm"
                          aria-label={field.label}
                        />
                      ) : (
                        <p className="text-sm text-foreground">{summary[field.key]}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" onClick={() => prepareRecruiterSubmissionPacket(candidate, summary)}>
                    Prepare submission packet
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingSummary((current) => !current)}>
                    <Pencil className="size-3.5" />
                    {isEditingSummary ? "Done editing" : "Edit"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Packet preview</p>
                  {submission.packet.sharedAt ? (
                    <Chip label={`Shared ${submission.packet.sharedAt}`} dotClassName={CHIP_TONES.success.dot} className={CHIP_TONES.success.className} />
                  ) : null}
                </div>
                <dl className="flex flex-col gap-2">
                  {SUMMARY_FIELDS.map((field) => (
                    <div key={field.key} className="flex flex-col gap-0.5">
                      <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
                      <dd className="text-sm text-foreground">{submission.packet!.summary[field.key]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Highlights</p>
                  <ul className="flex flex-col gap-1">
                    {submission.packet.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-1.5 text-sm text-foreground">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Stage history</p>
                  <p className="text-xs text-muted-foreground">
                    {submission.packet.stageHistorySnapshot.map((entry) => entry.stage).join(" → ")}
                  </p>
                </div>
                {submission.packet.sharedAt ? (
                  <p className="text-xs text-muted-foreground">Shared with {submission.hiringManager}.</p>
                ) : (
                  <Button size="sm" onClick={() => shareRecruiterSubmissionPacket(candidate)} className="w-fit">
                    <Share2 className="size-3.5" />
                    Share with hiring manager
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
