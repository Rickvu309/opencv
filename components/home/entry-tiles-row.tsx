"use client";

import { ObjectCard } from "@/components/shared/object-card";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { getRecommendedNextMove } from "@/lib/planner-utils";
import { getRewindEntryState, getStrategyEntryState } from "@/lib/home-utils";
import { useStore } from "@/lib/store";

function EntryStateChip({ label, tone }: { label: string; tone: "success" | "neutral" }) {
  const style = CHIP_TONES[tone];
  return <Chip label={label} dotClassName={style.dot} className={style.className} />;
}

/**
 * Home's entry tiles (RDS-993): Rewind and Strategy are weekly-cadence
 * surfaces, so they never render their own content on Home, only a state
 * chip and one line, the same shape Planner's next move gets even though
 * Planner has no weekly cadence of its own. Reuses ObjectCard (title, a
 * chip row, one meta line, the whole tile as a link) rather than a fourth
 * hand-rolled card shape.
 */
export function EntryTilesRow() {
  const { state } = useStore();
  const rewindState = getRewindEntryState(state.rewindViewedThisSession);
  const strategyState = getStrategyEntryState(state.strategyMoveStates);
  const nextMove = getRecommendedNextMove(state.planItems, state.workingPathScenarioId);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <ObjectCard
        title="Rewind"
        href="/rewind"
        chips={<EntryStateChip label={rewindState.chipLabel} tone={rewindState.tone} />}
        meta={rewindState.line}
      />
      <ObjectCard
        title="Strategy"
        href="/strategy"
        chips={<EntryStateChip label={strategyState.chipLabel} tone={strategyState.tone} />}
        meta={strategyState.line}
      />
      <ObjectCard
        title="Planner"
        href="/planner"
        chips={
          <EntryStateChip label={nextMove ? "Next move" : "Caught up"} tone={nextMove ? "neutral" : "success"} />
        }
        meta={nextMove ? nextMove.title : "No move queued right now."}
      />
    </div>
  );
}
