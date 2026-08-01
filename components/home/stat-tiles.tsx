import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Opportunity, OpportunityStatus } from "@/lib/types";

const STATUSES: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];

interface StatTilesProps {
  opportunities: Opportunity[];
  needsDecisionCount: number;
}

function Tile({
  value,
  label,
  href,
  emphasis,
}: {
  value: number;
  label: string;
  href: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-center transition-colors hover:bg-muted/60"
    >
      <span className={cn("text-xl font-semibold tracking-tight", emphasis && value > 0 && "text-primary")}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}

/**
 * Home's five-second-glance strip: two headline signal tiles (how many
 * items need a decision right now, how many interviews are active this
 * week) plus the pipeline status breakdown, all in one compact row instead
 * of a sentence and a separate card. Every tile deep-links to the filtered
 * view it summarizes.
 */
export function StatTiles({ opportunities, needsDecisionCount }: StatTilesProps) {
  const interviewCount = opportunities.filter((opportunity) => opportunity.status === "Interview").length;

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex items-stretch gap-1">
        <Tile value={needsDecisionCount} label="Needs a decision" href="/home#decisions" emphasis />
        <Tile value={interviewCount} label="Interviews this week" href="/opportunities?status=Interview" />
        <Separator orientation="vertical" className="mx-1 h-auto self-stretch" />
        {STATUSES.map((status) => (
          <Tile
            key={status}
            value={opportunities.filter((opportunity) => opportunity.status === status).length}
            label={status}
            href={`/opportunities?status=${status}`}
          />
        ))}
      </CardContent>
    </Card>
  );
}
