import { useReducer } from "react"
import { Check, Circle, Clock, X } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvMark } from "@/components/app-logo.tsx"

import type { CoachProgressStatus } from "./coach-progress.ts"
import { humanToolText } from "./coach-tool-labels.ts"
import "./design/working.pen.css"

export type CoachWorkStep = {
  id: string
  label: string
  status: CoachProgressStatus
}

const STATUS_NOTE: Record<CoachProgressStatus, string> = {
  reported: "reported",
  running: "running",
  completed: "completed",
  failed: "failed",
  approval: "awaiting confirmation",
}

function workedForText(workedMs: number) {
  return `Worked for ${Math.max(1, Math.round(workedMs / 1000))}s`
}

function StepIcon({ status }: { status: CoachProgressStatus }) {
  if (status === "running")
    return (
      <span data-slot="coach-step-icon" aria-hidden="true">
        <span data-slot="coach-step-spinner" />
      </span>
    )
  const Icon =
    status === "completed"
      ? Check
      : status === "failed"
        ? X
        : status === "approval"
          ? Clock
          : Circle
  return (
    <span data-slot="coach-step-icon" aria-hidden="true">
      <Icon className="size-3.5 motion-appear" />
    </span>
  )
}

function WorkSteps({
  steps,
  live,
}: {
  steps: readonly CoachWorkStep[]
  live: boolean
}) {
  if (!live)
    return (
      <ol data-slot="coach-read-traces">
        {steps.map(({ id, label, status }) => (
          <li key={id} data-slot="coach-read-trace">
            <StepIcon status={status} />
            <span>{label}</span>
          </li>
        ))}
      </ol>
    )
  return (
    <ol
      data-slot="coach-progress"
      aria-label="Coach progress"
      aria-live="polite"
    >
      {steps.map(({ id, label, status }) => (
        <li
          key={id}
          data-slot="coach-progress-row"
          data-status={status}
          aria-busy={status === "running" ? true : undefined}
          className="not-first:motion-rise"
        >
          <StepIcon key={status} status={status} />
          <span>
            {humanToolText(label)}
            <span className="sr-only">, {STATUS_NOTE[status]}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function WorkLabel({ text, live }: { text: string; live: boolean }) {
  return (
    <span data-slot="coach-work-label">
      <span
        key={text}
        className={cn(
          "motion-swap",
          live && "motion-safe:animate-pulse motion-reduce:animate-none"
        )}
      >
        {text}
      </span>
    </span>
  )
}

function chosen(_: boolean | null, open: boolean) {
  return open
}

export function CoachWorkFold({
  steps,
  live,
  announce = false,
  writing = false,
  workedMs = null,
}: {
  steps: readonly CoachWorkStep[]
  live: boolean
  announce?: boolean
  writing?: boolean
  workedMs?: number | null
}) {
  const [choice, choose] = useReducer(chosen, null)
  const running = steps.some((step) => step.status === "running")
  const open = steps.length > 0 && (choice ?? (live && (!writing || running)))
  const label = live || !workedMs ? "Working" : workedForText(workedMs)
  return (
    <Collapsible
      data-slot={live ? "coach-working" : "coach-worked-for"}
      data-pen-surface="coach"
      open={open}
      onOpenChange={choose}
      className={cn(live && "motion-rise delay-(--duration-micro)")}
    >
      {announce ? (
        <span role="status" className="sr-only">
          Working
        </span>
      ) : null}
      <div data-slot="coach-work-head">
        <OpenCvMark quarterTurns={steps.length} className="size-3.5" />
        {steps.length > 0 ? (
          <CollapsibleTrigger
            data-slot="coach-work-toggle"
            className="-mx-1.5 inline-flex min-h-11 motion-press items-center gap-1.5 rounded-md px-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-7"
          >
            <WorkLabel text={label} live={live} />
            <CollapsibleIndicator className="size-3" />
          </CollapsibleTrigger>
        ) : (
          <WorkLabel text={label} live={live} />
        )}
      </div>
      {steps.length > 0 ? (
        <CollapsibleContent>
          <WorkSteps steps={steps} live={live} />
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  )
}
