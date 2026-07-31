"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { AddEntryDialog } from "@/components/track-record/add-entry-dialog";
import { CandidateCard } from "@/components/track-record/candidate-card";
import { ConfirmCandidateDialog } from "@/components/track-record/confirm-candidate-dialog";
import { TrackRecordEntryCard } from "@/components/track-record/entry-card";
import { CoverageRail } from "@/components/track-record/coverage-rail";
import { Button } from "@/components/ui/button";
import {
  countEntriesBySkillArea,
  findLinkedSkillAreas,
  groupEntriesByYear,
  matchesSkillArea,
} from "@/lib/track-record-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

const TRACK_RECORD_HIGHLIGHT_DURATION_MS = 2500;

export default function TrackRecordPage() {
  useCopilotSurface("Track Record");
  const { state, dismissTrackRecordCandidate, clearTrackRecordHighlight } = useStore();

  const [skillAreaFilter, setSkillAreaFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const highlightedId = state.highlightedTrackRecordEntryId;

  useEffect(() => {
    if (!highlightedId) return;
    const timeout = setTimeout(() => clearTrackRecordHighlight(highlightedId), TRACK_RECORD_HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [highlightedId, clearTrackRecordHighlight]);

  const candidates = state.trackRecordEntries.filter((entry) => entry.status === "candidate");
  const confirmed = state.trackRecordEntries.filter((entry) => entry.status === "confirmed");

  const linkedSkillAreas = useMemo(
    () => findLinkedSkillAreas(confirmed, state.skills),
    [confirmed, state.skills]
  );

  const filteredConfirmed = useMemo(
    () => confirmed.filter((entry) => matchesSkillArea(entry, skillAreaFilter, state.skills)),
    [confirmed, skillAreaFilter, state.skills]
  );

  const yearGroups = useMemo(() => groupEntriesByYear(filteredConfirmed), [filteredConfirmed]);
  const skillAreaCoverage = useMemo(
    () => countEntriesBySkillArea(confirmed, state.skills),
    [confirmed, state.skills]
  );

  return (
    <WorkspacePage
      title="Track Record"
      description={`${confirmed.length} confirmed ${confirmed.length === 1 ? "entry" : "entries"}, ${candidates.length} drafted ${candidates.length === 1 ? "candidate" : "candidates"} to review.`}
      primaryAction={
        <AddEntryDialog>
          <Button size="sm">
            <Plus className="size-4" />
            Add entry
          </Button>
        </AddEntryDialog>
      }
      rail={
        <CoverageRail
          confirmedCount={confirmed.length}
          candidateCount={candidates.length}
          coverage={skillAreaCoverage}
        />
      }
    >
      <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2>For your review</h2>
              <CopilotTag />
            </div>
            {candidates.length > 0 ? (
              <div className="flex flex-col gap-2">
                {candidates.map((entry) => (
                  <CandidateCard
                    key={entry.id}
                    entry={entry}
                    onDismiss={() => dismissTrackRecordCandidate(entry.id)}
                    reviewAction={
                      <ConfirmCandidateDialog entry={entry}>
                        <Button size="sm">
                          <Check className="size-3.5" />
                          Review and confirm
                        </Button>
                      </ConfirmCandidateDialog>
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="Nothing drafted for review right now. Copilot will surface new candidates from recent activity." />
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2>Confirmed timeline</h2>

            {confirmed.length === 0 ? (
              <EmptyState message="No confirmed entries yet. Confirm a drafted candidate above, or add one manually." />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={skillAreaFilter === "all" ? "secondary" : "outline"}
                    aria-pressed={skillAreaFilter === "all"}
                    onClick={() => setSkillAreaFilter("all")}
                  >
                    All
                  </Button>
                  {linkedSkillAreas.map((area) => (
                    <Button
                      key={area}
                      size="sm"
                      variant={skillAreaFilter === area ? "secondary" : "outline"}
                      aria-pressed={skillAreaFilter === area}
                      onClick={() => setSkillAreaFilter(area)}
                    >
                      {area}
                    </Button>
                  ))}
                </div>

                {yearGroups.length === 0 ? (
                  <EmptyState message="No entries in this skill area yet. Try a different filter above." />
                ) : (
                  <div className="flex flex-col gap-5">
                    {yearGroups.map((group) => (
                      <div key={group.year} className="flex flex-col gap-2">
                        <h3 className="text-xs font-semibold text-muted-foreground">{group.year}</h3>
                        <div className="flex flex-col gap-2">
                          {group.entries.map((entry) => (
                            <TrackRecordEntryCard
                              key={entry.id}
                              entry={entry}
                              skills={state.skills}
                              cvVersions={state.cvVersions}
                              opportunities={state.opportunities}
                              expanded={expandedId === entry.id || highlightedId === entry.id}
                              highlighted={highlightedId === entry.id}
                              onToggle={() =>
                                setExpandedId((current) => (current === entry.id ? null : entry.id))
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
      </div>
    </WorkspacePage>
  );
}
