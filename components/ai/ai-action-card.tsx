"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EvidenceChip } from "@/components/ai/evidence-chip";
import { EvidenceExtract } from "@/components/ai/evidence-extract";
import { SaveBackConfirmation } from "@/components/ai/save-back-confirmation";
import { cn } from "@/lib/utils";
import type { EmailEvidence } from "@/lib/types";

// How long the save-back confirmation stays prominent (with Undo showing)
// before AiActionCard settles into the quiet done row.
const SETTLE_DELAY_MS = 6000;

export interface AiActionCardEditable {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface AiActionCardProps {
  /** Beat 1's kind icon. */
  icon: LucideIcon;
  /** Optional line above the signal, for surfaces (like Home) where the object isn't already the page context. */
  context?: ReactNode;
  signal: string;
  whyItMatters: string;
  evidence: EmailEvidence;
  proposedAction: string;
  editable?: AiActionCardEditable;
  approved: boolean;
  confirmationMessage: string;
  onApprove: () => void;
  onDismiss: () => void;
  onUndo: () => void;
  className?: string;
}

/**
 * The default AI workflow pattern: one compact block for the five beats
 * (signal, why it matters, evidence, proposed action, controls). Used
 * everywhere AI proposes work, opportunity Signals, the Home attention
 * queue, and Weekly Review capture. Approve, Edit, and Dismiss never apply
 * anything themselves, the caller wires Approve to the real store change.
 */
export function AiActionCard({
  icon: Icon,
  context,
  signal,
  whyItMatters,
  evidence,
  proposedAction,
  editable,
  approved,
  confirmationMessage,
  onApprove,
  onDismiss,
  onUndo,
  className,
}: AiActionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!approved) {
      setSettled(false);
      return;
    }
    const timeout = window.setTimeout(() => setSettled(true), SETTLE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [approved]);

  if (approved && settled) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3",
          className
        )}
      >
        <Check className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{confirmationMessage}</p>
      </div>
    );
  }

  return (
    <Card className={cn("ring-foreground/8", className)}>
      <CardContent className="flex flex-col gap-2.5">
        {context ? <div>{context}</div> : null}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm font-medium text-foreground">{signal}</p>
          </div>
          <CopilotTag className="shrink-0" />
        </div>

        <p className="pl-8 text-xs text-muted-foreground">{whyItMatters}</p>

        <div className="flex flex-col gap-1.5 pl-8">
          <button
            type="button"
            onClick={() => setEvidenceOpen((current) => !current)}
            className="flex w-fit items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={evidenceOpen}
          >
            <EvidenceChip evidence={evidence} />
            {evidenceOpen ? (
              <ChevronUp className="size-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3 text-muted-foreground" />
            )}
          </button>
          {evidenceOpen ? <EvidenceExtract evidence={evidence} /> : null}
        </div>

        {approved ? (
          <div className="pl-8">
            <SaveBackConfirmation message={confirmationMessage} onUndo={onUndo} />
          </div>
        ) : (
          <>
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 pl-8">
              <p className="text-xs font-medium text-muted-foreground">If you accept</p>
              {isEditing && editable ? (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <p className="text-xs text-muted-foreground">{editable.label}</p>
                  <Textarea
                    rows={2}
                    value={editable.value}
                    onChange={(event) => editable.onChange(event.target.value)}
                    className="text-sm"
                    aria-label={editable.label}
                  />
                </div>
              ) : (
                <p className="text-sm text-foreground">{proposedAction}</p>
              )}
            </div>

            <div className="flex items-center gap-1.5 pl-8">
              <Button size="sm" onClick={onApprove}>
                <Check className="size-3.5" />
                Approve
              </Button>
              {editable ? (
                <Button size="sm" variant="outline" onClick={() => setIsEditing((current) => !current)}>
                  <Pencil className="size-3.5" />
                  {isEditing ? "Done editing" : "Edit"}
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                <X className="size-3.5" />
                Dismiss
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
