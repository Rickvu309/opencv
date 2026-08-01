"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import type { RecruiterCandidate, RecruiterDecisionCall } from "@/lib/types";

type DecisionDialogCall = Exclude<RecruiterDecisionCall, "advance">;

interface CopyEntry {
  title: (name: string) => string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  confirmLabel: string;
  defaultValue: (candidate: RecruiterCandidate) => string;
}

const COPY: Record<DecisionDialogCall, CopyEntry> = {
  hold: {
    title: (name) => `Hold ${name}?`,
    description: "Pauses this candidate's pipeline movement with a one-line reason. It shows as a Held chip on the pipeline, reason on hover.",
    fieldLabel: "Reason",
    placeholder: "Waiting on...",
    confirmLabel: "Put on hold",
    defaultValue: () => "",
  },
  "request-info": {
    title: (name) => `Request more info from ${name}?`,
    description: "Adds a follow-up task to this candidate. It surfaces in the pipeline's Needs attention strip until it's done.",
    fieldLabel: "Follow-up task",
    placeholder: "What's needed before this can move",
    confirmLabel: "Add follow-up",
    defaultValue: (candidate) => candidate.suggestedNextStep,
  },
  "do-not-advance": {
    title: (name) => `Do not advance ${name}?`,
    description:
      "Moves this candidate to Closed with a one-line reason logged to their stage history. A respectful close message is ready in Outreach below.",
    fieldLabel: "Reason",
    placeholder: "Why this isn't a fit right now",
    confirmLabel: "Move to Closed",
    defaultValue: () => "",
  },
};

interface RecruiterDecisionDialogProps {
  candidate: RecruiterCandidate | null;
  call: DecisionDialogCall | null;
  onClose: () => void;
}

/**
 * The confirmation the brief requires before Hold, Request more info, or Do
 * not advance commit: a required one-line reason (or task), pre-filled where
 * a sensible default already exists (the follow-up task defaults to the
 * candidate's own suggestedNextStep). "Advance" reuses the existing
 * RecruiterAdvanceStageDialog instead, see candidate-decision-block.tsx.
 */
export function RecruiterDecisionDialog({ candidate, call, onClose }: RecruiterDecisionDialogProps) {
  const { applyRecruiterDecision } = useStore();
  const open = candidate !== null && call !== null;
  const copy = call ? COPY[call] : null;
  const [value, setValue] = useState("");

  // Re-seeds the field's default whenever a fresh (candidate, call) pair
  // opens, adjusted during render rather than in an effect (the
  // React-recommended way, the same pattern AiActionCard's own
  // trackedApproved uses) so it never fires a second, cascading render.
  const dialogKey = candidate && call ? `${candidate.id}:${call}` : null;
  const [trackedKey, setTrackedKey] = useState<string | null>(null);
  if (dialogKey !== trackedKey) {
    setTrackedKey(dialogKey);
    if (candidate && call) setValue(COPY[call].defaultValue(candidate));
  }

  const trimmed = value.trim();

  function handleConfirm() {
    if (!candidate || !call || !trimmed) return;
    applyRecruiterDecision(candidate, call, trimmed);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{candidate && copy ? copy.title(candidate.name) : ""}</DialogTitle>
          <DialogDescription>{copy?.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recruiter-decision-input">{copy?.fieldLabel}</Label>
          <Input
            id="recruiter-decision-input"
            value={value}
            placeholder={copy?.placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!trimmed}>
            {copy?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
