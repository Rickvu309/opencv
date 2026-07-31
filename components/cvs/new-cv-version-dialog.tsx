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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { makeId, today, useStore } from "@/lib/store";
import type { CvVersion } from "@/lib/types";

interface NewCvVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselects the source version, for example when duplicating from a card's actions menu. */
  defaultSourceId?: string;
}

/**
 * The "New version" duplicate-from-base flow: pick a source version, name
 * the copy, land on a fresh base version with the source's sections carried
 * over and no opportunity link.
 */
export function NewCvVersionDialog({ open, onOpenChange, defaultSourceId }: NewCvVersionDialogProps) {
  const { state, addCvVersion } = useStore();
  const [sourceId, setSourceId] = useState(defaultSourceId ?? state.cvVersions[0]?.id ?? "");
  const [name, setName] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  // Reset the form fields whenever the dialog transitions from closed to
  // open, so a stale name or source from a previous use never lingers.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSourceId(defaultSourceId ?? state.cvVersions[0]?.id ?? "");
      setName("");
    }
  }

  const source = state.cvVersions.find((cv) => cv.id === sourceId);
  const canCreate = Boolean(source && name.trim());

  function handleCreate() {
    if (!source || !name.trim()) return;
    const cv: CvVersion = {
      id: makeId("cv"),
      name: name.trim(),
      kind: "base",
      lastEditedAt: today(),
      sections: source.sections.map((section) => ({ ...section, id: makeId("cv-section") })),
    };
    addCvVersion(cv);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New version</DialogTitle>
          <DialogDescription>
            Duplicate an existing version to start editing from a known-good base.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Source version</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a version to duplicate" />
              </SelectTrigger>
              <SelectContent>
                {state.cvVersions.map((cv) => (
                  <SelectItem key={cv.id} value={cv.id}>
                    {cv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-cv-name">Name</Label>
            <Input
              id="new-cv-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name this version"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={!canCreate}>
            Create version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
