"use client";

import { useState } from "react";
import { Check, Pencil, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { SaveBackConfirmation } from "@/components/ai/save-back-confirmation";
import { TrackRecordEvidenceChip } from "@/components/proof/track-record-evidence-chip";
import type { ProofTransformation, TrackRecordEntry } from "@/lib/types";

interface ProofTransformationCardProps {
  transformation: ProofTransformation;
  backingEntries: TrackRecordEntry[];
  /** Where this block writes if accepted, "the Skills section on Base CV." */
  targetLabel: string;
  confirmationMessage: string;
  onAccept: (groundedProof: string) => void;
  onSkip: () => void;
  onUnskip: () => void;
  onUndo: () => void;
}

/**
 * Section 5, the builder core: one strict before-after anatomy (Raw,
 * Grounded proof, the evidence footer naming backingEntries), Progressive
 * Disclosure in sequence (raw claim, shaped rewrite, then the polished
 * accepted state). Accept, Edit inline, and Skip never apply themselves;
 * the caller wires Accept to the real save-back.
 */
export function ProofTransformationCard({
  transformation,
  backingEntries,
  targetLabel,
  confirmationMessage,
  onAccept,
  onSkip,
  onUnskip,
  onUndo,
}: ProofTransformationCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(transformation.groundedProof);

  if (transformation.state === "skipped") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground">Skipped: {transformation.raw}</p>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onUnskip}>
          <RotateCcw className="size-3.5" />
          Bring back
        </Button>
      </div>
    );
  }

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">Targets: {targetLabel}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <ConfidenceChip confidence={transformation.confidence} />
            <CopilotTag />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Raw</span>
          <p className="text-sm text-muted-foreground">{transformation.raw}</p>
        </div>

        <div className="flex flex-col gap-1.5 rounded-md border-2 border-dashed border-indigo-300 bg-indigo-50/40 px-3 py-2 ring-0 dark:border-indigo-500/40 dark:bg-indigo-500/5">
          <span className="text-xs font-medium text-muted-foreground">Grounded proof</span>
          {editing ? (
            <Textarea
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="bg-background text-sm"
              aria-label="Edit grounded proof"
              autoFocus
            />
          ) : (
            <p className="text-sm text-foreground">{draft}</p>
          )}
        </div>

        {backingEntries.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Evidence</span>
            <div className="flex flex-wrap gap-1.5">
              {backingEntries.map((entry) => (
                <TrackRecordEvidenceChip key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        ) : null}

        {transformation.state === "accepted" ? (
          <SaveBackConfirmation message={confirmationMessage} onUndo={onUndo} />
        ) : (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => onAccept(draft)} disabled={!draft.trim()}>
              <Check className="size-3.5" />
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing((current) => !current)}>
              <Pencil className="size-3.5" />
              {editing ? "Done editing" : "Edit"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onSkip}>
              <X className="size-3.5" />
              Skip
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
