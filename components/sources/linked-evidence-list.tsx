"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { EvidenceChip } from "@/components/ai/evidence-chip";
import { EvidenceExtract } from "@/components/ai/evidence-extract";
import type { InboxItem } from "@/lib/inbox-utils";

/**
 * The read-only trail an object's own surface shows once one or more
 * synced-context inbox items are linked to it: the signal that made it
 * worth linking, plus the same expandable EvidenceChip and EvidenceExtract
 * every other evidence surface uses, never hidden grounding. Shared between
 * the opportunity Overview Signals area and the Goal card.
 */
export function LinkedEvidenceList({ items }: { items: InboxItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <LinkedEvidenceRow key={item.evidence.id} item={item} />
      ))}
    </div>
  );
}

function LinkedEvidenceRow({ item }: { item: InboxItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-sm text-foreground">{item.evidence.signal}</p>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-fit items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <EvidenceChip evidence={item.evidence} />
        {open ? (
          <ChevronUp className="size-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3 text-muted-foreground" />
        )}
      </button>
      {open ? <EvidenceExtract evidence={item.evidence} /> : null}
    </div>
  );
}
