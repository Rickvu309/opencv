"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CvVersion, Opportunity, ProofContext, ProofContextType } from "@/lib/types";

interface ProofContextPickerProps {
  context: ProofContext;
  onChange: (context: ProofContext) => void;
  cvVersions: CvVersion[];
  opportunities: Opportunity[];
  workingPathLabel: string;
}

const CONTEXT_TYPE_LABEL: Record<ProofContextType, string> = {
  cv: "For a CV version",
  profile: "For your profile",
  opportunity: "For an opportunity",
  path: "For your target path",
};

const CONTEXT_TYPES: ProofContextType[] = ["cv", "profile", "opportunity", "path"];

/**
 * Section 2, the session frame: which real object the evidence layer, claim
 * verification, and transformations below all read against. Switching here
 * never discards work, every transformation and claim's verification state
 * lives in the store, not on this page (Miller's Law: one context at a
 * time, never asking the user to reason about more than one object's proof
 * at once).
 */
export function ProofContextPicker({
  context,
  onChange,
  cvVersions,
  opportunities,
  workingPathLabel,
}: ProofContextPickerProps) {
  function handleTypeChange(type: ProofContextType) {
    if (type === "cv") onChange({ type, refId: cvVersions[0]?.id });
    else if (type === "opportunity") onChange({ type, refId: opportunities[0]?.id });
    else onChange({ type });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        value={context.type}
        onValueChange={(value) => value && handleTypeChange(value as ProofContextType)}
      >
        {CONTEXT_TYPES.map((type) => (
          <ToggleGroupItem key={type} value={type}>
            {CONTEXT_TYPE_LABEL[type]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {context.type === "cv" ? (
        <Select value={context.refId ?? ""} onValueChange={(value) => onChange({ type: "cv", refId: value })}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose a CV version" />
          </SelectTrigger>
          <SelectContent>
            {cvVersions.map((cv) => (
              <SelectItem key={cv.id} value={cv.id}>
                {cv.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {context.type === "opportunity" ? (
        <Select value={context.refId ?? ""} onValueChange={(value) => onChange({ type: "opportunity", refId: value })}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Choose an opportunity" />
          </SelectTrigger>
          <SelectContent>
            {opportunities.map((opportunity) => (
              <SelectItem key={opportunity.id} value={opportunity.id}>
                {opportunity.role} at {opportunity.company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {context.type === "path" ? <span className="text-sm text-muted-foreground">{workingPathLabel}</span> : null}
    </div>
  );
}
