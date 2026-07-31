"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { GoalStatusChip } from "@/components/goals/goal-status-chip";
import { LinkChip } from "@/components/shared/link-chip";
import { LinkedEvidenceList } from "@/components/sources/linked-evidence-list";
import { getLinkedInboxItemsFor } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";
import type { Goal, LearningItem, Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GoalCardProps {
  goal: Goal;
  opportunities: Opportunity[];
  learningItems: LearningItem[];
  highlighted?: boolean;
}

/**
 * One goal card for Zone 1. Collapsed shows the scannable card anatomy
 * (title, one-line why, target date, latest progress note, status, linked
 * opportunities count). Expanding adds the full why, the append-only
 * progress notes list with an inline add, and linked opportunities and
 * learning items as chips.
 */
export function GoalCard({ goal, opportunities, learningItems, highlighted }: GoalCardProps) {
  const { state, parkGoal, addGoalProgressNote } = useStore();
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const cardRef = useRef<HTMLDivElement | null>(null);
  const expanded = manuallyExpanded || Boolean(highlighted);
  const linkedEvidence = getLinkedInboxItemsFor(state, "goal", goal.id);

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  const linkedOpportunities = (goal.opportunityIds ?? [])
    .map((id) => opportunities.find((opportunity) => opportunity.id === id))
    .filter((opportunity): opportunity is Opportunity => Boolean(opportunity));

  const linkedLearningItems = learningItems.filter(
    (item) => item.goalId === goal.id && item.state !== "dismissed"
  );

  const latestNote = goal.progressNotes[goal.progressNotes.length - 1];

  function handleAddNote() {
    if (!noteDraft.trim()) return;
    addGoalProgressNote(goal.id, noteDraft);
    setNoteDraft("");
  }

  return (
    <Card
      ref={cardRef}
      className={cn(
        "ring-foreground/8 transition-colors",
        highlighted && "ring-2 ring-primary"
      )}
    >
      <CardContent className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setManuallyExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex w-full items-start justify-between gap-3 rounded text-left outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="truncate">{goal.title}</h3>
            <p className="line-clamp-1 text-xs text-muted-foreground">{goal.why}</p>
          </div>
          {expanded ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        <div className="flex flex-wrap items-center gap-1.5">
          <GoalStatusChip status={goal.status} />
          <span className="text-xs text-muted-foreground">Target date: {goal.targetDate}</span>
          <span className="text-xs text-muted-foreground">
            {linkedOpportunities.length} linked {linkedOpportunities.length === 1 ? "opportunity" : "opportunities"}
          </span>
        </div>

        {latestNote ? <p className="line-clamp-1 text-sm text-foreground">{latestNote.note}</p> : null}

        {expanded ? (
          <>
            <Separator />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Why this matters</span>
              <p className="text-sm text-foreground">{goal.why}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Progress notes</span>
              <div className="flex flex-col gap-1.5">
                {goal.progressNotes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-sm text-foreground">{note.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{note.createdAt}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5 pt-1">
                <Textarea
                  rows={2}
                  value={noteDraft}
                  placeholder="Add a progress note"
                  onChange={(event) => setNoteDraft(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  disabled={!noteDraft.trim()}
                  onClick={handleAddNote}
                >
                  Add note
                </Button>
              </div>
            </div>

            {linkedEvidence.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Linked evidence</span>
                <LinkedEvidenceList items={linkedEvidence} />
              </div>
            ) : null}

            {linkedOpportunities.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Linked opportunities</span>
                <div className="flex flex-wrap gap-1.5">
                  {linkedOpportunities.map((opportunity) => (
                    <LinkChip key={opportunity.id} href={`/opportunities/${opportunity.id}`}>
                      {opportunity.company}
                    </LinkChip>
                  ))}
                </div>
              </div>
            ) : null}

            {linkedLearningItems.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Linked learning items</span>
                <div className="flex flex-wrap gap-1.5">
                  {linkedLearningItems.map((item) => (
                    <LinkChip key={item.id} href="/skills">
                      {item.title}
                      {item.state === "planned" ? " · Planned" : ""}
                    </LinkChip>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <GoalFormDialog goal={goal}>
                <Button size="sm" variant="outline">
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </GoalFormDialog>
              {goal.status === "parked" ? (
                <span className="inline-flex items-center px-2 text-xs text-muted-foreground">
                  Parked, not being actively pursued right now.
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => parkGoal(goal.id)}>
                  Park
                </Button>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
