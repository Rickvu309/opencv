import Link from "next/link";
import { Briefcase, GraduationCap, History, Route, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FitChip } from "@/components/shared/fit-chip";
import type { Opportunity } from "@/lib/types";

interface ConnectionsSectionProps {
  strengthensOpportunities: Opportunity[];
}

/**
 * Zone 5: the roadmap never dead-ends on itself. One row out to every
 * surface a milestone's drill-in already links piecemeal (Path Planner,
 * Skills & Learning, Goals, Track Record), plus the 2 opportunities this
 * working path most directly strengthens, named rather than just counted.
 */
export function ConnectionsSection({ strengthensOpportunities }: ConnectionsSectionProps) {
  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-3">
        <h2>Connections</h2>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">See it everywhere else it lives</span>
          <div className="flex flex-wrap gap-1.5">
            <Button asChild size="sm" variant="outline">
              <Link href="/planner">
                <Route className="size-3.5" />
                Path Planner
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/skills">
                <GraduationCap className="size-3.5" />
                Skills &amp; Learning
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/goals">
                <Target className="size-3.5" />
                Goals
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/track-record">
                <History className="size-3.5" />
                Track Record
              </Link>
            </Button>
          </div>
        </div>

        {strengthensOpportunities.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Strengthens</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              {strengthensOpportunities.map((opportunity) => (
                <Button key={opportunity.id} asChild size="sm" variant="outline" className="h-auto justify-start py-1.5">
                  <Link href={`/opportunities/${opportunity.id}`} className="flex items-center gap-2">
                    <Briefcase className="size-3.5 shrink-0" />
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-xs font-medium">{opportunity.role}</span>
                      <span className="text-[11px] text-muted-foreground">{opportunity.company}</span>
                    </span>
                    <FitChip fit={opportunity.fit} className="ml-1 shrink-0" />
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
