import { useReducer, type ReactNode } from "react"
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
import { FAINT_TEXT } from "./apply-tone.ts"

const WEEKDAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

type RowPhrase = { text: string; soon: boolean }

function rowPhrase(job: JobView, now = new Date()): RowPhrase {
  if (job.stage === "interview" && job.interviewAt) {
    const at = new Date(job.interviewAt)
    const wait = at.getTime() - now.getTime()
    if (wait >= 0 && wait < WEEKDAY_WINDOW_MS) {
      return { text: listPhrase(job, now), soon: true }
    }
    return { text: `Interview on ${monthDay(at)}`, soon: false }
  }
  return { text: listPhrase(job, now), soon: false }
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
              className="h-[34px] w-full justify-start gap-2 rounded-[6px] bg-secondary px-2.5 text-[13px] font-normal hover:bg-accent aria-expanded:bg-secondary aria-expanded:hover:bg-accent"
            />
          }
        >
          <CollapsibleIndicator className="size-3 text-muted-foreground" />
          <span aria-hidden className="flex">
            <StageIcon stage={stage} />
          </span>
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

export function JobRow({ job, onOpen }: { job: JobView; onOpen: () => void }) {
  const phrase = rowPhrase(job)
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="job-row"
      className="h-10 w-full justify-start gap-2.5 rounded-[6px] px-3 text-[13px] font-normal"
      aria-label={`${job.title}, ${job.company}`}
      onClick={onOpen}
    >
      <span
        data-slot="company-tile"
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-foreground/8 bg-card text-[8px] font-semibold text-muted-foreground"
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
        {monthDay(new Date(job.createdAt))}
      </time>
    </Button>
  )
}
