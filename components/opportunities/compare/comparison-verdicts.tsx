import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { WhyThisReading } from "@/components/shared/why-this-reading";
import { Card, CardContent } from "@/components/ui/card";
import {
  VERDICT_LABELS,
  buildComparisonVerdicts,
  buildVerdictExpandedReasoning,
  buildWhatCouldChangeVerdicts,
} from "@/lib/comparison-utils";
import { useStore } from "@/lib/store";
import type { Opportunity } from "@/lib/types";

/**
 * The Copilot decision layer: up to 3 verdict cards (Hick's Law caps this
 * at 3, never more), each naming one candidate. Two verdicts landing on the
 * same candidate merge into one card with both badges rather than showing
 * the same opportunity twice. Closes with one honest line on what would
 * change the read. Each card's one primary action is "Make this my focus"
 * (Hick's Law: one primary action per card, the closing action row below
 * offers the same choice for every candidate as a secondary option).
 */
export function ComparisonVerdicts({
  opportunities,
  onFocus,
}: {
  opportunities: Opportunity[];
  onFocus: (opportunity: Opportunity) => void;
}) {
  const { state } = useStore();
  const verdicts = buildComparisonVerdicts(opportunities, state.comparisonProfiles, state.insights, state.nextActions);
  const whatCouldChange = buildWhatCouldChangeVerdicts(opportunities, verdicts, state.nextActions);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>Copilot&apos;s read</h2>
        <CopilotTag />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {verdicts.map((verdict) => {
          const opportunity = opportunities.find((entry) => entry.id === verdict.opportunityId);
          if (!opportunity) return null;
          const primaryKind = verdict.kinds[0];

          return (
            <Card key={verdict.opportunityId} size="sm">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {verdict.kinds.map((kind) => (
                      <span
                        key={kind}
                        className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                      >
                        {VERDICT_LABELS[kind]}
                      </span>
                    ))}
                  </div>
                  <CopilotTag className="shrink-0" />
                </div>

                <Link
                  href={`/opportunities/${opportunity.id}`}
                  className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {opportunity.role} · {opportunity.company}
                </Link>

                <p className="text-xs text-muted-foreground">{verdict.why}</p>

                <div className="flex items-center justify-between gap-2">
                  <ConfidenceChip confidence={verdict.confidence} />
                </div>

                <WhyThisReading
                  text={buildVerdictExpandedReasoning(primaryKind, opportunity, state.insights, state.nextActions)}
                />

                <Button size="sm" className="mt-1 w-fit" onClick={() => onFocus(opportunity)}>
                  Make this my focus
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{whatCouldChange}</p>
    </section>
  );
}
