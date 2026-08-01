import { Card, CardContent } from "@/components/ui/card";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { HealthIndicatorCard } from "@/components/strategy/health-indicator-card";
import { buildHealthIndicators, buildPipelineVerdict } from "@/lib/strategy-utils";
import type { NextAction, Opportunity } from "@/lib/types";

interface PipelineHealthBandProps {
  opportunities: Opportunity[];
  nextActions: NextAction[];
  todayIso: string;
}

/**
 * The Strategy surface's opening band: one verdict line plus 3 compact
 * health indicators (Miller's Law caps this at 3), all computed live off
 * the store rather than a fixed script.
 */
export function PipelineHealthBand({ opportunities, nextActions, todayIso }: PipelineHealthBandProps) {
  const indicators = buildHealthIndicators(opportunities, nextActions, todayIso);
  const verdict = buildPipelineVerdict(indicators);

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm font-medium text-foreground">{verdict}</p>
          <CopilotTag className="shrink-0" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {indicators.map((indicator) => (
            <HealthIndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
