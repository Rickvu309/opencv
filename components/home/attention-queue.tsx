"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  GraduationCap,
  Inbox,
  ListChecks,
  Pin,
  Target,
  X,
} from "lucide-react";

import { SignalCard } from "@/components/ai/signal-card";
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
  "rewind-carry-forward": Pin,
};

// How long the "handled" check state holds before the Act deep link actually
// navigates away, long enough to read as a resolved item, short enough to
// stay out of the way.
const HANDLED_DELAY_MS = 650;

/**
 * Home's core proactive surface: a merged, prioritized queue across every
 * nudge family (opportunity, capture, goal, learning), plus any items
 * pinned from an accepted Rewind carry-forward. Capped at 6 by
 * getAttentionQueue so it stays few and relevant. Every action deep-links
 * into a real workflow; acting on an item flashes a check state before it
 * leaves the queue, snoozing and dismissing resolve quietly with an undo.
 */
export function AttentionQueue() {
  const { state, snoozeNudge, dismissNudge, markNudgeHandled, setGoalHighlight } = useStore();
  const router = useRouter();
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const queue = getAttentionQueue(state.nudges);
  const proposedSignals = state.aiSignals.filter((signal) => signal.state === "proposed");

  function handleAct(nudge: Nudge, href: string) {
    setHandledIds((current) => new Set(current).add(nudge.id));
    window.setTimeout(() => {
      if (nudge.relatedGoalId) setGoalHighlight(nudge.relatedGoalId);
      markNudgeHandled(nudge.id);
      router.push(href);
    }, HANDLED_DELAY_MS);
  }

  return (
    <section id="attention" className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>For your attention</h2>
        <CopilotTag />
      </div>

      {queue.length === 0 && proposedSignals.length === 0 ? (
        <EmptyState message="Nothing needs you right now. Copilot will surface stale opportunities, capture prompts, and goal or learning reminders here as they come up." />
      ) : (
        <div className="flex flex-col gap-5">
          {proposedSignals.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-section-label">Needs a decision</p>
              <div className="flex flex-col gap-2">
                {proposedSignals.map((signal) => {
                  const opportunity = state.opportunities.find((item) => item.id === signal.opportunityId);
                  return (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
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
                  );
                })}
              </div>
            </div>
          ) : null}

          {queue.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-section-label">Also worth a look</p>
              <Card className="ring-foreground/8 py-0">
                <CardContent className="flex flex-col gap-0 px-0">
                  {queue.map((nudge, index) => {
                    const Icon = NUDGE_ICON[nudge.trigger];
                    const handled = handledIds.has(nudge.id);
                    return (
                      <div
                        key={nudge.id}
                        className={cn(
                          "flex items-start justify-between gap-4 px-4 py-3 transition-opacity duration-300",
                          index > 0 && "border-t border-border",
                          handled && "opacity-70"
                        )}
                      >
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
                                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
                                  Pinned
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(nudge.id)}
                              aria-expanded={expandedIds.has(nudge.id)}
                              className="flex items-center gap-1 rounded text-left outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="text-sm text-foreground">{nudge.message}</span>
                              {expandedIds.has(nudge.id) ? (
                                <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                              )}
                            </button>
                            {expandedIds.has(nudge.id) ? (
                              <p className="text-xs text-muted-foreground">{nudge.why}</p>
                            ) : null}
                          </div>
                        </div>
                        {handled ? (
                          <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Handled
                          </span>
                        ) : (
                          <div className="flex shrink-0 items-center gap-1.5">
                            {nudge.actions.map((action, actionIndex) => (
                              <Button
                                key={action.label}
                                size="sm"
                                variant={actionIndex === 0 ? "default" : "outline"}
                                onClick={() => handleAct(nudge, action.href)}
                              >
                                {action.label}
                              </Button>
                            ))}
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Snooze"
                              onClick={() => snoozeNudge(nudge.id)}
                            >
                              <AlarmClock className="size-3.5" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Dismiss"
                              onClick={() => dismissNudge(nudge.id)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
