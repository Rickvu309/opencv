"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingData } from "@/components/onboarding/onboarding-data";
import {
  COMPANY_SIZE_OPTIONS,
  NEAR_TERM_PRIORITY_OPTIONS,
  TARGET_DIRECTION_OPTIONS,
  WORK_STYLE_OPTIONS,
} from "@/components/onboarding/onboarding-data";
import { SelectableChip } from "@/components/onboarding/selectable-chip";

export interface DirectionStepProps {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
}

export function DirectionStep({ data, onChange }: DirectionStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1>Direction</h1>
        <p className="text-sm text-muted-foreground">
          This is what Copilot judges every opportunity against.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Target direction</Label>
        <div className="flex flex-wrap gap-1.5">
          {TARGET_DIRECTION_OPTIONS.map((option) => (
            <SelectableChip
              key={option}
              label={option}
              selected={data.targetDirectionLabel === option}
              onClick={() => onChange({ targetDirectionLabel: option })}
            />
          ))}
        </div>
        <Input
          placeholder="Or describe your own direction"
          value={data.targetDirectionLabel}
          onChange={(event) => onChange({ targetDirectionLabel: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Work preference</Label>
          <div className="flex flex-wrap gap-1.5">
            {WORK_STYLE_OPTIONS.map((option) => (
              <SelectableChip
                key={option}
                label={option}
                selected={data.workStyle === option}
                onClick={() => onChange({ workStyle: option })}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Company size</Label>
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_SIZE_OPTIONS.map((option) => (
              <SelectableChip
                key={option}
                label={option}
                selected={data.companySize === option}
                onClick={() => onChange({ companySize: option })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Near-term priority</Label>
        <div className="flex flex-wrap gap-1.5">
          {NEAR_TERM_PRIORITY_OPTIONS.map((option) => (
            <SelectableChip
              key={option}
              label={option}
              selected={data.nearTermPriority === option}
              onClick={() => onChange({ nearTermPriority: option })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
