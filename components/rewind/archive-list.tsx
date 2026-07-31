"use client";

import { History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RewindArchivedWeek } from "@/lib/types";

interface ArchiveListProps {
  archive: RewindArchivedWeek[];
}

/**
 * Past weeks: a compact archive list, each row opening a read-only summary
 * so earlier Rewinds stay reachable without cluttering the current week.
 */
export function ArchiveList({ archive }: ArchiveListProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2>Past weeks</h2>
      <Card className="ring-foreground/8 py-0">
        <CardContent className="flex flex-col gap-0 px-0">
          {archive.map((week, index) => (
            <Dialog key={week.id}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
                    index > 0 && "border-t border-border"
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <History className="size-3.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-sm font-medium text-foreground">{week.weekLabel}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {week.achievementsKept} {week.achievementsKept === 1 ? "achievement" : "achievements"} kept,{" "}
                      {week.followUpsQueued} {week.followUpsQueued === 1 ? "follow-up" : "follow-ups"} queued
                    </p>
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{week.weekLabel}</DialogTitle>
                  <DialogDescription>Read-only summary.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 text-sm">
                  <p className="text-foreground">{week.shapeOfWeek}</p>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Kept</span>
                    <ul className="flex flex-col gap-1">
                      {week.highlightTitles.map((title) => (
                        <li key={title} className="text-xs text-foreground">
                          {title}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {week.followUpsQueued} {week.followUpsQueued === 1 ? "follow-up" : "follow-ups"} carried forward
                    from this week.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
