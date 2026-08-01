"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Circle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import type { RecruiterReview, RecruiterReviewPoint } from "@/lib/types";

const STATUS_TONE: Record<RecruiterReview["status"], keyof typeof CHIP_TONES> = {
  "Not started": "neutral",
  "In progress": "warning",
  Complete: "success",
};

/** One Strengths/Concerns/Unknowns group: each point expands in place to the evidence line behind it, never hidden grounding. */
function ReviewPointGroup({ title, points }: { title: string; points: RecruiterReviewPoint[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-section-label">{title}</p>
      {points.length === 0 ? (
        <p className="text-xs text-muted-foreground">None noted.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {points.map((point) => {
            const open = expandedId === point.id;
            return (
              <li key={point.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : point.id)}
                  className="flex w-full items-start gap-1.5 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={open}
                >
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="min-w-0 flex-1 text-sm text-foreground">{point.point}</span>
                  {open ? (
                    <ChevronUp className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {open ? (
                  <p className="mt-1 ml-2.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                    {point.evidence}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The candidate's structured review (RDS-989): Strengths, Concerns, and
 * Unknowns in recruiter language, mirroring the candidate-side fit anatomy,
 * a readiness verdict with a confidence chip, and 1 to 2 open questions.
 * Miller's Law: 3 named groups instead of one flat list. Progressive
 * Disclosure: every point's evidence stays collapsed until asked for.
 */
export function CandidateReviewSection({ review }: { review: RecruiterReview }) {
  const tone = CHIP_TONES[STATUS_TONE[review.status]];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Review</CardTitle>
            <CopilotTag />
          </div>
          <Chip label={review.status} dotClassName={tone.dot} className={tone.className} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{review.summary}</p>

        <ul className="flex flex-col gap-1.5">
          {review.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ReviewPointGroup title="Strengths" points={review.strengths} />
          <ReviewPointGroup title="Concerns" points={review.concerns} />
          <ReviewPointGroup title="Unknowns" points={review.unknowns} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2">
          <p className="text-sm text-foreground">{review.readinessVerdict}</p>
          <ConfidenceChip confidence={review.confidence} className="shrink-0" />
        </div>

        {review.openQuestions.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-section-label">Open questions</p>
            <ul className="flex flex-col gap-1">
              {review.openQuestions.map((question) => (
                <li key={question} className="flex items-start gap-1.5 text-sm text-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
                  {question}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
