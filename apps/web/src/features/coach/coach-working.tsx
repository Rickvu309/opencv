import { useEffect, useReducer } from "react"
import { CircleCheck, Circle, Clock, X } from "lucide-react"
import { Spinner } from "@workspace/ui/components/spinner"
import "./design/working.pen.css"

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

const ICON = "size-4 shrink-0"

function StatusIcon({ status }: { status: CoachProgressStatus }) {
  if (status === "running")
    return (
      <Spinner
        role="presentation"
        aria-hidden="true"
        aria-label={undefined}
        className={`${ICON} motion-reduce:animate-none`}
      />
    )
  const Icon =
    status === "completed"
      ? CircleCheck
      : status === "failed"
        ? X
        : status === "approval"
          ? Clock
          : Circle
  return <Icon aria-hidden="true" className={ICON} />
}

export function CoachWorking({
  rows = [],
  showHeader = true,
}: {
  rows?: readonly CoachProgressRow[]
  showHeader?: boolean
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
    <div data-pen-surface="coach" data-slot="coach-working">
      {showHeader ? (
        <>
          {/* The ticking seconds stay visual; the live region says Working once. */}
          <span role="status" className="sr-only">
            Working
          </span>
          <div data-slot="coach-working-heading" aria-hidden="true">
            Working, {seconds}s
          </div>
        </>
      ) : null}
      {rows.length ? (
        <ol
          data-slot="coach-progress"
          aria-label="Coach progress"
          aria-live="polite"
        >
          {rows.map(({ id, label, status }) => (
            <li
              key={id}
              data-slot="coach-progress-row"
              data-status={status}
              aria-busy={status === "running" ? true : undefined}
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
