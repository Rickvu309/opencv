"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Route } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FitChip } from "@/components/shared/fit-chip";
import { useStore } from "@/lib/store";
import type { PathScenario } from "@/lib/types";

interface PathScenarioCardProps {
  scenario: PathScenario;
}

/**
 * One card in Zone 2, "Where this can go". A framing aid, not a commitment:
 * "Set as target direction" is the only action, and it quietly updates the
 * direction band rather than applying anything on its own.
 */
export function PathScenarioCard({ scenario }: PathScenarioCardProps) {
  const { setScenarioAsTargetDirection } = useStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3>{scenario.title}</h3>
            <FitChip fit={scenario.fitWithStrengths} />
          </div>
          <p className="text-sm text-muted-foreground">{scenario.description}</p>
        </div>

        {scenario.isClosestToCurrentTrajectory ? (
          <div className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-accent/40 p-3">
            <Badge className="w-fit">Closest to your current trajectory</Badge>
            <p className="text-xs text-muted-foreground">{scenario.closestReason}</p>
          </div>
        ) : null}

        <dl className="flex flex-col gap-1.5 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Optimizes for</dt>
            <dd className="text-foreground">{scenario.optimizesFor}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Main tradeoff</dt>
            <dd className="text-foreground">{scenario.tradeoff}</dd>
          </div>
        </dl>

        <div>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            What the next 6 months look like
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {expanded ? (
            <ul className="list-disc space-y-1 rounded-b-lg border border-t-0 border-dashed border-border px-3 py-2 pl-6 text-sm text-foreground">
              {scenario.nextSixMonths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="w-fit text-muted-foreground"
            onClick={() => setScenarioAsTargetDirection(scenario)}
          >
            Set as target direction
          </Button>
          <Button size="sm" variant="ghost" className="w-fit text-muted-foreground" asChild>
            <Link href="/planner">
              <Route className="size-3.5" />
              Work through this in the planner
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
