import { useState } from "react";
import { cn } from "../../cn";
import "./beautiful.css";
import { DemoSwitch } from "./demo-switch";
import { useElapsed, usePrefersReducedMotion } from "./hooks";

export type LoadingVariant = "drive" | "dots" | "orbit" | "surfer";

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3);
  const c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i);
  return k === -1 ? null : k * 110;
});

const PATTERNS: Record<
  Exclude<LoadingVariant, "surfer">,
  { delays: (number | null)[]; dur: number; round: boolean }
> = {
  drive: { delays: chevron, dur: 650, round: false },
  dots: { delays: chevron, dur: 650, round: true },
  orbit: { delays: orbit, dur: 950, round: false },
};

function LoaderGrid({
  delays,
  dur,
  round,
  reduced,
}: {
  delays: (number | null)[];
  dur: number;
  round: boolean;
  reduced: boolean;
}) {
  return (
    <span aria-hidden className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]">
      {delays.map((delay, index) => (
        <span
          key={index}
          className={cn("size-[4px] bg-ink", round ? "rounded-full" : "rounded-[1px]")}
          style={{
            opacity: delay === null || reduced ? 0.35 : 0.15,
            animation:
              delay === null || reduced
                ? "none"
                : `beautiful-pixel-on ${dur}ms var(--ease-out) ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

export interface LoadingStateProps {
  label?: string;
  variant?: LoadingVariant;
  showSwitcher?: boolean;
}

export function LoadingState({
  label,
  variant: variantProp,
  showSwitcher = true,
}: LoadingStateProps) {
  const [variant, setVariant] = useState<LoadingVariant>(variantProp ?? "drive");
  const elapsed = useElapsed();
  const reduced = usePrefersReducedMotion();
  const surfer = variant === "surfer";
  const resolvedLabel = label ?? (surfer ? "Reading" : "Working");
  const pattern = PATTERNS[surfer ? "drive" : variant];

  const labelEl = (
    <span className={cn("text-[13px] font-[510]", reduced ? "text-ink-muted" : "beautiful-shimmer")}>
      {resolvedLabel}
    </span>
  );
  const elapsedEl = (
    <span className="font-mono text-[12px] text-ink-faint tabular-nums">{elapsed}</span>
  );

  return (
    <div className="flex w-full flex-col items-start">
      <div role="status" className="flex w-fit items-center gap-2.5">
        <LoaderGrid {...pattern} reduced={reduced} />
        {labelEl}
        {elapsedEl}
      </div>
      {surfer ? (
        <div className="mt-2 w-56 overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-2">
          <div className="flex aspect-video items-center justify-center">
            <LoaderGrid {...PATTERNS.drive} reduced={reduced} />
          </div>
        </div>
      ) : null}
      {showSwitcher ? (
        <DemoSwitch
          value={variant}
          onChange={setVariant}
          options={["drive", "dots", "orbit", "surfer"] as const}
        />
      ) : null}
    </div>
  );
}
