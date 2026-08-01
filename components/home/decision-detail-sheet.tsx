"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlarmClock, X } from "lucide-react";

import { SignalCard } from "@/components/ai/signal-card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NUDGE_ICON, NUDGE_TRIGGER_LABEL, resolveNudgeObjectLabel } from "@/lib/nudge-utils";
import { useStore } from "@/lib/store";
import type { DecisionQueueItem } from "@/lib/home-utils";
import type { NudgeAction, NudgeTrigger } from "@/lib/types";

// How long the nudge's own "handled" check state holds before the deep link
// actually navigates away, matching the delay the old attention queue used
// so the feedback still reads as resolved, not instant.
const HANDLED_DELAY_MS = 650;

interface DecisionDetailSheetProps {
  item: DecisionQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The drawer every "Needs a decision" row opens into (docs/design.md's
 * shadcn Sheet, dialog anatomy: SheetHeader/Title/Description, then body).
 * An AiSignal reuses SignalCard wholesale, the same five-beat pattern and
 * Approve/Edit/Dismiss/Undo wiring every other AiSignal surface already
 * uses. A Nudge gets its full why-line and its own actions, snooze, and
 * dismiss, none of which fit the capped one-line row this replaces.
 */
export function DecisionDetailSheet({ item, open, onOpenChange }: DecisionDetailSheetProps) {
  const { state, snoozeNudge, dismissNudge, markNudgeHandled, setGoalHighlight } = useStore();
  const router = useRouter();
  const [handledId, setHandledId] = useState<string | null>(null);

  if (!item) return null;

  const opportunity =
    item.kind === "signal" ? state.opportunities.find((entry) => entry.id === item.signal.opportunityId) : undefined;

  function handleAct(nudgeId: string, relatedGoalId: string | undefined, href: string) {
    setHandledId(nudgeId);
    window.setTimeout(() => {
      if (relatedGoalId) setGoalHighlight(relatedGoalId);
      markNudgeHandled(nudgeId);
      onOpenChange(false);
      router.push(href);
    }, HANDLED_DELAY_MS);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {item.kind === "signal" ? "Needs a decision" : NUDGE_TRIGGER_LABEL[item.nudge.trigger]}
          </SheetTitle>
          <SheetDescription>
            {item.kind === "signal"
              ? opportunity
                ? `${opportunity.role} · ${opportunity.company}`
                : "Opportunity"
              : resolveNudgeObjectLabel(item.nudge, state.opportunities, state.goals, state.learningItems)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {item.kind === "signal" ? (
            <SignalCard
              signal={item.signal}
              context={
                opportunity ? (
                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {opportunity.role} · {opportunity.company}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <NudgeDetail
              trigger={item.nudge.trigger}
              message={item.nudge.message}
              why={item.nudge.why}
              actions={item.nudge.actions}
              handled={handledId === item.nudge.id}
              onAct={(href) => handleAct(item.nudge.id, item.nudge.relatedGoalId, href)}
              onSnooze={() => {
                snoozeNudge(item.nudge.id);
                onOpenChange(false);
              }}
              onDismiss={() => {
                dismissNudge(item.nudge.id);
                onOpenChange(false);
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface NudgeDetailProps {
  trigger: NudgeTrigger;
  message: string;
  why: string;
  actions: NudgeAction[];
  handled: boolean;
  onAct: (href: string) => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

function NudgeDetail({ trigger, message, why, actions, handled, onAct, onSnooze, onDismiss }: NudgeDetailProps) {
  const Icon = NUDGE_ICON[trigger];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-3.5" />
        </span>
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
      <p className="pl-8 text-xs text-muted-foreground">{why}</p>

      {handled ? (
        <p className="pl-8 text-xs font-medium text-emerald-600 dark:text-emerald-400">Handled</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 pl-8">
          {actions.map((action, index) => (
            <Button key={action.label} size="sm" variant={index === 0 ? "default" : "outline"} onClick={() => onAct(action.href)}>
              {action.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={onSnooze}>
            <AlarmClock className="size-3.5" />
            Snooze
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            <X className="size-3.5" />
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
