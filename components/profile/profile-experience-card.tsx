"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { makeId, useStore } from "@/lib/store";
import type { ExperienceEntry } from "@/lib/types";

interface EntryDraft {
  title: string;
  company: string;
  start: string;
  end: string;
  bulletOne: string;
  bulletTwo: string;
}

function draftFromEntry(entry?: ExperienceEntry): EntryDraft {
  return {
    title: entry?.title ?? "",
    company: entry?.company ?? "",
    start: entry?.start ?? "",
    end: entry?.end ?? "",
    bulletOne: entry?.bullets[0] ?? "",
    bulletTwo: entry?.bullets[1] ?? "",
  };
}

function draftIsValid(draft: EntryDraft): boolean {
  return Boolean(
    draft.title.trim() &&
      draft.company.trim() &&
      draft.start.trim() &&
      draft.end.trim() &&
      draft.bulletOne.trim() &&
      draft.bulletTwo.trim()
  );
}

/**
 * Experience, 4 roles with 2 impact bullets each. Add and edit inline, each
 * role toggles into its own edit form rather than opening a dialog, so this
 * stays a working asset rather than a resume export.
 */
export function ProfileExperienceCard() {
  const { state, updateExperienceEntry, addExperienceEntry } = useStore();
  const { experience } = state.profile;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft>(draftFromEntry());
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<EntryDraft>(draftFromEntry());

  function startEditing(entry: ExperienceEntry) {
    setAdding(false);
    setDraft(draftFromEntry(entry));
    setEditingId(entry.id);
  }

  function handleSave(id: string) {
    if (!draftIsValid(draft)) return;
    updateExperienceEntry(id, {
      title: draft.title.trim(),
      company: draft.company.trim(),
      start: draft.start.trim(),
      end: draft.end.trim(),
      bullets: [draft.bulletOne.trim(), draft.bulletTwo.trim()],
    });
    setEditingId(null);
  }

  function startAdding() {
    setEditingId(null);
    setAddDraft(draftFromEntry());
    setAdding(true);
  }

  function handleAddSave() {
    if (!draftIsValid(addDraft)) return;
    addExperienceEntry({
      id: makeId("exp"),
      title: addDraft.title.trim(),
      company: addDraft.company.trim(),
      start: addDraft.start.trim(),
      end: addDraft.end.trim(),
      bullets: [addDraft.bulletOne.trim(), addDraft.bulletTwo.trim()],
    });
    setAdding(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Experience</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" onClick={startAdding}>
            <Plus className="size-3.5" />
            Add role
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {adding ? (
          <EntryForm
            draft={addDraft}
            onChange={setAddDraft}
            onSave={handleAddSave}
            onCancel={() => setAdding(false)}
          />
        ) : null}

        {experience.map((entry, index) => (
          <div key={entry.id}>
            {editingId === entry.id ? (
              <EntryForm
                draft={draft}
                onChange={setDraft}
                onSave={() => handleSave(entry.id)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {entry.title} · {entry.company}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {entry.start} to {entry.end}
                    </span>
                  </div>
                  <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                    {entry.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${entry.company} role`}
                  onClick={() => startEditing(entry)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            )}
            {index < experience.length - 1 && editingId !== entry.id ? <Separator className="mt-3" /> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EntryForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Role title"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
        <Input
          placeholder="Company"
          value={draft.company}
          onChange={(event) => onChange({ ...draft, company: event.target.value })}
        />
        <Input
          placeholder="Start, for example Apr 2023"
          value={draft.start}
          onChange={(event) => onChange({ ...draft, start: event.target.value })}
        />
        <Input
          placeholder="End, for example Present"
          value={draft.end}
          onChange={(event) => onChange({ ...draft, end: event.target.value })}
        />
      </div>
      <Textarea
        rows={2}
        placeholder="First impact bullet"
        value={draft.bulletOne}
        onChange={(event) => onChange({ ...draft, bulletOne: event.target.value })}
      />
      <Textarea
        rows={2}
        placeholder="Second impact bullet"
        value={draft.bulletTwo}
        onChange={(event) => onChange({ ...draft, bulletTwo: event.target.value })}
      />
      <div className="flex gap-1.5">
        <Button size="sm" disabled={!draftIsValid(draft)} onClick={onSave}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
