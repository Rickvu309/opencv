import type { EmailEvidence } from "@/lib/types";

/**
 * The expandable extract behind an EvidenceChip: subject line plus the
 * short quoted extract, so nothing an AI proposal relies on stays hidden.
 */
export function EvidenceExtract({ evidence }: { evidence: EmailEvidence }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs font-medium text-foreground">{evidence.subject}</p>
      <p className="mt-1 text-xs text-muted-foreground">&ldquo;{evidence.extract}&rdquo;</p>
    </div>
  );
}
