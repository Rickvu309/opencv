"use client";

import { Check, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LinkChip } from "@/components/shared/link-chip";
import { resourceTypeLabel } from "@/lib/roadmap-utils";
import { useStore } from "@/lib/store";
import type { RoadmapResource, Skill } from "@/lib/types";

interface ResourceCardProps {
  resource: RoadmapResource;
  skill?: Skill;
}

/**
 * One resource recommendation: a type badge, effort, and the three answers
 * every resource on this surface must carry (why this matters, why now,
 * what it unlocks), so it never reads as a bare content-list item. Hick's
 * Law: one primary action, Add to plan; Not for me sits as the quiet
 * secondary. Add to plan turns this into a real PlanItem and LearningItem,
 * store-wired, so it shows up on /planner and /skills immediately.
 */
export function ResourceCard({ resource, skill }: ResourceCardProps) {
  const { addRoadmapResourceToPlan, dismissRoadmapResource, setSkillHighlight } = useStore();

  return (
    <Card className={resource.isCopilotPick ? "ring-indigo-300 dark:ring-indigo-500/40" : "ring-foreground/8"}>
      <CardContent className="flex h-full flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{resourceTypeLabel(resource.type)}</Badge>
            <span className="text-xs text-muted-foreground">{resource.effort}</span>
          </div>
          {resource.isCopilotPick ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Sparkles className="size-3" />
              Copilot&apos;s pick
            </span>
          ) : null}
        </div>

        <p className="text-sm font-medium text-foreground">{resource.title}</p>
        {resource.isCopilotPick && resource.copilotPickReason ? (
          <p className="text-xs italic text-muted-foreground">{resource.copilotPickReason}</p>
        ) : null}

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Why this matters: </span>
            {resource.whyItMatters}
          </p>
          <p>
            <span className="font-medium text-foreground">Why now: </span>
            {resource.whyNow}
          </p>
          <p>
            <span className="font-medium text-foreground">What it unlocks: </span>
            {resource.whatItUnlocks}
          </p>
        </div>

        {skill ? (
          <div>
            <LinkChip href="/skills" onClick={() => setSkillHighlight(skill.id)}>
              {skill.name}
            </LinkChip>
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-end gap-1.5 pt-1">
          {resource.state === "suggested" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => addRoadmapResourceToPlan(resource)}>
                <Check className="size-3.5" />
                Add to plan
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Not for me"
                onClick={() => dismissRoadmapResource(resource.id)}
              >
                <X className="size-3.5" />
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {resource.state === "added" ? "In your plan" : "Dismissed"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
