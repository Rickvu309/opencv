"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Check, Flame, GraduationCap, Inbox, ListChecks, Pin, Target, X } from "lucide-react";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAttentionQueue, NUDGE_TRIGGER_LABEL } from "@/lib/nudge-utils";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Nudge, NudgeTrigger } from "@/lib/types";

const NUDGE_ICON: Record<NudgeTrigger, typeof AlarmClock> = {
  "stale-opportunity": AlarmClock,
  "high-potential": Flame,
  "missing-next-step": ListChecks,
  "capture-prompt": Inbox,
  "goal-reminder": Target,
  "learning-nudge": GraduationCap,
  "weekly-focus": Pin,
};

// How long the "handled" check state holds before the Act deep link actually
// navigates away, long enough to read as a resolved item, short enough to
// stay out of the way.
const HANDLED_DELAY_MS = 650;

/**
 * Home's core proactive surface: a merged, prioritized queue across every
 * nudge family (opportunity, capture, goal, learning), plus any items
 * pinned from an accepted Weekly Review focus. Capped at 6 by
 * getAttentionQueue so it stays few and relevant. Every action deep-links
 * into a real workflow; acting on an item flashes a check state before it
 * leaves the queue, snoozing and dismissing resolve quietly with an undo.
 */
export function AttentionQueue() {
  const { state, snoozeNudge, dismissNudge, markNudgeHandled, setGoalHighlight } = useStore();
  const router = useRouter();
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());

  const queue = getAttentionQueue(state.nudges);

  function handleAct(nudge: Nudge, href: string) {
    setHandledIds((current) => new Set(current).add(nudge.id));
    window.setTimeout(() => {
      if (nudge.relatedGoalId) setGoalHighlight(nudge.relatedGoalId);
      markNudgeHandled(nudge.id);
      router.push(href);
    }, HANDLED_DELAY_MS);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>For your attention</h2>
        <CopilotTag />
      </div>

      {queue.length === 0 ? (
        <EmptyState message="Nothing needs you right now. Copilot will surface stale opportunities, capture prompts, and goal or learning reminders here as they come up." />
      ) : (
        <div className="flex flex-col gap-2">
          {queue.map((nudge) => {
            const Icon = NUDGE_ICON[nudge.trigger];
            const handled = handledIds.has(nudge.id);
            return (
              <Card
                key={nudge.id}
                className={cn("ring-foreground/8 transition-opacity duration-300", handled && "opacity-70")}
              >
                <CardContent className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        handled
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-accent text-accent-foreground"
                      )}
                    >
                      {handled ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {NUDGE_TRIGGER_LABEL[nudge.trigger]}
                        </span>
                        {nudge.pinned ? (
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300">Pinned</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-foreground">{nudge.message}</p>
                      <p className="text-xs text-muted-foreground">{nudge.why}</p>
                    </div>
                  </div>
                  {handled ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Handled
                    </span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {nudge.actions.map((action, index) => (
                        <Button
                          key={action.label}
                          size="sm"
                          variant={index === 0 ? "default" : "outline"}
                          onClick={() => handleAct(nudge, action.href)}
                        >
                          {action.label}
                        </Button>
                      ))}
                      <Button size="icon-sm" variant="ghost" aria-label="Snooze" onClick={() => snoozeNudge(nudge.id)}>
                        <AlarmClock className="size-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => dismissNudge(nudge.id)}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
