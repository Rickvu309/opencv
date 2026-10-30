import { useEffect, useReducer } from "react"
import { Check, Circle, Clock, X } from "lucide-react"
import { Spinner } from "@workspace/ui/components/spinner"
import { ThinkingLoader } from "@workspace/ui/components/thinking-loader"
import { cn } from "@workspace/ui/lib/utils"

import type { CoachProgressRow, CoachProgressStatus } from "./coach-progress.ts"

function elapsedReducer(
  _seconds: number,
  action: { type: "ticked"; seconds: number }
) {
  return action.seconds
}

const STATUS_NOTE: Record<CoachProgressStatus, string> = {
  reported: "reported",
  running: "running",
  completed: "completed",
  failed: "failed",
  approval: "awaiting confirmation",
}

const ICON = "mt-0.5 size-3.5 shrink-0"

function StatusIcon({ status }: { status: CoachProgressStatus }) {
  if (status === "running")
    return (
      <Spinner
        role="presentation"
        aria-hidden="true"
        aria-label={undefined}
        className={cn(ICON, "motion-reduce:animate-none")}
      />
    )
  const Icon =
    status === "completed"
      ? Check
      : status === "failed"
        ? X
        : status === "approval"
          ? Clock
          : Circle
  return <Icon aria-hidden="true" className={ICON} />
}

export function CoachWorking({
  rows = [],
}: {
  rows?: readonly CoachProgressRow[]
}) {
  const [seconds, dispatch] = useReducer(elapsedReducer, 0)
  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(
      () =>
        dispatch({
          type: "ticked",
          seconds: Math.floor((Date.now() - startedAt) / 1000),
        }),
      1000
    )
    return () => clearInterval(timer)
  }, [])
  return (
    <div data-slot="coach-working" className="space-y-3">
      <ThinkingLoader phases={[`Working, ${seconds}s`]} />
      {rows.length ? (
        <ol
          data-slot="coach-progress"
          aria-label="Coach progress"
          aria-live="polite"
          className="space-y-2 border-s border-border ps-3 text-sm"
        >
          {rows.map(({ id, label, status }) => (
            <li
              key={id}
              data-slot="coach-progress-row"
              data-status={status}
              aria-busy={status === "running" ? true : undefined}
              className={cn(
                "flex items-start gap-2",
                status === "completed"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <StatusIcon status={status} />
              <span>
                {label}
                <span className="sr-only">, {STATUS_NOTE[status]}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
