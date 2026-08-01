"use client";

import Link from "next/link";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { CarryForwardCard } from "@/components/rewind/carry-forward-card";
import { useStore } from "@/lib/store";
import type { RewindCarryForward } from "@/lib/types";

interface CarryForwardSectionProps {
  carryForwards: RewindCarryForward[];
}

/**
 * The closing zone: 2 to 3 follow-up proposals for next week. Accepted ones
 * pin into the Home attention queue and, where they name one, add a next
 * action to that opportunity's plan. Adds one quiet line into /strategy
 * when this session already accepted moves from the weekly focus plan, so
 * the two recurring surfaces stay connected rather than siloed.
 */
export function CarryForwardSection({ carryForwards }: CarryForwardSectionProps) {
  const { state } = useStore();
  const strategyMovesAccepted = Object.values(state.strategyMoveStates).filter(
    (decision) => decision === "approved"
  ).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>Carrying into next week</h2>
        <CopilotTag />
      </div>
      {strategyMovesAccepted > 0 ? (
        <p className="text-xs text-muted-foreground">
          {strategyMovesAccepted} focus {strategyMovesAccepted === 1 ? "move" : "moves"} accepted this week, see the{" "}
          <Link href="/strategy" className="font-medium text-foreground hover:underline">
            full plan
          </Link>
          .
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        {carryForwards.map((carryForward) => (
          <CarryForwardCard key={carryForward.id} carryForward={carryForward} />
        ))}
      </div>
    </section>
  );
}
