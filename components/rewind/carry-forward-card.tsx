"use client";

import type { LucideIcon } from "lucide-react";
import { Briefcase, Check, GraduationCap, ListTodo, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EvidenceChip } from "@/components/ai/evidence-chip";
import { EvidenceExtract } from "@/components/ai/evidence-extract";
import { SaveBackConfirmation } from "@/components/ai/save-back-confirmation";
import { findEvidenceById } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";
import type { RewindCarryForward, RewindCarryForwardKind } from "@/lib/types";

const CARRY_FORWARD_ICON: Record<RewindCarryForwardKind, LucideIcon> = {
  "unfinished-work": ListTodo,
  "growth-prompt": GraduationCap,
  "opportunity-follow-up": Briefcase,
};

interface CarryForwardCardProps {
  carryForward: RewindCarryForward;
}

/**
 * One closing-zone proposal for next week, five-beat acceptable: a signal,
 * why it matters, optional grounding evidence, the proposed action, and
 * accept or dismiss controls, the same visual language AiActionCard uses
 * elsewhere so the pattern reads as one system.
 */
export function CarryForwardCard({ carryForward }: CarryForwardCardProps) {
  const { acceptRewindCarryForward, dismissRewindCarryForward, undoRewindCarryForward } = useStore();
  const Icon = CARRY_FORWARD_ICON[carryForward.kind];
  const evidence = carryForward.evidenceId ? findEvidenceById(carryForward.evidenceId) : undefined;

  if (carryForward.state === "dismissed") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <X className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Not carried forward: {carryForward.message}</p>
      </div>
    );
  }

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm font-medium text-foreground">{carryForward.message}</p>
          </div>
          <CopilotTag className="shrink-0" />
        </div>

        <p className="pl-8 text-xs text-muted-foreground">{carryForward.why}</p>

        {evidence ? (
          <div className="flex flex-col gap-1.5 pl-8">
            <EvidenceChip evidence={evidence} />
            <EvidenceExtract evidence={evidence} />
          </div>
        ) : null}

        {carryForward.state === "accepted" ? (
          <div className="pl-8">
            <SaveBackConfirmation
              message={carryForward.proposedAction}
              onUndo={() => undoRewindCarryForward(carryForward.id)}
            />
          </div>
        ) : (
          <>
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 pl-8">
              <p className="text-xs font-medium text-muted-foreground">If you accept</p>
              <p className="text-sm text-foreground">{carryForward.proposedAction}</p>
            </div>
            <div className="flex items-center gap-1.5 pl-8">
              <Button size="sm" onClick={() => acceptRewindCarryForward(carryForward.id)}>
                <Check className="size-3.5" />
                Accept
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismissRewindCarryForward(carryForward.id)}>
                <X className="size-3.5" />
                Dismiss
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
