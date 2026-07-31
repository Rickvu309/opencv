import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ChipProps {
  label: string;
  className?: string;
  dotClassName?: string;
  icon?: ReactNode;
}

/**
 * Shared visual primitive behind StatusChip, FitChip, PriorityChip, and
 * ConfidenceChip. Keeps one consistent chip anatomy: a small dot or icon
 * plus a label, with semantics carried entirely by the color mapping each
 * chip type supplies.
 */
export function Chip({ label, className, dotClassName, icon }: ChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border-transparent font-medium", className)}
    >
      {icon ? icon : dotClassName ? <span className={cn("size-1.5 rounded-full", dotClassName)} /> : null}
      {label}
    </Badge>
  );
}
