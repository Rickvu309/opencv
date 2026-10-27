import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { CoachMode } from "@workspace/domain"

import {
  COACH_MODE_OPTIONS,
  coachModeHelper,
} from "@/features/coach/coach-mode.ts"

type CoachModeSelectorProps = {
  mode: CoachMode
  onModeChange: (mode: CoachMode) => void
  showHelper?: boolean
}

export function CoachModeSelector({
  mode,
  onModeChange,
  showHelper = true,
}: CoachModeSelectorProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Coach mode"
          className="inline-flex rounded-full border border-border/80 bg-muted/40 p-0.5"
        >
          {COACH_MODE_OPTIONS.map((option) => {
            const selected = option.id === mode
            return (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                size="xs"
                role="radio"
                aria-checked={selected}
                onClick={() => onModeChange(option.id)}
                className={cn(
                  "rounded-full px-2.5",
                  selected
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      </div>
      {showHelper ? (
        <p className="text-xs leading-4 text-muted-foreground">
          {coachModeHelper(mode)}
          {mode === "free" ? (
            <>
              {" "}
              <a
                href="https://openrouter.ai/openrouter/free"
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
