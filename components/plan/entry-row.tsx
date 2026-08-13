"use client";

// The plan's entry row; one line by default, detail on demand.
//
// This is the standard card for the roadmap: title, kind, source and effort on
// a single line so a whole stage is scannable, with description and course
// economics behind a disclosure. Courses carry price and an outbound link
// because some are affiliate partnerships and the plan should say so.

import * as React from "react";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Hammer,
  Repeat,
  Star,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { type PlanKind } from "@/lib/catalog";
import { useT } from "@/lib/i18n/use-t";
import type { PlanEntry } from "@/lib/actions/types";
import { useTouched } from "@/lib/actions/store";
import { cn } from "@/lib/utils";

const kindIcon: Record<PlanKind, React.ElementType> = {
  course: BookOpen,
  project: Hammer,
  task: Repeat,
};

export function EntryRow({
  entry,
  onToggle,
  onRemove,
}: {
  entry: PlanEntry;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { t, m } = useT();
  const { kind, done } = entry;
  const kindLabel = {
    course: m.plan.kindCourse,
    project: m.plan.kindProject,
    task: m.plan.kindTask,
  }[kind];
  const Icon = kindIcon[kind];
  const detailId = `entry-${entry.id}-detail`;
  // Flashes when the Coach changes this row, so an edit made on the user's
  // behalf is something they watch happen rather than discover later.
  const justChanged = useTouched().includes(entry.id);

  return (
    <li
      className={cn(
        "rounded-lg border bg-card",
        done && "opacity-60",
        justChanged && "animate-just-changed",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <Checkbox
          checked={done}
          onCheckedChange={onToggle}
          aria-label={t(m.plan.markDone(entry.title))}
        />
        <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />

        <span className={cn("min-w-0 flex-1 truncate text-sm", done && "line-through")}>
          {entry.title}
        </span>

        {entry.resource && (
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {entry.resource.provider}
          </span>
        )}
        <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
          {entry.effort}
        </span>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={detailId}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <span className="sr-only">
            {t(open ? m.plan.hideDetail(entry.title) : m.plan.showDetail(entry.title))}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 transition-transform duration-[var(--duration-state)] ease-snap motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      <div id={detailId} hidden={!open} className="border-t px-3 py-2.5 sm:pl-12">
        {entry.detail && (
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {entry.detail}
          </p>
        )}

        {/* Effort and provider repeat here because they're hidden on mobile above. */}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:hidden">
          <span>{t(kindLabel)}</span>
          <span aria-hidden>·</span>
          <span>{entry.effort}</span>
        </p>

        {entry.resource && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-xs font-medium">{entry.resource.name}</span>
            <span className="text-xs text-muted-foreground">
              {entry.resource.provider}
            </span>
            {entry.resource.rating && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star aria-hidden className="size-3 fill-current" />
                <span className="tabular-nums">{entry.resource.rating}</span>
              </span>
            )}
            <span className="text-xs font-medium tabular-nums">
              {entry.resource.price}
            </span>
            {entry.resource.affiliate && (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {t(m.plan.partner)}
              </Badge>
            )}
            <Button variant="outline" size="sm" className="ml-auto shrink-0">
              {t(m.plan.openCourse)}
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        )}

        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="mt-2 text-muted-foreground"
          >
            <Trash2 className="size-3.5" />
            {t(m.plan.removeFromPlan)}
          </Button>
        )}
      </div>
    </li>
  );
}
