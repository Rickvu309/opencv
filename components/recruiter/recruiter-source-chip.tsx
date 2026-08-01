import { Users, Inbox, Radar } from "lucide-react";

import type { RecruiterSource } from "@/lib/types";
import { Chip } from "@/components/shared/chip";
import { cn } from "@/lib/utils";

// Source is a category tag, not a status judgment, so it stays on the plain
// muted surface rather than borrowing one of the 4 reserved status tones
// (docs/design.md section 1): nothing here is "good" or "bad" in itself.
const SOURCE_ICON: Record<RecruiterSource, typeof Users> = {
  Referral: Users,
  Inbound: Inbox,
  Sourced: Radar,
};

export function RecruiterSourceChip({ source, className }: { source: RecruiterSource; className?: string }) {
  const Icon = SOURCE_ICON[source];
  return (
    <Chip
      label={source}
      icon={<Icon className="size-3" />}
      className={cn("bg-muted text-muted-foreground", className)}
    />
  );
}
