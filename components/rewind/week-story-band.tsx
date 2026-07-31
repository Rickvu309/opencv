import Link from "next/link";
import { Mail } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ThemeClusterCard } from "@/components/rewind/theme-cluster-card";
import { emailEvidence, meetingNoteEvidence } from "@/lib/data/sources";
import type { RewindWeekStory } from "@/lib/types";

interface WeekStoryBandProps {
  story: RewindWeekStory;
}

/**
 * Rewind's top band: the week's story, summary first (Progressive
 * Disclosure). A one-line shape of the week, 3 compact theme clusters
 * (Miller's Law: never more per glance), then a quiet connected-context line
 * linking to /sources so the evidence behind the story is one click away.
 */
export function WeekStoryBand({ story }: WeekStoryBandProps) {
  return (
    <Card className="rounded-none border-x-0 border-t-0 ring-0">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">{story.weekLabel}</p>
          <p className="text-display break-words">{story.shapeOfWeek}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {story.clusters.map((cluster) => (
            <ThemeClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              Built from your activity, {emailEvidence.length} emails, {meetingNoteEvidence.length} meeting notes.
            </p>
            <Link
              href="/sources"
              className="w-fit text-xs font-medium text-foreground underline-offset-2 hover:underline"
            >
              Open Sources
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
