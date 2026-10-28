import { Calendar, MapPin } from "lucide-react"

import { StageIcon } from "@workspace/ui/components/stage-icon"

import type { JobPriority, JobStage, JobView } from "@workspace/domain"

import {
  companyInitials,
  listPhrase,
  monthDay,
  priorityLabel,
} from "./apply-stages.ts"

export function PriorityBars({ level }: { level: JobPriority }) {
  const filled = level === "low" ? 1 : level === "high" ? 3 : 2
  const label = priorityLabel(level)
  return (
    <svg
      data-slot="priority-bars"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      role="img"
      aria-label={label}
    >
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={1 + index * 4}
          y={8 - index * 3}
          width="2.4"
          height={3 + index * 3}
          rx="0.8"
          className={index < filled ? "fill-foreground" : "fill-border"}
        />
      ))}
    </svg>
  )
}

export function CompanyTile({ company }: { company: string }) {
  return (
    <span
      data-slot="company-tile"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-foreground ring-1 ring-border"
      aria-hidden
    >
      {companyInitials(company)}
    </span>
  )
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** A weekday alone is only unambiguous within the next seven days. */
function interviewTag(job: JobView, now: Date): string | null {
  if (job.stage !== "interview" || !job.interviewAt) return null
  const wait = new Date(job.interviewAt).getTime() - now.getTime()
  if (wait < 0 || wait >= WEEK_MS) return null
  return listPhrase(job)
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
  const interview = interviewTag(job, new Date())
  return (
    <div data-slot="job-card" className="flex flex-col text-left">
      <span className="flex items-center gap-2.5">
        <span
          data-slot="company-tile"
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-[7px] border border-foreground/8 bg-card text-[7.5px] font-semibold text-muted-foreground"
        >
          {companyInitials(job.company)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="line-clamp-2 text-[13.5px] leading-[1.35] font-medium">
            {job.title}
          </span>
          <span className="truncate text-xs leading-[1.35] tracking-[-0.1px] text-muted-foreground">
            {job.company}
          </span>
        </span>
      </span>
      {interview ? (
        <span className="mt-2.5 flex pl-[38px]">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-[6px] bg-secondary px-2 text-xs font-medium">
            <Calendar className="size-3 text-chart-3" aria-hidden />
            {interview}
          </span>
        </span>
      ) : null}
      <span className="mt-2.5 flex items-center gap-1 pl-[38px]">
        <PriorityBox level={job.priority} />
        {job.location ? (
          <span className="inline-flex h-[22px] min-w-0 items-center gap-1 rounded-[6px] border border-border px-[7px] text-[11.5px] text-muted-foreground">
            <MapPin className="size-[11px] shrink-0 text-chart-1" aria-hidden />
            <span className="truncate">{job.location}</span>
          </span>
        ) : null}
        <time
          dateTime={job.createdAt}
          className="ml-auto shrink-0 text-[11.5px] text-muted-foreground"
        >
          {monthDay(new Date(job.createdAt))}
        </time>
      </span>
    </div>
  )
}

export function BoardLane({
  name,
  stage,
  count,
}: {
  name: string
  stage: JobStage
  count: number
}) {
  return (
    <div
      data-slot="board-lane"
      data-stage={stage}
      className="flex h-8 items-center gap-2 px-1"
    >
      <StageIcon stage={stage} />
      <h2 className="text-[13px] font-normal" tabIndex={0}>
        {name}
      </h2>
      <span className="flex-1 text-xs font-normal text-muted-foreground">
        {count}
      </span>
    </div>
  )
}
