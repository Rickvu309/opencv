import { Calendar, MapPin, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { cn } from "@workspace/ui/lib/utils"

import type { JobPriority, JobStage, JobView } from "@workspace/domain"

import {
  companyInitials,
  listPhrase,
  monthDay,
  priorityLabel,
} from "./apply-stages.ts"
import { FAINT_TEXT } from "./apply-tone.ts"
import { useChosenTimeZone } from "./apply-time-zone.ts"

const WEEKDAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function interviewTag(job: JobView, now: Date, zone: string): string | null {
  if (job.stage !== "interview" || !job.interviewAt) return null
  const wait = new Date(job.interviewAt).getTime() - now.getTime()
  if (wait < 0 || wait >= WEEKDAY_WINDOW_MS) return null
  return listPhrase(job, now, zone)
}

const bars = [
  { x: 0, height: 4 },
  { x: 4.5, height: 7 },
  { x: 9, height: 10 },
]

export function PriorityBox({ level }: { level: JobPriority }) {
  const filled = level === "low" ? 1 : level === "high" ? 3 : 2
  return (
    <svg
      data-slot="priority-bars"
      viewBox="0 0 12 10"
      role="img"
      aria-label={priorityLabel(level)}
      className="size-[22px] shrink-0 rounded-[6px] border border-border px-1 py-[5px]"
    >
      {bars.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={10 - bar.height}
          width="2.5"
          height={bar.height}
          rx="1"
          className={index < filled ? "fill-muted-foreground" : "fill-input"}
        />
      ))}
    </svg>
  )
}

export function JobCard({ job }: { job: JobView }) {
  const zone = useChosenTimeZone()
  const interview = interviewTag(job, new Date(), zone)
  return (
    <div data-slot="job-card" className="flex flex-col text-left">
      <span className="flex h-[18px] items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs tracking-[-0.1px] text-muted-foreground">
          {job.company}
        </span>
        <span
          data-slot="company-tile"
          aria-hidden
          className="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-foreground/8 bg-background text-[7px] font-semibold text-muted-foreground"
        >
          {companyInitials(job.company)}
        </span>
      </span>
      <span className="mt-1 flex items-start gap-2">
        <StageIcon stage={job.stage} className="mt-[2.5px]" />
        <span className="line-clamp-2 min-w-0 text-[13.5px] leading-[1.4] font-medium">
          {job.title}
        </span>
      </span>
      <span className="mt-2.5 flex flex-wrap items-center gap-1">
        <PriorityBox level={job.priority} />
        {interview ? (
          <span className="inline-flex h-[22px] items-center gap-1 rounded-[6px] border border-border px-[7px] text-[11.5px] font-medium">
            <Calendar className="size-[11px] text-chart-3" aria-hidden />
            {interview}
          </span>
        ) : null}
        {job.location ? (
          <span className="inline-flex h-[22px] min-w-0 items-center gap-1 rounded-[6px] border border-border px-[7px] text-[11.5px] text-muted-foreground">
            <MapPin className="size-[11px] shrink-0 text-chart-1" aria-hidden />
            <span className="truncate">{job.location}</span>
          </span>
        ) : null}
      </span>
      <span className="mt-2.5 text-xs text-muted-foreground">
        Created{" "}
        <time dateTime={job.createdAt}>
          {monthDay(new Date(job.createdAt), zone)}
        </time>
      </span>
    </div>
  )
}

export function BoardLane({
  name,
  stage,
  count,
  onAdd,
}: {
  name: string
  stage: JobStage
  count: number
  onAdd: () => void
}) {
  return (
    <div
      data-slot="board-lane"
      data-stage={stage}
      className="flex h-11 items-center gap-2 px-1 md:h-8"
    >
      <StageIcon stage={stage} />
      <h2 className="text-[13px] font-normal" tabIndex={0}>
        {name}
      </h2>
      <span className={cn("flex-1 text-xs font-normal", FAINT_TEXT.background)}>
        {count}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`New job in ${name}`}
        className="size-11 text-muted-foreground md:size-6"
        onClick={onAdd}
      >
        <Plus />
      </Button>
    </div>
  )
}
