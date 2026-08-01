import { Card, CardContent } from "@/components/ui/card";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { FitChip } from "@/components/shared/fit-chip";
import { PriorityChip } from "@/components/shared/priority-chip";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { opportunities } from "@/lib/data/opportunities";
import { insights } from "@/lib/data/insights";
import type { FitInsight } from "@/lib/types";

const opportunity = opportunities.find((candidate) => candidate.id === "opp-1")!;
const fitInsight = insights.find(
  (candidate): candidate is FitInsight => candidate.id === "insight-opp-1-fit" && candidate.kind === "fit"
)!;

/**
 * The hero's one restrained product visual (brief section 2): a single
 * real fit judgment, cropped tight, no five-beat controls, no board, just
 * enough to show the product judges fit in the open rather than asserting
 * it. The 4 signature showcases further down the page carry the weight;
 * this one stays quiet on purpose (Serial Position keeps the message in the
 * headline, not the image).
 */
export function HeroVisual() {
  return (
    <BrowserFrame address="openpath.app/opportunities/opp-1" contentWidth={720} cropHeight={300} className="w-full">
      <div className="w-[720px] p-5">
        <Card className="ring-foreground/8">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-sm font-semibold text-foreground">{opportunity.role}</p>
                <p className="truncate text-xs text-muted-foreground">{opportunity.company}</p>
              </div>
              <CopilotTag className="shrink-0" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FitChip fit={fitInsight.level} />
              <PriorityChip priority={opportunity.priority} />
              <ConfidenceChip confidence={fitInsight.confidence} />
            </div>
            <p className="text-sm text-muted-foreground">{fitInsight.alignmentLine}</p>
          </CardContent>
        </Card>
      </div>
    </BrowserFrame>
  );
}
