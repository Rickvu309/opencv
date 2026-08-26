import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
      {showPill ? (
        <Badge variant="outline" className="text-micro font-medium">
          {coachModeLabel(mode)}
        </Badge>
      ) : null}
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
        <p className="text-micro leading-4 text-muted-foreground">
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
