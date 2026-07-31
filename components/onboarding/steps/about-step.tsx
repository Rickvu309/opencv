"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { persona } from "@/lib/data/persona";
import type { OnboardingData } from "@/components/onboarding/onboarding-data";
import { EXPERIENCE_LEVEL_OPTIONS } from "@/components/onboarding/onboarding-data";
import { SelectableChip } from "@/components/onboarding/selectable-chip";

export interface AboutStepProps {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onUseExample: () => void;
}

export function AboutStep({ data, onChange, onUseExample }: AboutStepProps) {
  const [strengthDraft, setStrengthDraft] = useState("");

  const suggestedStrengths = persona.strengths.filter((strength) => !data.strengths.includes(strength));

  function toggleStrength(strength: string) {
    if (data.strengths.includes(strength)) {
      onChange({ strengths: data.strengths.filter((item) => item !== strength) });
    } else {
      onChange({ strengths: [...data.strengths, strength] });
    }
  }

  function addCustomStrength() {
    const trimmed = strengthDraft.trim();
    if (!trimmed || data.strengths.includes(trimmed)) return;
    onChange({ strengths: [...data.strengths, trimmed] });
    setStrengthDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1>About you</h1>
          <p className="text-sm text-muted-foreground">
            Copilot uses this to judge fit and write next actions in your voice.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onUseExample}>
          <Sparkles className="size-4" />
          Use example profile
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-role">Current role</Label>
          <Input
            id="current-role"
            placeholder="For example, Senior Product Designer"
            value={data.currentRole}
            onChange={(event) => onChange({ currentRole: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="For example, Ho Chi Minh City, Vietnam"
            value={data.location}
            onChange={(event) => onChange({ location: event.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Experience level</Label>
        <div className="flex flex-wrap gap-1.5">
          {EXPERIENCE_LEVEL_OPTIONS.map((level) => (
            <SelectableChip
              key={level}
              label={level}
              selected={data.experienceLevel === level}
              onClick={() => onChange({ experienceLevel: level })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Strengths</Label>
        <div className="flex flex-wrap gap-1.5">
          {data.strengths.map((strength) => (
            <SelectableChip
              key={strength}
              label={strength}
              selected
              onClick={() => toggleStrength(strength)}
            />
          ))}
          {suggestedStrengths.map((strength) => (
            <SelectableChip
              key={strength}
              label={strength}
              selected={false}
              onClick={() => toggleStrength(strength)}
            />
          ))}
        </div>
        <div className="flex gap-1.5 pt-1">
          <Input
            placeholder="Add a strength Copilot should know about"
            value={strengthDraft}
            onChange={(event) => setStrengthDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomStrength();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" aria-label="Add strength" onClick={addCustomStrength}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
