import { LEVEL_LABELS } from "@/lib/data/skills";
import { cn } from "@/lib/utils";

interface SkillLevelMeterProps {
  level: number;
  targetLevel: number;
}

const LEVEL_COUNT = 4;

/**
 * Four labeled dots for a skill's current level, with a ring marker on the
 * target-level dot whenever it differs from the current one. Shared by the
 * skill map row and the gap insight list so the same anatomy reads current
 * versus needed level consistently everywhere it appears.
 */
export function SkillLevelMeter({ level, targetLevel }: SkillLevelMeterProps) {
  const hasTargetMarker = targetLevel !== level;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: LEVEL_COUNT }, (_, index) => index + 1).map((dot) => (
          <span
            key={dot}
            className={cn(
              "size-2.5 rounded-full",
              dot <= level ? "bg-primary" : "bg-muted",
              hasTargetMarker && dot === targetLevel && "ring-2 ring-offset-1 ring-primary/50 ring-offset-background"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {LEVEL_LABELS[level]}
        {hasTargetMarker ? <> &rarr; target {LEVEL_LABELS[targetLevel]}</> : null}
      </span>
    </div>
  );
}
