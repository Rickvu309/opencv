import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ClaimStateChip } from "@/components/proof/claim-state-chip";
import { TrackRecordEvidenceChip } from "@/components/proof/track-record-evidence-chip";
import { CLAIM_STATE_LABEL, groupClaimVerificationsByState } from "@/lib/proof-utils";
import type { ClaimVerification, TrackRecordEntry } from "@/lib/types";

interface ProofClaimVerificationProps {
  verifications: ClaimVerification[];
  trackRecordEntries: TrackRecordEntry[];
}

/**
 * Section 4, the trust core: every existing CV or profile claim, grouped by
 * verification state, strongest group first (Miller's Law chunking). The
 * note stays supportive, never judgmental: "would land harder with" rather
 * than "missing" or "weak."
 */
export function ProofClaimVerification({ verifications, trackRecordEntries }: ProofClaimVerificationProps) {
  if (verifications.length === 0) {
    return <EmptyState message="No claims to verify for this context yet." />;
  }

  const groups = groupClaimVerificationsByState(verifications);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.state} className="flex flex-col gap-2">
          <span className="text-section-label">
            {CLAIM_STATE_LABEL[group.state]} ({group.items.length})
          </span>
          <div className="flex flex-col gap-2">
            {group.items.map((verification) => {
              const backingEntries = verification.backingEntryIds
                .map((id) => trackRecordEntries.find((entry) => entry.id === id))
                .filter((entry): entry is TrackRecordEntry => Boolean(entry));
              return (
                <Card key={verification.claim.id} className="ring-foreground/8">
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm text-foreground">{verification.claim.text}</p>
                      <ClaimStateChip state={verification.state} className="shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground">{verification.note}</p>
                    {backingEntries.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {backingEntries.map((entry) => (
                          <TrackRecordEvidenceChip key={entry.id} entry={entry} />
                        ))}
                      </div>
                    ) : null}
                    {verification.proposedCaptureLabel ? (
                      <Link
                        href="/track-record"
                        className="w-fit text-xs font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {verification.proposedCaptureLabel}
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
