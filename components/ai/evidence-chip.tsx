import { Mail, NotebookText } from "lucide-react";

import { Chip } from "@/components/shared/chip";
import { connectedSources } from "@/lib/data/sources";
import { evidenceWho } from "@/lib/inbox-utils";
import { cn } from "@/lib/utils";
import type { SourceEvidence } from "@/lib/types";

/**
 * The source chip every AI proposal or inbox item that cites a source
 * shows: "Gmail, Jordan Ellis, 2h ago" for an email, "Granola, Prep call
 * with Linh Vu, 3h ago" for a meeting note. Purely presentational, the
 * expand affordance and the EvidenceExtract it reveals live in the caller.
 */
export function EvidenceChip({ evidence, className }: { evidence: SourceEvidence; className?: string }) {
  const source = connectedSources.find((entry) => entry.id === evidence.sourceId);
  const label = `${source?.name ?? "Source"}, ${evidenceWho(evidence)}, ${evidence.timestamp}`;
  const icon = evidence.kind === "email" ? <Mail className="size-3" /> : <NotebookText className="size-3" />;

  return <Chip label={label} icon={icon} className={cn("bg-muted text-foreground", className)} />;
}
