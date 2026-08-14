import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Stage the lattice is tuned on; `--orb-k` scales it to `size`. */
const STAGE = 28;
const SIZE = 20;
const N = 3;
const PITCH = 6;
const MID = (N - 1) / 2;

/**
 * S1 — radiates from the centre on a round wavefront. Centre leads a beat
 * early so the next swell does not sit behind the outer fade.
 */
function cellDelay(x: number, y: number): number {
  const dx = x - MID;
  const dy = y - MID;
  return Math.hypot(dx, dy) * 700 - (dx === 0 && dy === 0 ? 180 : 0);
}

function latticeCells() {
  const cells: {
    key: string;
    left: number;
    top: number;
    delay: number;
    mid: boolean;
  }[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      cells.push({
        key: `${x},${y}`,
        left: x * PITCH,
        top: y * PITCH,
        delay: cellDelay(x, y),
        mid: x === MID && y === MID,
      });
    }
  }
  return cells;
}

const CELLS = latticeCells();

/**
 * AICSS Orb S1, house tokens. Thinking only — not a second family of
 * activity verbs. Reduced motion keeps the centre cell lit.
 */
export function ThinkingOrb({
  size = SIZE,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("coach-orb", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={
        {
          width: size,
          height: size,
          "--orb-k": size / STAGE,
        } as CSSProperties
      }
    >
      <span className="coach-orb-lattice">
        {CELLS.map((cell) => (
          <span
            key={cell.key}
            className="coach-orb-cell"
            data-mid={cell.mid || undefined}
            style={{
              left: cell.left,
              top: cell.top,
              animationDelay: `${cell.delay}ms`,
            }}
          />
        ))}
      </span>
    </span>
  );
}
