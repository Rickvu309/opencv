import { Hourglass } from "lucide-react"

import "./design/cap-notice.css"

type Props = {
  modeLabel: string
  resetTime: string
}

export function CoachCapNotice({ modeLabel, resetTime }: Props) {
  return (
    <div
      role="status"
      data-slot="coach-cap-notice"
      data-surface="coach"
      className="flex items-center gap-3"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
        <Hourglass className="size-[15px] text-foreground" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-ui leading-tight font-semibold">
          You’ve reached today’s {modeLabel} limit
        </p>
        <p className="text-xs leading-tight text-muted-foreground">
          Resets {resetTime}.
        </p>
      </div>
    </div>
  )
}
