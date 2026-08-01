"use client";

import { ArrowDownToLine, Check, FilePenLine, FileText, Flag, Link2, Mail, Scale, Sparkles, Star } from "lucide-react";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { ActivityMoment, ActivityMomentKind } from "@/lib/types";

const KIND_ICON: Record<ActivityMomentKind, typeof Flag> = {
  created: Flag,
  "status-change": Check,
  "note-added": FileText,
  "copilot-analysis": Sparkles,
  "action-accepted": Check,
  "action-done": Check,
  "dream-flagged": Star,
  "cv-tailored": FilePenLine,
  "signal-accepted": Mail,
  "evidence-linked": Link2,
  "comparison-decision": Scale,
  "priority-change": ArrowDownToLine,
};

const KIND_DOT: Record<ActivityMomentKind, string> = {
  created: "bg-slate-500",
  "status-change": "bg-sky-500",
  "note-added": "bg-slate-400",
  "copilot-analysis": "bg-indigo-500",
  "action-accepted": "bg-emerald-500",
  "action-done": "bg-emerald-600",
  "dream-flagged": "bg-amber-500",
  "cv-tailored": "bg-indigo-500",
  "signal-accepted": "bg-indigo-500",
  "evidence-linked": "bg-teal-500",
  "comparison-decision": "bg-primary",
  "priority-change": "bg-slate-500",
};

/**
 * Vertical timeline of everything that has happened on this opportunity,
 * newest first: created, Copilot analysis, status changes, notes, and
 * accepted actions.
 */
export function OpportunityActivityTab({ moments }: { moments: ActivityMoment[] }) {
  if (moments.length === 0) {
    return <EmptyState message="Nothing has happened on this opportunity yet." />;
  }

  return (
    <ol className="flex flex-col gap-4 border-l-2 border-border pl-4">
      {moments.map((moment) => {
        const Icon = KIND_ICON[moment.kind];
        return (
          <li key={moment.id} className="relative flex flex-col gap-0.5">
            <span
              className={cn(
                "absolute -left-[1.4rem] flex size-4 items-center justify-center rounded-full text-white",
                KIND_DOT[moment.kind]
              )}
            >
              <Icon className="size-2.5" />
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{moment.createdAt}</span>
              {moment.kind === "copilot-analysis" ||
              moment.kind === "cv-tailored" ||
              moment.kind === "signal-accepted" ? (
                <CopilotTag />
              ) : null}
            </div>
            <p className="text-sm text-foreground">{moment.message}</p>
          </li>
        );
      })}
    </ol>
  );
}
