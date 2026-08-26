import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { CoachMode } from "@workspace/domain"

import {
  COACH_MODE_OPTIONS,
  coachModeHelper,
  coachModeLabel,
} from "@/features/home/coach-mode.ts"

type CoachModeSelectorProps = {
  mode: CoachMode
  onModeChange: (mode: CoachMode) => void
  showHelper?: boolean
  showPill?: boolean
  compact?: boolean
}

export function CoachModeSelector({
  mode,
  onModeChange,
  showHelper = true,
  showPill = false,
  compact = false,
}: CoachModeSelectorProps) {
  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      <div className="flex flex-wrap items-center gap-2">
        {showPill ? (
          <Badge variant="outline" className="text-[11px] font-medium">
            {coachModeLabel(mode)}
          </Badge>
        ) : null}
        <div
          role="radiogroup"
          aria-label="Coach mode"
          className="inline-flex rounded-full border border-border/80 bg-muted/40 p-0.5"
        >
          {COACH_MODE_OPTIONS.map((option) => {
            const selected = option.id === mode
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onModeChange(option.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
      {showHelper ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          {coachModeHelper(mode)}
          {mode === "free" ? (
            <>
              {" "}
              <a
                href="https://openrouter.ai/stealth/ox-alpha"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                OpenRouter listing
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
