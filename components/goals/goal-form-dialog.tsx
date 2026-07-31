"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { makeId, today, useStore } from "@/lib/store";
import type { Goal, GoalHorizon } from "@/lib/types";

export interface GoalDraft {
  title: string;
  why: string;
  targetDate: string;
  horizon: GoalHorizon;
}

function draftFromGoal(goal?: Goal): GoalDraft {
  if (!goal) {
    return { title: "", why: "", targetDate: today(), horizon: "near term" };
  }
  return { title: goal.title, why: goal.why, targetDate: goal.targetDate, horizon: goal.horizon };
}

interface GoalFormDialogProps {
  children: React.ReactNode;
  goal?: Goal;
}

/**
 * Shared Add and Edit form for a goal. Editing an existing goal keeps its id,
 * status, progress notes, and links untouched; adding creates a fresh goal
 * with no links yet.
 */
export function GoalFormDialog({ children, goal }: GoalFormDialogProps) {
  const { addGoal, editGoal } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GoalDraft>(() => draftFromGoal(goal));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setDraft(draftFromGoal(goal));
  }

  const canSave = Boolean(draft.title.trim() && draft.why.trim() && draft.targetDate);

  function handleSave() {
    if (!canSave) return;
    const patch = {
      title: draft.title.trim(),
      why: draft.why.trim(),
      targetDate: draft.targetDate,
      horizon: draft.horizon,
    };
    if (goal) {
      editGoal(goal.id, patch);
    } else {
      addGoal({
        id: makeId("goal"),
        ...patch,
        status: "needs attention",
        progressNotes: [{ id: makeId("goal-note"), note: "Just added, no progress yet.", createdAt: today() }],
      });
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Add goal"}</DialogTitle>
          <DialogDescription>
            {goal
              ? "Update the goal's title, why it matters, target date, or horizon."
              : "New goals start at needs attention with no progress yet."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={draft.title}
              placeholder="For example, Land a senior or staff AI product design role"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-why">Why it matters</Label>
            <Textarea
              id="goal-why"
              rows={3}
              value={draft.why}
              placeholder="What makes this goal matter right now"
              onChange={(event) => setDraft((current) => ({ ...current, why: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-target-date">Target date</Label>
              <Input
                id="goal-target-date"
                type="date"
                value={draft.targetDate}
                onChange={(event) => setDraft((current) => ({ ...current, targetDate: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Horizon</Label>
              <Select
                value={draft.horizon}
                onValueChange={(value) => setDraft((current) => ({ ...current, horizon: value as GoalHorizon }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a horizon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="near term">Near term</SelectItem>
                  <SelectItem value="long term">Long term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!canSave}>
            {goal ? "Save changes" : "Add goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
