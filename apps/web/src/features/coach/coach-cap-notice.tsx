import { Hourglass } from "lucide-react"

import "./design/cap-notice.pen.css"

type Props = {
  modeLabel: string
  resetTime: string
  showUpgrade: boolean
}

export function CoachCapNotice({ modeLabel, resetTime, showUpgrade }: Props) {
  return (
    <div
      role="status"
      data-slot="coach-cap-notice"
      data-pen-surface="coach"
      className="flex items-center gap-3"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
        <Hourglass className="size-[15px] text-foreground" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[13px] leading-tight font-semibold">
          You’ve reached today’s {modeLabel} limit
        </p>
        <p className="text-[12.5px] leading-tight text-muted-foreground">
          Resets at {resetTime}.
          {showUpgrade ? " Upgrade to access Light and Max." : ""}
        </p>
      </div>
      {showUpgrade ? (
        <a
          data-cap-upgrade=""
          className="inline-flex h-8 shrink-0 items-center rounded-lg px-[14px] text-[13px] font-semibold"
          href="/settings/billing/upgrade"
        >
          Upgrade
        </a>
      ) : null}
    </div>
  )
}
