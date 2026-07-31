import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";
import type { ConnectedSourceStatus } from "@/lib/types";

const SOURCE_STATUS_TONE: Record<ConnectedSourceStatus, keyof typeof CHIP_TONES> = {
  connected: "success",
  "needs-attention": "warning",
  "not-connected": "muted",
};

const SOURCE_STATUS_LABEL: Record<ConnectedSourceStatus, string> = {
  connected: "Connected",
  "needs-attention": "Needs attention",
  "not-connected": "Not connected",
};

export function SourceStatusChip({ status, className }: { status: ConnectedSourceStatus; className?: string }) {
  const tone = CHIP_TONES[SOURCE_STATUS_TONE[status]];
  return (
    <Chip
      label={SOURCE_STATUS_LABEL[status]}
      dotClassName={tone.dot}
      className={cn(tone.className, className)}
    />
  );
}
