import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { ObservationCard } from "@/components/strategy/observation-card";
import type { StrategyObservation } from "@/lib/strategy-utils";
import type { Opportunity } from "@/lib/types";

interface KeyObservationsProps {
  observations: StrategyObservation[];
  opportunities: Opportunity[];
}

/**
 * Up to 3 seeded strategic observations (Miller's Law), each grounded in
 * real store data with an evidence expand. Never forces a third observation
 * when the signal behind it is too thin.
 */
export function KeyObservations({ observations, opportunities }: KeyObservationsProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>Key observations</h2>
        <CopilotTag />
      </div>
      {observations.length === 0 ? (
        <EmptyState message="Nothing stands out strongly enough yet, check back after a few more days of activity." />
      ) : (
        // A vertical stack, not a 3-column grid: an observation's pattern
        // line reads as a full sentence, not a short 2-4 word label like a
        // comparison verdict's, so it needs the page's full width to read
        // as one line or two, not the one-word-per-line wrap a 3-up grid
        // forces once the Copilot panel is open at a laptop width. See
        // docs/lessons.md's RDS-986 entry.
        <div className="flex flex-col gap-3">
          {observations.map((observation) => (
            <ObservationCard key={observation.id} observation={observation} opportunities={opportunities} />
          ))}
        </div>
      )}
    </section>
  );
}
