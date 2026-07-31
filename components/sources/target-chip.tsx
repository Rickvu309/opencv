import { Briefcase, History, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Chip } from "@/components/shared/chip";
import { cn } from "@/lib/utils";
import type { SourceEvidenceMapsToType } from "@/lib/types";

const TARGET_ICON: Record<SourceEvidenceMapsToType, LucideIcon> = {
  opportunity: Briefcase,
  trackRecord: History,
  goal: Target,
};

/**
 * The small chip naming what an inbox item is suggested to belong to, or
 * what it has already been linked to: an opportunity, Track Record
 * material, or a goal. Shared between the inbox row (suggested target) and
 * the settled linked state (actual target), so the same visual language
 * carries through the whole link flow.
 */
export function TargetChip({
  type,
  label,
  className,
}: {
  type: SourceEvidenceMapsToType;
  label: string;
  className?: string;
}) {
  const Icon = TARGET_ICON[type];
  return (
    <Chip label={label} icon={<Icon className="size-3" />} className={cn("bg-muted text-foreground", className)} />
  );
}
