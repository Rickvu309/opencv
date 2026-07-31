"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { useStore } from "@/lib/store";
import type { NextAction, NextActionState } from "@/lib/types";

const GROUPS: { state: NextActionState; label: string }[] = [
  { state: "suggested", label: "Suggested" },
  { state: "accepted", label: "Accepted" },
  { state: "done", label: "Done" },
  { state: "dismissed", label: "Dismissed" },
];

export function OpportunityActionsTab({ actions }: { actions: NextAction[] }) {
  const { acceptNextAction, dismissNextAction, markNextActionDone, editNextAction } = useStore();
  const [editingAction, setEditingAction] = useState<NextAction | null>(null);

  if (actions.length === 0) {
    return <EmptyState message="Copilot hasn't suggested a next action for this opportunity yet." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((group) => {
        const groupActions = actions.filter((action) => action.state === group.state);
        if (groupActions.length === 0) return null;

        return (
          <div key={group.state} className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{group.label}</span>
            {groupActions.map((action) => (
              <Card key={action.id}>
                <CardContent className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CopilotTag className="w-fit" />
                    <p className="text-sm text-foreground">{action.verb}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.rationale} · {action.effort} · {action.dueHint}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {action.state === "suggested" || action.state === "accepted" ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Edit action"
                        onClick={() => setEditingAction(action)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                    {action.state === "suggested" ? (
                      <>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label="Accept"
                          onClick={() => acceptNextAction(action.id)}
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Dismiss"
                          onClick={() => dismissNextAction(action.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    ) : action.state === "accepted" ? (
                      <Button size="sm" variant="outline" onClick={() => markNextActionDone(action.id)}>
                        Mark done
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}

      <EditActionDialog action={editingAction} onClose={() => setEditingAction(null)} onSave={editNextAction} />
    </div>
  );
}

type NextActionPatch = Partial<Pick<NextAction, "verb" | "rationale" | "effort" | "dueHint">>;

function EditActionDialog({
  action,
  onClose,
  onSave,
}: {
  action: NextAction | null;
  onClose: () => void;
  onSave: (id: string, patch: NextActionPatch) => void;
}) {
  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit next action</DialogTitle>
        </DialogHeader>
        {action ? (
          <EditActionForm
            key={action.id}
            action={action}
            onSave={(patch) => {
              onSave(action.id, patch);
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditActionForm({
  action,
  onSave,
}: {
  action: NextAction;
  onSave: (patch: NextActionPatch) => void;
}) {
  const [verb, setVerb] = useState(action.verb);
  const [rationale, setRationale] = useState(action.rationale);
  const [effort, setEffort] = useState(action.effort);
  const [dueHint, setDueHint] = useState(action.dueHint);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Action</Label>
          <Input value={verb} onChange={(event) => setVerb(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Rationale</Label>
          <Textarea rows={2} value={rationale} onChange={(event) => setRationale(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Effort</Label>
            <Input value={effort} onChange={(event) => setEffort(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Due hint</Label>
            <Input value={dueHint} onChange={(event) => setDueHint(event.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={() => onSave({ verb, rationale, effort, dueHint })} disabled={!verb.trim()}>
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}
