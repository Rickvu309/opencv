import type { Priority } from "@/lib/types";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<Priority, keyof typeof CHIP_TONES> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  High: "High priority",
  Medium: "Medium priority",
  Low: "Low priority",
};

export function PriorityChip({ priority, className }: { priority: Priority; className?: string }) {
  const tone = CHIP_TONES[PRIORITY_TONE[priority]];
  return (
    <Chip
      label={PRIORITY_LABEL[priority]}
      dotClassName={tone.dot}
      className={cn(tone.className, className)}
    />
  );
}
