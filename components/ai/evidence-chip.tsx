import { Mail } from "lucide-react";

import { Chip } from "@/components/shared/chip";
import { connectedSources } from "@/lib/data/sources";
import { cn } from "@/lib/utils";
import type { EmailEvidence } from "@/lib/types";

/**
 * The source chip every AI proposal that cites a source shows: "Email,
 * Sarah Nguyen, 2h ago". Purely presentational, the expand affordance and
 * the EvidenceExtract it reveals live in the caller (AiActionCard).
 */
export function EvidenceChip({ evidence, className }: { evidence: EmailEvidence; className?: string }) {
  const source = connectedSources.find((entry) => entry.id === evidence.sourceId);
  const label = `${source?.name ?? "Email"}, ${evidence.sender}, ${evidence.timestamp}`;

  return (
    <Chip
      label={label}
      icon={<Mail className="size-3" />}
      className={cn("bg-muted text-foreground", className)}
    />
  );
}
