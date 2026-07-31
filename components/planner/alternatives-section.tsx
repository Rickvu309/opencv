"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { FitChip } from "@/components/shared/fit-chip";
import type { PathScenario } from "@/lib/types";

interface AlternativesSectionProps {
  /** The 2 seeded scenarios that are not the current working path. Hick's Law: capped at what Goals seeds, never more. */
  alternatives: PathScenario[];
  whatWouldChangeRanking: string;
  onChoose: (scenario: PathScenario) => void;
}

/**
 * Zone 3: a decision aid, not a broadening. Identical comparable rows for
 * every alternative, so choosing one is a real comparison rather than
 * reading two more free-form cards. Picking one calls the same store action
 * Goals' "Set as target direction" uses, which updates zone 2 above and the
 * target direction everywhere else it appears.
 */
export function AlternativesSection({ alternatives, whatWouldChangeRanking, onChoose }: AlternativesSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2>Alternatives</h2>
            <CopilotTag />
          </div>
          <AskCopilotButton surface="Path Planner" objectLabel="Alternatives" />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40" />
                {alternatives.map((scenario) => (
                  <TableHead key={scenario.id}>
                    <div className="flex flex-col gap-1 whitespace-normal py-1">
                      <span className="font-semibold text-foreground">{scenario.title}</span>
                      <FitChip fit={scenario.fitWithStrengths} />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground">Optimizes for</TableCell>
                {alternatives.map((scenario) => (
                  <TableCell key={scenario.id} className="whitespace-normal text-foreground">
                    {scenario.optimizesFor}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground">Main tradeoff</TableCell>
                {alternatives.map((scenario) => (
                  <TableCell key={scenario.id} className="whitespace-normal text-foreground">
                    {scenario.tradeoff}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground">Readiness today</TableCell>
                {alternatives.map((scenario) => (
                  <TableCell key={scenario.id} className="whitespace-normal text-foreground">
                    {scenario.readinessToday}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground">Time to viable</TableCell>
                {alternatives.map((scenario) => (
                  <TableCell key={scenario.id} className="whitespace-normal text-foreground">
                    {scenario.timeToViable}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground">Evidence strength</TableCell>
                {alternatives.map((scenario) => (
                  <TableCell key={scenario.id}>
                    <FitChip fit={scenario.evidenceStrength} />
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground">Choose this path</TableCell>
                {alternatives.map((scenario) => (
                  <TableCell key={scenario.id}>
                    <Button size="sm" variant="outline" onClick={() => onChoose(scenario)}>
                      Work through this path
                    </Button>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            What the next 6 months look like for each
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {expanded ? (
            <div className="grid grid-cols-1 gap-3 rounded-b-lg border border-t-0 border-dashed border-border p-3 sm:grid-cols-2">
              {alternatives.map((scenario) => (
                <div key={scenario.id} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">{scenario.title}</span>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {scenario.nextSixMonths.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">What would change this ranking: </span>
          {whatWouldChangeRanking}
        </p>
      </CardContent>
    </Card>
  );
}
