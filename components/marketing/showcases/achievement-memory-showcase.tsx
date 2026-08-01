"use client";

import { useState } from "react";
import { ArrowDown } from "lucide-react";

import { RewindCandidateCard } from "@/components/rewind/candidate-card";
import { TrackRecordEntryCard } from "@/components/track-record/entry-card";
import { useStore } from "@/lib/store";

/**
 * Signature workflow 3: Rewind's weekly review turning real activity into
 * durable career memory. Pairs a real "worth keeping" review card (the
 * capture step) with a real, highlighted, confirmed Track Record entry
 * (the memory that lasts), the same two moments docs/architecture.md
 * section 4's flow 9 and flow 7 describe, connected by one quiet arrow
 * rather than a claim that these two specific objects are the same one.
 */
export function AchievementMemoryShowcase() {
  const { state } = useStore();
  const [expanded, setExpanded] = useState(true);

  const candidate = state.rewindCandidates.find((c) => c.id === "rewind-candidate-1");
  const entry = state.trackRecordEntries.find((e) => e.id === "tre-1");

  if (!candidate || !entry) return null;

  return (
    <div className="flex w-[760px] flex-col items-center gap-2 p-5">
      <RewindCandidateCard candidate={candidate} skills={state.skills} />
      <ArrowDown className="size-4 shrink-0 text-muted-foreground" />
      <TrackRecordEntryCard
        entry={entry}
        skills={state.skills}
        cvVersions={state.cvVersions}
        opportunities={state.opportunities}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        highlighted
      />
    </div>
  );
}
