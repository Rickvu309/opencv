"use client";

import { Check, X } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function TrackRecordPage() {
  useCopilotSurface("Track Record");
  const { state, confirmTrackRecordCandidate, dismissTrackRecordCandidate } = useStore();

  const candidates = state.trackRecordEntries.filter((entry) => entry.status === "candidate");
  const confirmed = [...state.trackRecordEntries.filter((entry) => entry.status === "confirmed")].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  function skillNames(skillIds: string[]) {
    return skillIds
      .map((id) => state.skills.find((skill) => skill.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Track Record"
        description={`${confirmed.length} confirmed entries, ${candidates.length} drafted candidates to review.`}
      />

      <div className="flex flex-col gap-6 p-6">
        {candidates.length > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2>Drafted candidates</h2>
              <CopilotTag />
            </div>
            <div className="flex flex-col gap-2">
              {candidates.map((entry) => (
                <Card key={entry.id} className="ring-foreground/8">
                  <CardContent className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary">{entry.evidenceTag}</Badge>
                        <span className="text-xs text-muted-foreground">{entry.date}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{entry.title}</p>
                      <p className="text-sm text-muted-foreground">{entry.story}</p>
                      <p className="text-xs text-muted-foreground">{entry.impact}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        aria-label="Confirm candidate"
                        onClick={() => confirmTrackRecordCandidate(entry.id)}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Dismiss candidate"
                        onClick={() => dismissTrackRecordCandidate(entry.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2>Confirmed</h2>
          {confirmed.length === 0 ? (
            <EmptyState message="No confirmed entries yet. Confirm a drafted candidate above, or add one manually." />
          ) : (
            <div className="flex flex-col gap-2">
              {confirmed.map((entry) => (
                <Card key={entry.id} className="ring-foreground/8">
                  <CardContent className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary">{entry.evidenceTag}</Badge>
                      <span className="text-xs text-muted-foreground">{entry.date}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{entry.title}</p>
                    <p className="text-sm text-muted-foreground">{entry.story}</p>
                    <p className="text-xs text-muted-foreground">{entry.impact}</p>
                    {entry.skillIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {skillNames(entry.skillIds).map((name) => (
                          <Badge key={name} variant="outline">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
