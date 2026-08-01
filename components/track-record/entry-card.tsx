"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Award, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EvidenceChip } from "@/components/ai/evidence-chip";
import { LinkChip } from "@/components/shared/link-chip";
import { findEvidenceById } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";
import type { CvVersion, Opportunity, Skill, SourceEvidence, TrackRecordEntry, TrackRecordUsedInRef } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EntryCardProps {
  entry: TrackRecordEntry;
  skills: Skill[];
  cvVersions: CvVersion[];
  opportunities: Opportunity[];
  expanded: boolean;
  onToggle: () => void;
  highlighted?: boolean;
}

/**
 * One confirmed timeline entry. Collapsed shows the scannable card anatomy
 * (title, impact, date, evidence tag, skill chips); expanding in place adds
 * the full story, the evidence note, where it's already been used, and the
 * Strengthens line, without navigating away from the timeline. When deep-linked
 * from a skill's evidence chip or a goal's aligned-item chip, `highlighted`
 * rings the card and scrolls it into view.
 */
export function TrackRecordEntryCard({
  entry,
  skills,
  cvVersions,
  opportunities,
  expanded,
  onToggle,
  highlighted,
}: EntryCardProps) {
  const { setTrackRecordHighlight } = useStore();
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);
  const linkedSkills = entry.skillIds
    .map((id) => skills.find((skill) => skill.id === id))
    .filter((skill): skill is Skill => Boolean(skill));
  const sourceEvidence = (entry.sourceRefs ?? [])
    .map((id) => findEvidenceById(id))
    .filter((item): item is SourceEvidence => Boolean(item));
  const isAchievement = Boolean(entry.highlight);

  function usedInHref(ref: TrackRecordUsedInRef) {
    return ref.kind === "cv" ? `/cvs/${ref.id}` : `/opportunities/${ref.id}`;
  }

  function usedInLabel(ref: TrackRecordUsedInRef) {
    if (ref.kind === "cv") {
      return cvVersions.find((cv) => cv.id === ref.id)?.name ?? ref.label;
    }
    const opportunity = opportunities.find((candidate) => candidate.id === ref.id);
    return opportunity ? `${opportunity.role} at ${opportunity.company}` : ref.label;
  }

  return (
    <Card
      ref={cardRef}
      className={cn(
        "ring-foreground/8 transition-colors",
        isAchievement && "ring-1 ring-primary/25",
        highlighted && "ring-2 ring-primary"
      )}
    >
      <CardHeader className="gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
              {isAchievement ? (
                <Badge variant="secondary" className="shrink-0 gap-1">
                  <Award className="size-3" />
                  Highlight
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{entry.impact}</p>
          </div>
          {expanded ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{entry.evidenceTag}</Badge>
          <span className="text-xs text-muted-foreground">{entry.date}</span>
          {linkedSkills.map((skill) => (
            <LinkChip key={skill.id} href="/skills">
              {skill.name}
            </LinkChip>
          ))}
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent className={cn("flex flex-col gap-3 border-t border-border pt-3", isAchievement && "gap-2.5")}>
          <p className="text-sm text-foreground">{entry.story}</p>
          {entry.impactSignals && entry.impactSignals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {entry.impactSignals.map((signal) => (
                <Badge key={`${signal.kind}-${signal.label}`} variant="outline">
                  {signal.label}
                </Badge>
              ))}
            </div>
          ) : null}
          {entry.evidenceNote ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Evidence: </span>
              {entry.evidenceNote}
            </p>
          ) : null}
          {entry.usedIn && entry.usedIn.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Used in</span>
              <ul className="flex flex-col gap-1">
                {entry.usedIn.map((ref) => (
                  <li key={`${ref.kind}-${ref.id}`}>
                    <Link
                      href={usedInHref(ref)}
                      className="text-xs text-foreground underline-offset-2 hover:underline"
                    >
                      {usedInLabel(ref)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {entry.pathRelevance ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Ties to: </span>
              {entry.pathRelevance}
            </p>
          ) : entry.strengthens ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Strengthens: </span>
              {entry.strengthens}
            </p>
          ) : null}
          {sourceEvidence.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
              <span className="text-xs font-medium text-muted-foreground">Evidence</span>
              <div className="flex flex-wrap gap-1.5">
                {sourceEvidence.map((evidence) => (
                  <EvidenceChip key={evidence.id} evidence={evidence} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="border-t border-border pt-2.5">
            <Button asChild size="sm" variant="outline" onClick={() => setTrackRecordHighlight(entry.id)}>
              <Link href="/proof">
                <ShieldCheck className="size-3.5" />
                Build proof from this
              </Link>
            </Button>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
