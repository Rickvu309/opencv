import Link from "next/link";
import { Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_COMPARISON, MIN_COMPARISON } from "@/lib/comparison-utils";
import { buildStrategySegments } from "@/lib/strategy-utils";
import type { NextAction, Opportunity } from "@/lib/types";

interface SegmentStripProps {
  opportunities: Opportunity[];
  nextActions: NextAction[];
  todayIso: string;
}

function SegmentLink({ count, label, href }: { count: number; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
    >
      <span className="text-xl font-semibold tracking-tight text-foreground">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}

/**
 * One compact segment strip, not a dashboard: 3 clickable counts that open
 * /opportunities pre-filtered (Miller's Law caps this at 3), plus a
 * shortcut into the RDS-985 comparison flow with the strong-fit ids
 * preselected.
 */
export function SegmentStrip({ opportunities, nextActions, todayIso }: SegmentStripProps) {
  const segments = buildStrategySegments(opportunities, nextActions, todayIso);
  const compareIds = segments.strongFitActive.slice(0, MAX_COMPARISON).map((opportunity) => opportunity.id);
  const canCompare = compareIds.length >= MIN_COMPARISON;

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentLink
            count={segments.strongFitActive.length}
            label="Strong fit active"
            href="/opportunities?filter=strong-fit"
          />
          <SegmentLink
            count={segments.staleOrDrifting.length}
            label="Stale or drifting"
            href="/opportunities?filter=needs-attention"
          />
          <SegmentLink
            count={segments.lowFitEffort.length}
            label="Low fit, still consuming effort"
            href="/opportunities?filter=low-fit-effort"
          />
        </div>
        {canCompare ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/opportunities/compare?ids=${compareIds.join(",")}`}>
              <Scale className="size-4" />
              Compare the top candidates
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
