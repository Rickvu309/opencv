import type { CoachMode } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import {
  coachCopy,
  freeModeLine,
  lightModeLine,
  maxModeLine,
} from "./coach-copy.ts"
import type { CoachUsageView } from "./coach-model.ts"

const MODES = ["free", "light", "max"] as const

type Props = {
  mode: CoachMode
  usage: CoachUsageView | null
  disabled?: boolean
  onMode: (mode: CoachMode) => void
}

function detail(mode: CoachMode, usage: CoachUsageView | null) {
  if (!usage) return ""
  if (mode === "free") {
    const cap = usage.caps.free
    if (cap === 0) return "Quick edits"
    const remaining =
      usage.mode === "free" && typeof usage.day.remaining === "number"
        ? usage.day.remaining
        : cap
    return freeModeLine(remaining, cap)
  }
  if (mode === "light") {
    return usage.caps.light === 0 ? "Stronger drafts" : lightModeLine(usage.caps.light)
  }
  return usage.caps.max === 0 ? "Hardest rewrites" : maxModeLine(usage.caps.max)
}

function label(mode: CoachMode) {
  if (mode === "light") return coachCopy.light
  if (mode === "max") return coachCopy.max
  return coachCopy.free
}

export function CoachModeMenu({ mode, usage, disabled, onMode }: Props) {
  const pro = usage?.plan !== "pro"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
        disabled={disabled}
        aria-label={label(mode)}
      >
        {label(mode)}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-72">
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => onMode(value as CoachMode)}
        >
          {MODES.map((item) => (
            <DropdownMenuRadioItem key={item} value={item}>
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  {label(item)}
                  {pro && item !== "free" ? (
                    <span className="text-xs text-muted-foreground">
                      {coachCopy.pro}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {detail(item, usage)}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
