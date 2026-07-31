import { CopilotTag } from "@/components/shared/copilot-tag";
import { buildTradeoffLines } from "@/lib/comparison-utils";
import { useStore } from "@/lib/store";
import type { Opportunity } from "@/lib/types";

/**
 * "The real tradeoffs": 2 to 3 lines naming the biggest divergences between
 * these specific candidates, one clause per candidate (its own strongest
 * point, but its own honest caveat), picking the most differentiated
 * candidates when 4 are selected so the strip never grows past 3 lines.
 */
export function ComparisonTradeoffs({ opportunities }: { opportunities: Opportunity[] }) {
  const { state } = useStore();
  const lines = buildTradeoffLines(opportunities, state.comparisonProfiles, state.insights);

  if (lines.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2>The real tradeoffs</h2>
        <CopilotTag />
      </div>
      <div className="flex flex-col gap-1 rounded-lg bg-muted/30 px-4 py-3">
        {lines.map((line) => (
          <p key={line} className="text-sm text-foreground">
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
