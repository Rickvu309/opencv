"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Clock, Pencil, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EvidenceChip } from "@/components/ai/evidence-chip";
import { EvidenceExtract } from "@/components/ai/evidence-extract";
import { SelectableChip } from "@/components/onboarding/selectable-chip";
import { findEvidenceById } from "@/lib/inbox-utils";
import { buildAchievementEntry } from "@/lib/rewind-utils";
import { useStore } from "@/lib/store";
import type { RewindCandidate, RewindProposedAchievement, Skill, SourceEvidence } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RewindCandidateCardProps {
  candidate: RewindCandidate;
  skills: Skill[];
}

/**
 * One "Worth keeping" review card: a strict three-part anatomy, visually
 * separated (Proximity: evidence beside meaning beside action). Observed is
 * the activity and its evidence chips, expandable to the full extract. Read
 * is Copilot's one-line, tagged interpretation. Proposed is the drafted
 * achievement, editable in full before Save writes it as a TrackRecordEntry.
 * Once resolved (saved, dismissed, or deferred) the card settles into a
 * quiet row rather than disappearing, so review progress stays visible.
 */
export function RewindCandidateCard({ candidate, skills }: RewindCandidateCardProps) {
  const { saveRewindCandidate, dismissRewindCandidate, deferRewindCandidate, resetRewindCandidate } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<RewindProposedAchievement>(candidate.proposed);
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState<Set<string>>(new Set());

  const evidenceItems = candidate.observed.evidenceIds
    .map((id) => findEvidenceById(id))
    .filter((item): item is SourceEvidence => Boolean(item));

  function toggleEvidence(id: string) {
    setExpandedEvidenceIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSkill(id: string) {
    setDraft((current) => ({
      ...current,
      skillIds: current.skillIds.includes(id)
        ? current.skillIds.filter((skillId) => skillId !== id)
        : [...current.skillIds, id],
    }));
  }

  function handleSave() {
    saveRewindCandidate(candidate.id, buildAchievementEntry(candidate, draft));
  }

  if (candidate.state !== "pending") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          {candidate.state === "saved" ? (
            <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : candidate.state === "deferred" ? (
            <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <X className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {candidate.state === "saved"
              ? `Saved: ${draft.title}`
              : candidate.state === "deferred"
                ? "Deferred to next week's Rewind."
                : "Not this one."}
          </p>
        </div>
        {candidate.state === "saved" ? (
          <Link href="/track-record" className="shrink-0 text-xs font-medium text-foreground underline-offset-2 hover:underline">
            Open Track Record
          </Link>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => resetRewindCandidate(candidate.id)}>
            Undo
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-section-label">Observed</p>
          <p className="text-sm text-foreground">{candidate.observed.activityLine}</p>
          {evidenceItems.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1.5">
                {evidenceItems.map((evidence) => (
                  <button
                    key={evidence.id}
                    type="button"
                    onClick={() => toggleEvidence(evidence.id)}
                    className="flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-expanded={expandedEvidenceIds.has(evidence.id)}
                  >
                    <EvidenceChip evidence={evidence} />
                    {expandedEvidenceIds.has(evidence.id) ? (
                      <ChevronUp className="size-3 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-3 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
              {evidenceItems
                .filter((evidence) => expandedEvidenceIds.has(evidence.id))
                .map((evidence) => (
                  <EvidenceExtract key={evidence.id} evidence={evidence} />
                ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <p className="text-section-label">Read</p>
            <CopilotTag />
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="mt-0.5 shrink-0">
              {candidate.read.tag}
            </Badge>
            <p className="text-sm text-foreground">{candidate.read.interpretation}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-md border border-dashed border-border bg-muted/20 p-3">
          <p className="text-section-label">Proposed</p>

          {isEditing ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${candidate.id}-title`}>Title</Label>
                <Input
                  id={`${candidate.id}-title`}
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${candidate.id}-impact`}>Impact</Label>
                <Textarea
                  id={`${candidate.id}-impact`}
                  rows={2}
                  value={draft.impactLine}
                  onChange={(event) => setDraft((current) => ({ ...current, impactLine: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${candidate.id}-path-relevance`}>Path relevance</Label>
                <Textarea
                  id={`${candidate.id}-path-relevance`}
                  rows={2}
                  value={draft.pathRelevance}
                  onChange={(event) => setDraft((current) => ({ ...current, pathRelevance: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill) => (
                    <SelectableChip
                      key={skill.id}
                      label={skill.name}
                      selected={draft.skillIds.includes(skill.id)}
                      onClick={() => toggleSkill(skill.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">{draft.title}</p>
              <p className="text-sm text-muted-foreground">{draft.impactLine}</p>
              <div className="flex flex-wrap gap-1.5">
                {draft.skillIds.map((skillId) => {
                  const skill = skills.find((entry) => entry.id === skillId);
                  return skill ? (
                    <Badge key={skillId} variant="outline">
                      {skill.name}
                    </Badge>
                  ) : null;
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Ties to: </span>
                {draft.pathRelevance}
              </p>
            </div>
          )}
        </div>

        <div className={cn("flex items-center gap-1.5")}>
          <Button size="sm" onClick={handleSave}>
            <Check className="size-3.5" />
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsEditing((current) => !current)}>
            <Pencil className="size-3.5" />
            {isEditing ? "Done editing" : "Edit"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => dismissRewindCandidate(candidate.id)}>
            <X className="size-3.5" />
            Not this one
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deferRewindCandidate(candidate.id)}>
            <Clock className="size-3.5" />
            Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
