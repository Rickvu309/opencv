"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Link2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EvidenceChip } from "@/components/ai/evidence-chip";
import { EvidenceExtract } from "@/components/ai/evidence-extract";
import { SaveBackConfirmation } from "@/components/ai/save-back-confirmation";
import { LinkTargetPickerDialog } from "@/components/sources/link-target-picker-dialog";
import { TargetChip } from "@/components/sources/target-chip";
import { evidenceTitle, freshnessLabel } from "@/lib/inbox-utils";
import type { InboxItem } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";
import type { InboxLinkTarget } from "@/lib/types";

function targetHref(target: InboxLinkTarget): string {
  if (target.type === "opportunity") return `/opportunities/${target.id}#overview`;
  if (target.type === "goal") return "/goals";
  return "/track-record";
}

function suggestedLinkLabel(evidence: InboxItem["evidence"]): string {
  return evidence.mapsToType === "trackRecord" ? "Link as track record material" : `Link to ${evidence.mapsToLabel}`;
}

/**
 * One row in the synced-context inbox: the five-beat pattern's evidence and
 * save-back primitives (EvidenceChip, EvidenceExtract, SaveBackConfirmation)
 * composed into the different shape this workflow needs, a suggested link
 * target plus Link, a picker for a different target, Open, and Not relevant,
 * rather than Approve, Edit, Dismiss.
 */
export function InboxItemCard({ item }: { item: InboxItem }) {
  const { linkInboxItem, undoLinkInboxItem, dismissInboxItem, setGoalHighlight } = useStore();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const { evidence, source, status, linkedTarget } = item;

  function handleAcceptSuggested() {
    if (evidence.mapsToType === "trackRecord") {
      linkInboxItem(evidence, { type: "trackRecord" });
    } else {
      linkInboxItem(evidence, { type: evidence.mapsToType, id: evidence.mapsToId, label: evidence.mapsToLabel });
    }
  }

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-2.5">
        <span className="text-xs text-muted-foreground">
          {source.name}, {freshnessLabel(evidence.freshnessMinutesAgo)}
        </span>

        <div className="flex flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-foreground">{evidenceTitle(evidence)}</p>
          <p className="truncate text-sm text-foreground">{evidence.signal}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setEvidenceOpen((current) => !current)}
            className="flex w-fit items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={evidenceOpen}
          >
            <EvidenceChip evidence={evidence} />
            {evidenceOpen ? (
              <ChevronUp className="size-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3 text-muted-foreground" />
            )}
          </button>
          {evidenceOpen ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{evidence.whyItMatters}</p>
              <EvidenceExtract evidence={evidence} />
            </div>
          ) : null}
        </div>

        {status === "linked" && linkedTarget ? (
          <>
            <TargetChip type={linkedTarget.type} label={linkedTarget.label} className="w-fit" />
            <SaveBackConfirmation
              message={`Linked to ${linkedTarget.label} as evidence.`}
              onUndo={() => undoLinkInboxItem(evidence.id)}
            />
            <div className="flex items-center gap-1.5">
              <Button asChild size="sm" variant="outline">
                <Link
                  href={targetHref(linkedTarget)}
                  onClick={() => {
                    if (linkedTarget.type === "goal") setGoalHighlight(linkedTarget.id);
                  }}
                >
                  Open
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <TargetChip
                type={evidence.mapsToType}
                label={evidence.mapsToType === "trackRecord" ? "Track record material" : evidence.mapsToLabel}
              />
              {evidence.hedge ? <span className="text-xs text-muted-foreground">{evidence.hedge}</span> : null}
            </div>

            <p className="text-xs text-muted-foreground">{evidence.usesNext}</p>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" onClick={handleAcceptSuggested}>
                <Link2 className="size-3.5" />
                {suggestedLinkLabel(evidence)}
              </Button>
              <LinkTargetPickerDialog evidence={evidence}>
                <Button size="sm" variant="outline">
                  Choose different
                </Button>
              </LinkTargetPickerDialog>
              <Button size="sm" variant="outline" disabled>
                Open
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismissInboxItem(evidence.id)}>
                <X className="size-3.5" />
                Not relevant
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
