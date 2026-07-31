import { Gauge } from "lucide-react";

import type { ConfidenceLevel } from "@/lib/types";
import { Chip } from "@/components/shared/chip";

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { className: string; label: string }> = {
  High: { className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", label: "High confidence" },
  Medium: { className: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300/80", label: "Medium confidence" },
  Low: { className: "bg-muted text-muted-foreground", label: "Low confidence" },
};

export function ConfidenceChip({ confidence, className }: { confidence: ConfidenceLevel; className?: string }) {
  const style = CONFIDENCE_STYLES[confidence];
  return (
    <Chip
      label={style.label}
      icon={<Gauge className="size-3" />}
      className={className ? `${style.className} ${className}` : style.className}
    />
  );
}
