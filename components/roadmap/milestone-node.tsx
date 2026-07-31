"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Unlock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { LinkChip } from "@/components/shared/link-chip";
import { ResourceCard } from "@/components/roadmap/resource-card";
import { SkillLevelMeter } from "@/components/skills/skill-level-meter";
import { formatSequence, isProofItemDone, isSkillMoveDone, type MilestoneProgress } from "@/lib/roadmap-utils";
import { useStore } from "@/lib/store";
import type {
  MilestoneStatus,
  PlanItem,
  RoadmapMilestone,
  RoadmapResource,
  Skill,
  TrackRecordEntry,
} from "@/lib/types";

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  "in-progress": "In progress",
  "up-next": "Up next",
  later: "Later",
};

const STATUS_BADGE_VARIANT: Record<MilestoneStatus, "default" | "secondary" | "outline"> = {
  "in-progress": "default",
  "up-next": "secondary",
  later: "outline",
};

interface MilestoneNodeProps {
  milestone: RoadmapMilestone;
  status: MilestoneStatus;
  progress: MilestoneProgress;
  resources: RoadmapResource[];
  skills: Skill[];
  planItems: PlanItem[];
  trackRecordEntries: TrackRecordEntry[];
}

/**
 * One milestone card: name, outcome statement, status, live progress, and an
 * unlock line, always visible. The drill-in (Skills to move, Proof to build,
 * Resources, Miller's Law's 3 groups) stays collapsed until asked for
 * (Progressive Disclosure), matching the same expand pattern the Path
 * Planner's Alternatives section already uses. Skills to move and Proof to
 * build sit side by side (they're both short, scannable rows), Resources
 * runs full width below them since its cards need more room and their
 * combined height rarely matches the other two groups.
 */
export function MilestoneNode({ milestone, status, progress, resources, skills, planItems, trackRecordEntries }: MilestoneNodeProps) {
  const [open, setOpen] = useState(false);
  const { setSkillHighlight, setTrackRecordHighlight } = useStore();

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Card
      className={
        status === "in-progress"
          ? "ring-primary/25"
          : status === "later"
            ? "border border-dashed border-border ring-0"
            : "ring-foreground/8"
      }
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{milestone.name}</h3>
            <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {progress.done} of {progress.total} already in motion
          </span>
        </div>

        <p className="text-sm text-muted-foreground">{milestone.outcomeStatement}</p>

        <Progress value={percent} />

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Unlock className="size-3.5 shrink-0" />
          <span>{milestone.unlockLine}</span>
        </div>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? "Hide the plan for this milestone" : "See the plan for this milestone"}
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>

        {open ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-section-label">Skills to move</span>
                <div className="flex flex-col gap-2">
                  {milestone.skillMoves.map((move) => {
                    const skill = skills.find((candidate) => candidate.id === move.skillId);
                    if (!skill) return null;
                    const done = isSkillMoveDone(move, skills);
                    return (
                      <div key={move.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{skill.name}</p>
                          {done ? <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : null}
                        </div>
                        <SkillLevelMeter level={skill.level} targetLevel={move.toLevel} />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">{formatSequence(move.sequence)}</span>
                          <LinkChip href="/skills" onClick={() => setSkillHighlight(skill.id)}>
                            Open
                          </LinkChip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-section-label">Proof to build</span>
                <div className="flex flex-col gap-2">
                  {milestone.proofItems.map((item) => {
                    const done = isProofItemDone(item, planItems, trackRecordEntries);
                    const trackRecordEntry = item.trackRecordEntryId
                      ? trackRecordEntries.find((entry) => entry.id === item.trackRecordEntryId)
                      : undefined;
                    return (
                      <div key={item.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          {done ? <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">{formatSequence(item.sequence)}</span>
                          {trackRecordEntry ? (
                            <LinkChip href="/track-record" onClick={() => setTrackRecordHighlight(trackRecordEntry.id)}>
                              {trackRecordEntry.title}
                            </LinkChip>
                          ) : item.linkedPlanItemId ? (
                            <LinkChip href="/planner">Open growth plan</LinkChip>
                          ) : item.proposedActionHref && item.proposedActionLabel ? (
                            <LinkChip href={item.proposedActionHref}>{item.proposedActionLabel}</LinkChip>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-section-label">Resources</span>
              {resources.length === 0 ? (
                <EmptyState message="Nothing suggested here right now." />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((resource) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      skill={skills.find((skill) => skill.id === resource.linkedSkillId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
