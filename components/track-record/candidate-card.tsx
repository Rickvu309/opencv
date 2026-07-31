"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TrackRecordEntry } from "@/lib/types";

interface CandidateCardProps {
  entry: TrackRecordEntry;
  /** The "Review and confirm" button, passed in already wrapped by its dialog trigger. */
  reviewAction: ReactNode;
  onDismiss: () => void;
}

/**
 * One drafted candidate in the review inbox. The dashed border, tinted
 * background, and Copilot tag are the trust-boundary signal: this reads as
 * unmistakably different from a confirmed timeline entry until the user
 * reviews and confirms it themselves.
 */
export function CandidateCard({ entry, reviewAction, onDismiss }: CandidateCardProps) {
  return (
    <Card
      className={cn(
        "border-2 border-dashed border-indigo-300 bg-indigo-50/40 ring-0",
        "dark:border-indigo-500/40 dark:bg-indigo-500/5"
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 break-words text-sm font-medium text-foreground">{entry.title}</p>
          <CopilotTag className="shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{entry.story}</p>
        <p className="text-xs text-muted-foreground">{entry.impact}</p>
        {entry.whySuggested ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Why Copilot suggests this: </span>
            {entry.whySuggested}
          </p>
        ) : null}
        {entry.evidenceHint ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Evidence hint: </span>
            {entry.evidenceHint}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1">
          {reviewAction}
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            <X className="size-3.5" />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
