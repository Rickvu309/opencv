import Link from "next/link";
import { ListChecks, Scale, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Opportunity } from "@/lib/types";

/**
 * The closing action row: one per candidate, so every candidate keeps the
 * same follow-through options regardless of which one Copilot's verdicts
 * highlighted. "Make this my focus" here is the outline, secondary-weight
 * version of the same action the verdict cards already offer as their one
 * primary button (Hick's Law: exactly one visually primary focus action per
 * verdict card, this row keeps the choice reachable for every candidate
 * without competing for the same visual weight). "Back to the workspace"
 * closes the flow once a decision, or none, has been made.
 */
export function ComparisonDecisionActions({
  opportunities,
  onFocus,
}: {
  opportunities: Opportunity[];
  onFocus: (opportunity: Opportunity) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2>Decide and act</h2>
      <div className="flex flex-col gap-2">
        {opportunities.map((opportunity) => (
          <Card key={opportunity.id} size="sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/opportunities/${opportunity.id}`}
                className="min-w-0 truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                {opportunity.role} · {opportunity.company}
              </Link>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => onFocus(opportunity)}>
                  <Scale className="size-3.5" />
                  Make this my focus
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/opportunities/${opportunity.id}#actions`}>
                    <ListChecks className="size-3.5" />
                    Open Actions tab
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/opportunities/${opportunity.id}#materials`}>
                    <SquarePen className="size-3.5" />
                    Start CV tailoring
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button asChild size="sm" variant="outline" className="w-fit">
        <Link href="/opportunities">Back to the workspace</Link>
      </Button>
    </section>
  );
}
