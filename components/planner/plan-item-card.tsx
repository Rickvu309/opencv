"use client";

import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LinkChip } from "@/components/shared/link-chip";
import { useStore } from "@/lib/store";
import type { Goal, LearningItem, Opportunity, PlanItem, Skill, TrackRecordEntry } from "@/lib/types";

const STATE_LABELS: Record<PlanItem["state"], string> = {
  suggested: "Suggested",
  accepted: "In your plan",
  dismissed: "Dismissed",
};

interface PlanItemCardProps {
  item: PlanItem;
  skills: Skill[];
  goals: Goal[];
  opportunities: Opportunity[];
  trackRecordEntries: TrackRecordEntry[];
  learningItems: LearningItem[];
  /** Zone 2's pinned next-move card reuses this component in a slightly quieter shell. */
  pinned?: boolean;
}

/**
 * One growth plan item, the five-beat acceptable kind: a type badge, the
 * concrete move, links to what it touches, and Add to plan or Not now for a
 * suggested item. Already-done items (Goal-Gradient, backed by a track
 * record entry) render as a quiet fact instead, no controls. Shared by zone
 * 2's pinned next move and zone 5's staged roadmap so the same object reads
 * identically in both places.
 */
export function PlanItemCard({
  item,
  skills,
  goals,
  opportunities,
  trackRecordEntries,
  learningItems,
  pinned,
}: PlanItemCardProps) {
  const { acceptPlanItem, dismissPlanItem, setSkillHighlight, setGoalHighlight, setTrackRecordHighlight } =
    useStore();

  const linkedSkill = item.linkedSkillId ? skills.find((skill) => skill.id === item.linkedSkillId) : undefined;
  const linkedGoal = item.linkedGoalId ? goals.find((goal) => goal.id === item.linkedGoalId) : undefined;
  const linkedOpportunity = item.linkedOpportunityId
    ? opportunities.find((opportunity) => opportunity.id === item.linkedOpportunityId)
    : undefined;
  const trackRecordEntry = item.trackRecordEntryId
    ? trackRecordEntries.find((entry) => entry.id === item.trackRecordEntryId)
    : undefined;
  const linkedLearningItem = item.linkedLearningItemId
    ? learningItems.find((learningItem) => learningItem.id === item.linkedLearningItemId)
    : undefined;

  return (
    <Card className={pinned ? "ring-primary/30" : "ring-foreground/8"}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="capitalize">
                {item.type}
              </Badge>
              {item.alreadyDone ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3.5" />
                  Already true
                </span>
              ) : null}
            </div>
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </div>
          {!item.alreadyDone && item.state === "suggested" ? (
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Add to plan"
                onClick={() => acceptPlanItem(item.id)}
              >
                <Check className="size-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Not now" onClick={() => dismissPlanItem(item.id)}>
                <X className="size-3.5" />
              </Button>
            </div>
          ) : !item.alreadyDone ? (
            <span className="shrink-0 text-xs text-muted-foreground">{STATE_LABELS[item.state]}</span>
          ) : null}
        </div>

        {linkedSkill || linkedGoal || linkedOpportunity || trackRecordEntry || linkedLearningItem ? (
          <div className="flex flex-wrap gap-1.5">
            {linkedSkill ? (
              <LinkChip href="/skills" onClick={() => setSkillHighlight(linkedSkill.id)}>
                {linkedSkill.name}
              </LinkChip>
            ) : null}
            {linkedLearningItem ? <LinkChip href="/skills">{linkedLearningItem.title}</LinkChip> : null}
            {linkedGoal ? (
              <LinkChip href="/goals" onClick={() => setGoalHighlight(linkedGoal.id)}>
                {linkedGoal.title}
              </LinkChip>
            ) : null}
            {linkedOpportunity ? (
              <LinkChip href={`/opportunities/${linkedOpportunity.id}`}>{linkedOpportunity.company}</LinkChip>
            ) : null}
            {trackRecordEntry ? (
              <LinkChip href="/track-record" onClick={() => setTrackRecordHighlight(trackRecordEntry.id)}>
                {trackRecordEntry.title}
              </LinkChip>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
