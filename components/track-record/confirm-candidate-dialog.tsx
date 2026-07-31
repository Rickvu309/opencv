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
  DialogTrigger,
} from "@/components/ui/dialog";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EntryFieldsForm } from "@/components/track-record/entry-fields-form";
import type { EntryDraft } from "@/components/track-record/entry-fields-form";
import { useStore } from "@/lib/store";
import type { TrackRecordEntry } from "@/lib/types";

interface ConfirmCandidateDialogProps {
  entry: TrackRecordEntry;
  children: React.ReactNode;
}

function draftFromEntry(entry: TrackRecordEntry): EntryDraft {
  return {
    title: entry.title,
    date: entry.date,
    story: entry.story,
    impact: entry.impact,
    evidenceTag: entry.evidenceTag,
    skillIds: entry.skillIds,
  };
}

/**
 * The entry editor a candidate opens into: every drafted field is prefilled
 * from Copilot's draft and fully editable before it joins the timeline.
 * Confirming keeps the candidate's id, so it moves in place from the review
 * inbox into the confirmed timeline rather than creating a duplicate.
 */
export function ConfirmCandidateDialog({ entry, children }: ConfirmCandidateDialogProps) {
  const { state, confirmTrackRecordCandidate } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EntryDraft>(() => draftFromEntry(entry));
  const [wasOpen, setWasOpen] = useState(open);

  // Reset to the freshly drafted fields whenever the dialog opens, so a
  // stale edit from a previous open never lingers.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(draftFromEntry(entry));
  }

  const canConfirm = Boolean(draft.title.trim() && draft.story.trim() && draft.impact.trim() && draft.date);

  function handleConfirm() {
    if (!canConfirm) return;
    confirmTrackRecordCandidate(entry.id, {
      title: draft.title.trim(),
      story: draft.story.trim(),
      impact: draft.impact.trim(),
      date: draft.date,
      evidenceTag: draft.evidenceTag,
      skillIds: draft.skillIds,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review candidate
            <CopilotTag />
          </DialogTitle>
          <DialogDescription>
            Edit anything before it joins your Track Record. Nothing is added until you confirm.
          </DialogDescription>
        </DialogHeader>

        <EntryFieldsForm draft={draft} skills={state.skills} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
