import { useReducer, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Calendar } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { cn } from "@workspace/ui/lib/utils"

import type { JobStage, JobView } from "@workspace/domain"

import {
  companyInitials,
  listPhrase,
  monthDay,
  stageLabel,
} from "./apply-stages.ts"
import { prefetchJob } from "./apply-api.ts"
import { FAINT_TEXT } from "./apply-tone.ts"
import { useChosenTimeZone } from "./apply-time-zone.ts"

const WEEKDAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

type RowPhrase = { text: string; soon: boolean }

function rowPhrase(job: JobView, zone: string, now = new Date()): RowPhrase {
  if (job.stage === "interview" && job.interviewAt) {
    const at = new Date(job.interviewAt)
    const wait = at.getTime() - now.getTime()
    if (wait >= 0 && wait < WEEKDAY_WINDOW_MS) {
      return { text: listPhrase(job, now, zone), soon: true }
    }
    return { text: `Interview on ${monthDay(at, zone)}`, soon: false }
  }
  return { text: listPhrase(job, now, zone), soon: false }
}

export function ListGroup({
  stage,
  count,
  children,
}: {
  stage: JobStage
  count: number
  children: ReactNode
}) {
  const name = stageLabel(stage)
  const [flipped, toggleFlipped] = useReducer((value: boolean) => !value, false)
  const open = (count > 0 && stage !== "closed") !== flipped
  return (
    <Collapsible
      open={open}
      onOpenChange={toggleFlipped}
      render={<section />}
      data-slot="list-group"
      aria-label={name}
      className="flex flex-col gap-0.5"
    >
      <h2 className="flex">
        <CollapsibleTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full justify-start gap-2 rounded-sm bg-secondary px-2.5 text-ui font-normal hover:bg-accent aria-expanded:bg-secondary aria-expanded:hover:bg-accent md:h-[34px]"
            />
          }
        >
          <CollapsibleIndicator className="size-3 text-muted-foreground" />
          <StageIcon stage={stage} decorative />
          <span>{name}</span>
          <span className={FAINT_TEXT.secondary}>{count}</span>
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent className="flex flex-col gap-0.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function JobRow({
  job,
  current = false,
  onOpen,
}: {
  job: JobView
  current?: boolean
  onOpen: () => void
}) {
  const zone = useChosenTimeZone()
  const queryClient = useQueryClient()
  const phrase = rowPhrase(job, zone)
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="job-row"
      className={cn(
        "h-11 w-full justify-start gap-2.5 rounded-sm px-3 text-ui font-normal md:h-10",
        current && "bg-accent hover:bg-accent"
      )}
      aria-label={`${job.title}, ${job.company}`}
      aria-current={current ? "true" : undefined}
      onPointerDown={() => prefetchJob(queryClient, job.id)}
      onFocus={() => prefetchJob(queryClient, job.id)}
      onClick={onOpen}
    >
      <span
        data-slot="company-tile"
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-foreground/8 bg-card text-[8px] font-semibold text-muted-foreground"
      >
        {companyInitials(job.company)}
      </span>
      <span className="min-w-0 truncate font-medium">{job.title}</span>
      <span className={cn("min-w-0 truncate", FAINT_TEXT.card)}>
        {job.company}
      </span>
      <span className="flex-1" />
      <span className="flex shrink-0 items-center gap-1.5 text-xs">
        {phrase.soon ? (
          <Calendar className="size-3 text-chart-3" aria-hidden />
        ) : null}
        <span className={phrase.soon ? "text-foreground" : FAINT_TEXT.card}>
          {phrase.text}
        </span>
      </span>
      <time
        dateTime={job.createdAt}
        className={cn(
          "hidden w-[52px] shrink-0 text-right text-xs md:block",
          FAINT_TEXT.card
        )}
      >
        {monthDay(new Date(job.createdAt), zone)}
      </time>
    </Button>
  )
}
