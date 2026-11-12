import { Shimmer } from "@/components/ai-elements/shimmer.tsx"
import { humanToolText } from "./coach-tool-labels.ts"
import { CircleCheck, Circle, Clock, Lightbulb, X } from "lucide-react"
import { Spinner } from "@workspace/ui/components/spinner"
import "./design/working.pen.css"

import type { CoachProgressRow, CoachProgressStatus } from "./coach-progress.ts"

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
  return (
    <div data-pen-surface="coach" data-slot="coach-working">
      {showHeader ? (
        <>
          <span role="status" className="sr-only">
            Working
          </span>
          <div data-slot="coach-working-heading" aria-hidden="true">
            <Lightbulb className="size-[14px] shrink-0" />
            <Shimmer>Working</Shimmer>
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
                {humanToolText(label)}
                <span className="sr-only">, {STATUS_NOTE[status]}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
