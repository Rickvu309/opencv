"use client";

import { useState } from "react";
import { Check, ChevronRight, Pencil, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { copilotScripts } from "@/lib/data/copilot-scripts";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NextAction, NextActionAlternative } from "@/lib/types";

interface OpportunityActionsTabProps {
  actions: NextAction[];
  companyName: string;
  onGoToMaterials: () => void;
}

/**
 * The Actions tab: three zones that turn a fit judgment into a decision.
 * Recommendation surfaces one primary next action awaiting a decision,
 * Alternatives lists the other paths worth weighing, and Plan is the
 * running checklist of what's been accepted for this opportunity.
 */
export function OpportunityActionsTab({ actions, companyName, onGoToMaterials }: OpportunityActionsTabProps) {
  const {
    acceptNextAction,
    dismissNextAction,
    markNextActionDone,
    editNextAction,
    acceptAlternative,
    removeNextAction,
    setCopilotSurface,
    setCopilotOpen,
    sendCopilotMessage,
  } = useStore();
  const [editingAction, setEditingAction] = useState<NextAction | null>(null);

  if (actions.length === 0) {
    return <EmptyState message="Copilot hasn't suggested a next action for this opportunity yet." />;
  }

  const primary =
    actions.find((action) => action.state === "suggested") ??
    actions.find((action) => action.state === "accepted");
  const planActions = actions.filter((action) => action.state === "accepted" || action.state === "done");
  const alternatives =
    primary && (primary.state === "suggested" || primary.state === "accepted")
      ? (primary.alternatives ?? [])
      : [];

  function handleAskCopilot(prompt?: string) {
    if (!prompt) return;
    const opportunitySurface = `Opportunity Detail: ${companyName}`;
    const hasScript = copilotScripts.some((script) => script.surface === opportunitySurface);
    setCopilotSurface(hasScript ? opportunitySurface : "Opportunity Detail", companyName);
    setCopilotOpen(true);
    sendCopilotMessage(prompt);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Recommendation</span>
        {primary && primary.state === "suggested" ? (
          <RecommendationCard
            action={primary}
            onAccept={() => acceptNextAction(primary.id)}
            onAdjust={() => setEditingAction(primary)}
            onNotNow={() => dismissNextAction(primary.id)}
          />
        ) : primary && primary.state === "accepted" ? (
          <Card className="ring-foreground/8 bg-muted/20">
            <CardContent className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <CopilotTag />
                  <span className="text-xs text-muted-foreground">Accepted, now in your plan below</span>
                </div>
                <p className="text-sm text-foreground">{primary.verb}</p>
              </div>
              <ConfidenceChip confidence={primary.confidence} />
            </CardContent>
          </Card>
        ) : (
          <EmptyState message="Nothing new suggested right now. Copilot will surface a recommendation as this opportunity moves." />
        )}
      </section>

      {alternatives.length > 0 && primary ? (
        <section className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Alternatives</span>
          <div className="grid grid-cols-3 gap-3">
            {alternatives.map((alternative) => (
              <AlternativeCard
                key={alternative.id}
                alternative={alternative}
                onChoose={() => acceptAlternative(primary.id, alternative.id)}
              />
            ))}
          </div>
          {primary.whatWouldChangeThis ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">What would change this advice: </span>
              {primary.whatWouldChangeThis}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Plan</span>
        {planActions.length === 0 ? (
          <EmptyState message="Nothing in your plan yet. Accept a recommendation above to add it here." />
        ) : (
          <div className="flex flex-col gap-2">
            {planActions.map((action) => (
              <PlanRow
                key={action.id}
                action={action}
                onToggleDone={(done) => (done ? markNextActionDone(action.id) : acceptNextAction(action.id))}
                onEdit={() => setEditingAction(action)}
                onRemove={() => removeNextAction(action.id)}
                onGoToMaterials={onGoToMaterials}
                onAskCopilot={() => handleAskCopilot(action.copilotPrompt)}
              />
            ))}
          </div>
        )}
      </section>

      <EditActionDialog action={editingAction} onClose={() => setEditingAction(null)} onSave={editNextAction} />
    </div>
  );
}

function RecommendationCard({
  action,
  onAccept,
  onAdjust,
  onNotNow,
}: {
  action: NextAction;
  onAccept: () => void;
  onAdjust: () => void;
  onNotNow: () => void;
}) {
  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <CopilotTag />
            <ConfidenceChip confidence={action.confidence} />
          </div>
          <p className="text-base font-medium text-foreground">{action.verb}</p>
          <p className="text-xs text-muted-foreground">
            {action.rationale} · {action.effort} · {action.dueHint}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" onClick={onAccept}>
            <Check className="size-3.5" />
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={onAdjust}>
            <Pencil className="size-3.5" />
            Adjust
          </Button>
          <Button size="sm" variant="ghost" onClick={onNotNow}>
            <X className="size-3.5" />
            Not now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlternativeCard({
  alternative,
  onChoose,
}: {
  alternative: NextActionAlternative;
  onChoose: () => void;
}) {
  return (
    <Card size="sm" className="ring-foreground/8">
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{alternative.verb}</p>
        <p className="text-xs text-muted-foreground">Choose this when {alternative.chooseWhen}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            {alternative.effort} · {alternative.dueHint}
          </span>
          <Button size="sm" variant="outline" onClick={onChoose}>
            Choose this instead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanRow({
  action,
  onToggleDone,
  onEdit,
  onRemove,
  onGoToMaterials,
  onAskCopilot,
}: {
  action: NextAction;
  onToggleDone: (done: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
  onGoToMaterials: () => void;
  onAskCopilot: () => void;
}) {
  const done = action.state === "done";
  return (
    <Card className={cn("ring-foreground/8", done && "bg-muted/20")}>
      <CardContent className="flex items-start gap-3">
        <Checkbox
          checked={done}
          onCheckedChange={(checked) => onToggleDone(checked === true)}
          aria-label={done ? "Mark not done" : "Mark done"}
          className="mt-1"
        />
        <div className="flex flex-1 flex-col gap-1">
          <p className={cn("text-sm text-foreground", done && "text-muted-foreground line-through")}>
            {action.verb}
          </p>
          <p className="text-xs text-muted-foreground">
            {action.rationale} · {action.effort} · {action.dueHint}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {action.handoff === "materials" ? (
            <Button size="sm" variant="outline" onClick={onGoToMaterials}>
              <ChevronRight className="size-3.5" />
              Open Materials
            </Button>
          ) : null}
          {action.handoff === "copilot" ? (
            <Button size="sm" variant="outline" onClick={onAskCopilot}>
              <Sparkles className="size-3.5" />
              Ask Copilot
            </Button>
          ) : null}
          <Button size="icon-sm" variant="ghost" aria-label="Edit action" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Remove action" onClick={onRemove}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
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
          <DialogTitle>Adjust next action</DialogTitle>
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
