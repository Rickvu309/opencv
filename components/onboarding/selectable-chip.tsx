import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface SelectableChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Toggleable chip used across onboarding steps for single and multi
 * select choices (experience level, direction, work style, strengths).
 * Built on the shared Badge primitive so selection states still read as
 * chips, matching the fit, status, and priority chip system.
 */
export function SelectableChip({ label, selected, onClick, className }: SelectableChipProps) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="focus-visible:outline-none">
      <Badge
        variant={selected ? "default" : "outline"}
        className={cn(
          "cursor-pointer gap-1 px-2.5 py-1 text-xs transition-colors",
          !selected && "hover:bg-muted",
          className
        )}
      >
        {selected ? <Check className="size-3" /> : null}
        {label}
      </Badge>
    </button>
  );
}
