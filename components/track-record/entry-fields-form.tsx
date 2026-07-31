"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SelectableChip } from "@/components/onboarding/selectable-chip";
import { EVIDENCE_TAGS } from "@/lib/data/track-record";
import type { Skill } from "@/lib/types";

export interface EntryDraft {
  title: string;
  date: string;
  story: string;
  impact: string;
  evidenceTag: string;
  skillIds: string[];
}

interface EntryFieldsFormProps {
  draft: EntryDraft;
  skills: Skill[];
  onChange: (patch: Partial<EntryDraft>) => void;
}

/**
 * The structured field set shared by the manual "Add entry" dialog and the
 * candidate confirm dialog: title, when, story, impact with a number,
 * evidence tag, and skill chips pulled from the skill list.
 */
export function EntryFieldsForm({ draft, skills, onChange }: EntryFieldsFormProps) {
  function toggleSkill(id: string) {
    const next = draft.skillIds.includes(id)
      ? draft.skillIds.filter((skillId) => skillId !== id)
      : [...draft.skillIds, id];
    onChange({ skillIds: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tre-title">Title</Label>
          <Input
            id="tre-title"
            value={draft.title}
            placeholder="Shipped the onboarding redesign"
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tre-date">When</Label>
          <Input
            id="tre-date"
            type="date"
            value={draft.date}
            onChange={(event) => onChange({ date: event.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tre-story">Story</Label>
        <Textarea
          id="tre-story"
          rows={4}
          value={draft.story}
          placeholder="What was the situation, and what did you do about it?"
          onChange={(event) => onChange({ story: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tre-impact">Impact</Label>
        <Input
          id="tre-impact"
          value={draft.impact}
          placeholder="Cut onboarding drop-off by 18 percent"
          onChange={(event) => onChange({ impact: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Evidence tag</Label>
        <Select value={draft.evidenceTag} onValueChange={(value) => onChange({ evidenceTag: value })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose an evidence tag" />
          </SelectTrigger>
          <SelectContent>
            {EVIDENCE_TAGS.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Skills</Label>
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <SelectableChip
              key={skill.id}
              label={skill.name}
              selected={draft.skillIds.includes(skill.id)}
              onClick={() => toggleSkill(skill.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
