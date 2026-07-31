"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CvVersion, Opportunity, Skill, TrackRecordEntry, TrackRecordUsedInRef } from "@/lib/types";

interface EntryCardProps {
  entry: TrackRecordEntry;
  skills: Skill[];
  cvVersions: CvVersion[];
  opportunities: Opportunity[];
  expanded: boolean;
  onToggle: () => void;
}

/**
 * One confirmed timeline entry. Collapsed shows the scannable card anatomy
 * (title, impact, date, evidence tag, skill chips); expanding in place adds
 * the full story, the evidence note, where it's already been used, and the
 * Strengthens line, without navigating away from the timeline.
 */
export function TrackRecordEntryCard({
  entry,
  skills,
  cvVersions,
  opportunities,
  expanded,
  onToggle,
}: EntryCardProps) {
  const linkedSkills = entry.skillIds
    .map((id) => skills.find((skill) => skill.id === id))
    .filter((skill): skill is Skill => Boolean(skill));

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
    <Card className="ring-foreground/8">
      <CardHeader className="gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{entry.title}</p>
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
            <Link key={skill.id} href="/skills">
              <Badge variant="outline" className="hover:bg-muted">
                {skill.name}
              </Badge>
            </Link>
          ))}
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-sm text-foreground">{entry.story}</p>
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
          {entry.strengthens ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Strengthens: </span>
              {entry.strengthens}
            </p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
