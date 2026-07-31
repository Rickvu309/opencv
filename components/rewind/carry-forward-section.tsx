import { CopilotTag } from "@/components/shared/copilot-tag";
import { CarryForwardCard } from "@/components/rewind/carry-forward-card";
import type { RewindCarryForward } from "@/lib/types";

interface CarryForwardSectionProps {
  carryForwards: RewindCarryForward[];
}

/**
 * The closing zone: 2 to 3 follow-up proposals for next week. Accepted ones
 * pin into the Home attention queue and, where they name one, add a next
 * action to that opportunity's plan.
 */
export function CarryForwardSection({ carryForwards }: CarryForwardSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>Carrying into next week</h2>
        <CopilotTag />
      </div>
      <div className="flex flex-col gap-3">
        {carryForwards.map((carryForward) => (
          <CarryForwardCard key={carryForward.id} carryForward={carryForward} />
        ))}
      </div>
    </section>
  );
}
