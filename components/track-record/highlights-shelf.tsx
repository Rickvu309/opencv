"use client";

import { useState } from "react";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { TrackRecordEntryCard } from "@/components/track-record/entry-card";
import type { CvVersion, Opportunity, Skill, TrackRecordEntry } from "@/lib/types";

interface HighlightsShelfProps {
  entries: TrackRecordEntry[];
  skills: Skill[];
  cvVersions: CvVersion[];
  opportunities: Opportunity[];
}

/**
 * Track Record's memory reel: highlight-flagged achievements on top of the
 * page, the same distinctive achievement card every confirmed entry uses
 * once it carries the new depth, just given the front-row treatment
 * (Peak-End: the highlight reel, not the raw timeline, is what should stick).
 */
export function HighlightsShelf({ entries, skills, cvVersions, opportunities }: HighlightsShelfProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const highlights = entries.filter((entry) => entry.highlight);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>Highlights</h2>
        <CopilotTag />
      </div>
      {highlights.length === 0 ? (
        <EmptyState message="No highlighted achievements yet. Saving a candidate from Rewind adds one here." />
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {highlights.map((entry) => (
            <TrackRecordEntryCard
              key={entry.id}
              entry={entry}
              skills={skills}
              cvVersions={cvVersions}
              opportunities={opportunities}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
