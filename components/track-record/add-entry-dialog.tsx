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
import { EntryFieldsForm } from "@/components/track-record/entry-fields-form";
import type { EntryDraft } from "@/components/track-record/entry-fields-form";
import { EVIDENCE_TAGS } from "@/lib/data/track-record";
import { makeId, today, useStore } from "@/lib/store";
import type { TrackRecordEntry } from "@/lib/types";

function emptyDraft(): EntryDraft {
  return {
    title: "",
    date: today(),
    story: "",
    impact: "",
    evidenceTag: EVIDENCE_TAGS[0],
    skillIds: [],
  };
}

/**
 * The guided manual-add flow: structured fields only, no free-text blob, so
 * every entry a user writes themselves still has the same shape a drafted
 * candidate does once confirmed.
 */
export function AddEntryDialog({ children }: { children: React.ReactNode }) {
  const { state, addTrackRecordEntry } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setDraft(emptyDraft());
  }

  const canSave = Boolean(draft.title.trim() && draft.story.trim() && draft.impact.trim() && draft.date);

  function handleSave() {
    if (!canSave) return;
    const entry: TrackRecordEntry = {
      id: makeId("tre"),
      title: draft.title.trim(),
      story: draft.story.trim(),
      impact: draft.impact.trim(),
      date: draft.date,
      evidenceTag: draft.evidenceTag,
      skillIds: draft.skillIds,
      status: "confirmed",
    };
    addTrackRecordEntry(entry);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add entry</DialogTitle>
          <DialogDescription>
            Capture a piece of evidence directly. It joins the confirmed timeline right away.
          </DialogDescription>
        </DialogHeader>

        <EntryFieldsForm draft={draft} skills={state.skills} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!canSave}>
            Add to Track Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
