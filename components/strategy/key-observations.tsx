import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { ObservationCard } from "@/components/strategy/observation-card";
import { buildStrategyObservations } from "@/lib/strategy-utils";
import type { Opportunity } from "@/lib/types";

interface KeyObservationsProps {
  opportunities: Opportunity[];
  todayIso: string;
}

/**
 * Up to 3 seeded strategic observations (Miller's Law), each grounded in
 * real store data with an evidence expand. Never forces a third observation
 * when the signal behind it is too thin.
 */
export function KeyObservations({ opportunities, todayIso }: KeyObservationsProps) {
  const observations = buildStrategyObservations(opportunities, todayIso);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>Key observations</h2>
        <CopilotTag />
      </div>
      {observations.length === 0 ? (
        <EmptyState message="Nothing stands out strongly enough yet, check back after a few more days of activity." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {observations.map((observation) => (
            <ObservationCard key={observation.id} observation={observation} opportunities={opportunities} />
          ))}
        </div>
      )}
    </section>
  );
}
