"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { CopilotTag } from "@/components/shared/copilot-tag";
import type { StrategyObservation } from "@/lib/strategy-utils";
import type { Opportunity } from "@/lib/types";

interface ObservationCardProps {
  observation: StrategyObservation;
  opportunities: Opportunity[];
}

/**
 * One key observation: the pattern, why it matters, an honest hedge when
 * the signal is thin, and an evidence expand listing the real opportunities
 * behind it (Progressive Disclosure).
 */
export function ObservationCard({ observation, opportunities }: ObservationCardProps) {
  const [open, setOpen] = useState(false);
  const evidence = observation.evidenceOpportunityIds
    .map((id) => opportunities.find((opportunity) => opportunity.id === id))
    .filter((opportunity): opportunity is Opportunity => Boolean(opportunity));

  return (
    <Card size="sm" className="ring-foreground/8">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{observation.pattern}</p>
          <CopilotTag className="shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground">{observation.whyItMatters}</p>
        {observation.hedge ? <p className="text-xs text-muted-foreground italic">{observation.hedge}</p> : null}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-fit items-center gap-1 rounded text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
        >
          Evidence
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
        {open ? (
          <ul className="flex flex-col gap-1">
            {evidence.map((opportunity) => (
              <li key={opportunity.id}>
                <Link
                  href={`/opportunities/${opportunity.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {opportunity.role} · {opportunity.company}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
