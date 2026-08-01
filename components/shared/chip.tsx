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
 * chip type supplies. The label lives in its own shrinkable span rather
 * than as a bare text node: `text-overflow: ellipsis` doesn't reliably
 * apply to a flex container's raw text child (the dot and the text become
 * separate anonymous flex items with no individual overflow box), so a
 * chip squeezed narrower than its label just hard-clips with no "…" and
 * the dot can visually collide with the text. Giving the label its own
 * `min-w-0 truncate` span fixes that wherever a chip ends up in a
 * genuinely narrow container (the comparison grid's cells); it's a no-op
 * everywhere else since nothing else constrains a chip's width.
 */
export function Chip({ label, className, dotClassName, icon }: ChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border-transparent font-medium", className)}
    >
      {icon ? icon : dotClassName ? <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} /> : null}
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  );
}
