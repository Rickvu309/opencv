import { evidenceTitle } from "@/lib/inbox-utils";
import type { SourceEvidence } from "@/lib/types";

/**
 * The expandable extract behind an EvidenceChip: subject or meeting title
 * plus the short quoted extract, so nothing an AI proposal or inbox item
 * relies on stays hidden.
 */
export function EvidenceExtract({ evidence }: { evidence: SourceEvidence }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs font-medium text-foreground">{evidenceTitle(evidence)}</p>
      <p className="mt-1 text-xs text-muted-foreground">&ldquo;{evidence.extract}&rdquo;</p>
    </div>
  );
}
