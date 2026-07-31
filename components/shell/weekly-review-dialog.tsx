"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Mail, PartyPopper } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EvidenceChip } from "@/components/ai/evidence-chip";
import { ConfirmCandidateDialog } from "@/components/track-record/confirm-candidate-dialog";
import { emailEvidence } from "@/lib/data/sources";
import { useStore } from "@/lib/store";
import type { TrackRecordEntry } from "@/lib/types";

// The 2 seeded, unconfirmed AI-drafted candidates Weekly Review's "worth
// capturing" step reviews directly, each backed by its own grouped email
// evidence.
const WEEKLY_REVIEW_CANDIDATE_IDS = ["tre-11", "tre-12"];

const STEP_TITLES = ["What moved", "What Copilot noticed", "Worth capturing", "Focus for next week"];
const TOTAL_STEPS = STEP_TITLES.length;

/**
 * The full-screen, 4-step Weekly Review: what moved, what Copilot noticed,
 * one candidate worth capturing, and 3 toggleable focus priorities, closing
 * on a saved summary state. Rendered once at the app shell level and
 * controlled entirely by store state, so both the sidebar entry and Home's
 * banner open the same dialog instance.
 */
export function WeeklyReviewDialog() {
  const {
    state,
    closeWeeklyReview,
    markWeeklyReviewViewed,
    acceptWeeklyReviewSuggestion,
    dismissWeeklyReviewSuggestion,
    dismissTrackRecordCandidate,
  } = useStore();
  const { weeklyReview } = state;
  const open = state.weeklyReviewOpen;
  const [step, setStep] = useState(1);

  // Every fresh open starts back at step 1, even if a prior session already
  // walked through it.
  useEffect(() => {
    function resetToFirstStep() {
      if (open) setStep(1);
    }
    resetToFirstStep();
  }, [open]);

  const captureCandidates = WEEKLY_REVIEW_CANDIDATE_IDS.map((id) =>
    state.trackRecordEntries.find((entry) => entry.id === id)
  ).filter((entry): entry is TrackRecordEntry => Boolean(entry));
  const isSummary = step > TOTAL_STEPS;

  function handleToggleSuggestion(id: string, suggestionState: string) {
    if (suggestionState === "accepted") {
      dismissWeeklyReviewSuggestion(id);
    } else {
      acceptWeeklyReviewSuggestion(id);
    }
  }

  function handleFinish() {
    markWeeklyReviewViewed();
    closeWeeklyReview();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeWeeklyReview()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{isSummary ? "Weekly Review" : `Weekly Review · ${STEP_TITLES[step - 1]}`}</DialogTitle>
            <CopilotTag />
          </div>
          {!isSummary ? (
            <DialogDescription>
              Step {step} of {TOTAL_STEPS}
            </DialogDescription>
          ) : (
            <DialogDescription>See you next week.</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex min-h-48 flex-col gap-4 text-sm">
          {step === 1 ? (
            <div className="flex flex-col gap-3">
              <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
                {weeklyReview.whatMoved.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">{weeklyReview.connectedSourcesRecap}</p>
                  <Link
                    href="/sources"
                    onClick={closeWeeklyReview}
                    className="w-fit text-xs font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Open Sources
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3">
              {weeklyReview.observations.map((observation) => (
                <div key={observation.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-foreground">{observation.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{observation.why}</p>
                </div>
              ))}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                2 achievements Copilot noticed from your connected sources this week, worth capturing before they
                fade.
              </p>
              {captureCandidates.length === 0 ? (
                <span className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" />
                  Both already reviewed
                </span>
              ) : (
                captureCandidates.map((entry) => {
                  const evidence = emailEvidence.filter(
                    (item) => item.mapsToType === "trackRecord" && item.mapsToId === entry.id
                  );
                  const confirmed = entry.status === "confirmed";
                  return (
                    <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-foreground">{entry.title}</p>
                        <CopilotTag className="shrink-0" />
                      </div>
                      <p className="text-muted-foreground">{entry.story}</p>
                      <p className="text-foreground">{entry.impact}</p>
                      {evidence.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {evidence.map((item) => (
                            <EvidenceChip key={item.id} evidence={item} />
                          ))}
                        </div>
                      ) : null}
                      {confirmed ? (
                        <span className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3.5" />
                          Added to Track Record
                        </span>
                      ) : (
                        <div className="flex gap-2 pt-0.5">
                          <ConfirmCandidateDialog entry={entry}>
                            <Button size="sm">Approve into Track Record</Button>
                          </ConfirmCandidateDialog>
                          <Button size="sm" variant="ghost" onClick={() => dismissTrackRecordCandidate(entry.id)}>
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-2">
              {weeklyReview.suggestedFocus.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-foreground">{suggestion.text}</p>
                    {suggestion.id === "review-focus-1" ? (
                      <Link
                        href="/planner"
                        onClick={closeWeeklyReview}
                        className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Also the top item in your Path Planner growth plan
                      </Link>
                    ) : null}
                  </div>
                  <Switch
                    className="mt-0.5 shrink-0"
                    checked={suggestion.state === "accepted"}
                    onCheckedChange={() => handleToggleSuggestion(suggestion.id, suggestion.state)}
                    aria-label={
                      suggestion.state === "accepted" ? "Remove from next week's focus" : "Pin to next week's focus"
                    }
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Accepted priorities pin to the top of your Home attention queue.
              </p>
            </div>
          ) : null}

          {isSummary ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
              <PartyPopper className="size-6 text-muted-foreground" />
              <p className="font-medium text-foreground">Review saved, see you next week.</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          {step > 1 && !isSummary ? (
            <Button variant="outline" onClick={() => setStep((current) => current - 1)}>
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {isSummary ? (
            <Button onClick={handleFinish}>Done</Button>
          ) : step < TOTAL_STEPS ? (
            <Button onClick={() => setStep((current) => current + 1)}>
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button onClick={() => setStep(TOTAL_STEPS + 1)}>Finish review</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
