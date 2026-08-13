"use client";

// Kế hoạch; one roadmap from today to job-ready.
//
// Stages are stations on a single spine; each holds courses, projects and
// recurring tasks as compact rows (components/plan/entry-row.tsx). The phase
// goal closes each stage as its milestone, so the data needs no separate
// milestone records.
//
// Done-state lives in lib/actions, so the Coach can tick items off too.

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EntryRow } from "@/components/plan/entry-row";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export default function PlanPage() {
  const { plan, profile } = useAppState();
  const dispatch = useDispatch();
  const { t, m } = useT();

  const all = plan.stages.flatMap((s) => s.entries);
  const doneCount = all.filter((e) => e.done).length;
  // Readiness is the plan's own progress, not a number from a fixture. A
  // hard-coded 58% survived every edit the user made, which made the one
  // figure on this screen the only one that could not be moved.
  const readiness = all.length === 0 ? 0 : Math.round((doneCount / all.length) * 100);
  const targetRole = profile.identity.targetRole;

  return (
    // Extra bottom padding on mobile clears the fixed coach strip. Desktop
    // gets that clearance from the inset frame's mb-12 gutter instead.
    <div className="mx-auto w-full max-w-3xl px-5 pt-8 pb-8 sm:px-8">
      <div className="mb-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t(targetRole ? m.plan.titleWithRole(targetRole) : m.plan.title)}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {t(m.plan.progress(doneCount, all.length, readiness))}
          </p>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground text-pretty">
          {t(m.plan.intro)}
        </p>
      </div>

      <ol>
        {plan.stages.map((stage, index) => {
          const items = stage.entries;
          const stageDone = items.length > 0 && items.every((e) => e.done);
          const last = index === plan.stages.length - 1;

          return (
            // minmax(0,1fr), not 1fr: a bare `1fr` track has an `auto` minimum,
            // so it refuses to shrink below its content and the entry rows
            // overhang the viewport at 375px instead of truncating.
            <li key={stage.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
              {/* The spine: a station per stage, filling as each completes. */}
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors motion-reduce:transition-none",
                    stageDone
                      ? "border-transparent bg-foreground text-background"
                      : "bg-card",
                  )}
                >
                  {stageDone ? <Check className="size-3.5" /> : index + 1}
                </span>
                {!last && <span aria-hidden className="w-px flex-1 bg-border" />}
              </div>

              <section aria-labelledby={`stage-${stage.id}`} className="pb-8">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3
                    id={`stage-${stage.id}`}
                    className="text-base font-semibold tracking-tight"
                  >
                    {stage.label}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {stage.period}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {items.filter((e) => e.done).length}/{items.length}
                  </span>
                </div>

                <ul className="mt-3 space-y-2">
                  {items.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onToggle={() => dispatch("plan.toggle", { id: entry.id })}
                      onRemove={() =>
                        dispatch("plan.removeEntry", { id: entry.id })
                      }
                    />
                  ))}
                  {items.length === 0 && (
                    <li className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                      {t(m.plan.stageEmpty)}
                    </li>
                  )}
                </ul>
              </section>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/career-map">
            {t(m.plan.viewMap)}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link
            href={`/coach?q=${encodeURIComponent(
              t(
                targetRole
                  ? m.plan.reviewPromptWithRole(targetRole)
                  : m.plan.reviewPrompt,
              ),
            )}`}
          >
            {t(m.plan.askCoachToReview)}
          </Link>
        </Button>
      </div>
    </div>
  );
}
