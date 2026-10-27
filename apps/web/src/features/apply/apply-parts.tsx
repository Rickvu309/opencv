import type { ReactNode } from "react"
import { MapPin } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { StageIcon } from "@workspace/ui/components/stage-icon"

import type { JobPriority, JobView } from "@workspace/domain"

import type { ActivityFeedRow } from "@workspace/domain"

import type { ChecklistItem } from "./apply-api.ts"
import { companyInitials, priorityLabel } from "./apply-stages.ts"

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

export function JobCard({ job, phrase }: { job: JobView; phrase?: string }) {
  return (
    <div data-slot="job-card" className="flex flex-col gap-2 text-left">
      <span className="flex items-start gap-2.5">
        <CompanyTile company={job.company} />
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-sm font-medium">{job.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {job.company}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-1.5 pl-9">
        <PriorityBars level={job.priority} />
        {job.location ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden />
            {job.location}
          </span>
        ) : null}
        {phrase ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {phrase}
          </span>
        ) : null}
      </span>
    </div>
  )
}

export function JobRow({
  job,
  phrase,
  onOpen,
}: {
  job: JobView
  phrase: string
  onOpen: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="job-row"
      className="h-10 w-full justify-start gap-2.5 px-4"
      aria-label={`${job.title}, ${job.company}`}
      onClick={onOpen}
    >
      <StageIcon stage={job.stage} />
      <CompanyTile company={job.company} />
      <span className="min-w-24 flex-1 truncate text-left text-sm">
        {job.title}
      </span>
      <span className="max-w-28 min-w-14 truncate text-xs text-muted-foreground md:max-w-none md:shrink-0">
        {job.company}
      </span>
      <span className="max-w-24 min-w-0 shrink truncate text-xs text-muted-foreground sm:max-w-none sm:shrink-0">
        {phrase}
      </span>
    </Button>
  )
}

export function BoardLane({
  name,
  stage,
  children,
}: {
  name: string
  stage: string
  children: ReactNode
}) {
  return (
    <div
      data-slot="board-lane"
      data-stage={stage}
      className="flex min-h-0 flex-1 flex-col"
    >
      <h2 className="px-2 pt-2 text-sm font-semibold" tabIndex={0}>
        {name}
      </h2>
      {children}
    </div>
  )
}

export function ListGroup({
  name,
  children,
}: {
  name: string
  children: ReactNode
}) {
  return (
    <section data-slot="list-group" aria-label={name} className="flex flex-col">
      <h2 className="px-4 py-2 text-sm font-medium">{name}</h2>
      {children}
    </section>
  )
}

export function Property({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div data-slot="property" className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function ChecklistItem({
  item,
  onToggle,
}: {
  item: ChecklistItem
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="checklist-item"
      role="checkbox"
      aria-checked={item.done}
      aria-label={item.label}
      className="h-8 w-full justify-start px-2"
      onClick={onToggle}
    >
      <span
        aria-hidden
        className={
          item.done
            ? "size-3.5 rounded-sm bg-foreground"
            : "size-3.5 rounded-sm ring-1 ring-border"
        }
      />
      <span className={item.done ? "text-muted-foreground line-through" : ""}>
        {item.label}
      </span>
    </Button>
  )
}

export function ActivityItem({ row }: { row: ActivityFeedRow }) {
  return (
    <li data-slot="activity-item" className="text-sm">
      {row.summary}
    </li>
  )
}
