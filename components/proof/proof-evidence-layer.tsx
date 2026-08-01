"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ProofStrengthChip } from "@/components/proof/proof-strength-chip";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ProofEvidenceRanking } from "@/lib/types";

interface EvidenceCardProps {
  ranking: ProofEvidenceRanking;
  highlighted: boolean;
}

function EvidenceCard({ ranking, highlighted }: EvidenceCardProps) {
  const { entry, strength, whyStrength, couldBeStronger } = ranking;
  const { setTrackRecordHighlight } = useStore();
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  return (
    <Card ref={cardRef} className={cn("ring-foreground/8 transition-colors", highlighted && "ring-2 ring-primary")}>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
            <p className="text-xs text-muted-foreground">{entry.impact}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ProofStrengthChip strength={strength} />
            <span className="text-xs text-muted-foreground">{entry.date}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-fit items-center gap-1 rounded text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
        >
          Why this strength
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
        {open ? <p className="text-xs text-muted-foreground">{whyStrength}</p> : null}
      </CardHeader>
      {couldBeStronger ? (
        <CardContent className="border-t border-border pt-2.5">
          <Link
            href="/track-record"
            onClick={() => setTrackRecordHighlight(entry.id)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Could be stronger with an impact number or evidence reference. Edit in Track Record.
          </Link>
        </CardContent>
      ) : null}
    </Card>
  );
}

interface ProofEvidenceLayerProps {
  rankings: ProofEvidenceRanking[];
  highlightedEntryId?: string;
}

/**
 * Section 3, the evidence layer: every confirmed entry ranked strongest
 * first for the chosen context, each carrying a labeled strength chip with
 * an expandable why (Progressive Disclosure) and a quiet "could be
 * stronger" hint where an entry is missing both an impact number and an
 * evidence reference.
 */
export function ProofEvidenceLayer({ rankings, highlightedEntryId }: ProofEvidenceLayerProps) {
  if (rankings.length === 0) {
    return <EmptyState message="No confirmed Track Record entries yet. Confirm one to start building proof from it." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {rankings.map((ranking) => (
        <EvidenceCard key={ranking.entry.id} ranking={ranking} highlighted={highlightedEntryId === ranking.entry.id} />
      ))}
    </div>
  );
}
