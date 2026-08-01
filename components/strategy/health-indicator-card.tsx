"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import type { StrategyHealthIndicator, StrategyIndicatorState } from "@/lib/strategy-utils";

const STATE_TONE: Record<StrategyIndicatorState, keyof typeof CHIP_TONES> = {
  strong: "success",
  adequate: "warning",
  weak: "danger",
};

/**
 * One of the pipeline health summary's 3 indicators: a small meter and
 * count, a state word, and a one-line "how this is judged" behind a
 * Progressive Disclosure expand.
 */
export function HealthIndicatorCard({ indicator }: { indicator: StrategyHealthIndicator }) {
  const [open, setOpen] = useState(false);
  const tone = CHIP_TONES[STATE_TONE[indicator.state]];

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{indicator.label}</span>
        <Chip label={indicator.stateLabel} dotClassName={tone.dot} className={tone.className} />
      </div>
      <div className="flex items-center gap-2">
        <Progress value={indicator.meterValue} className="h-1.5" />
        <span className="shrink-0 text-sm font-semibold text-foreground">{indicator.displayValue}</span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-fit items-center gap-1 rounded text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        How this is judged
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open ? <p className="text-xs text-muted-foreground">{indicator.howJudged}</p> : null}
    </div>
  );
}
