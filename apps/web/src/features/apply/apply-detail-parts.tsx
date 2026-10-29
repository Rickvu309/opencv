import { useReducer, type ReactNode } from "react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleX,
  Pencil,
  Plus,
} from "lucide-react"

import type { ActivityFeedRow, JobPriority, JobStage } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { ChecklistItem } from "./apply-api.ts"
import { railStageLabel } from "./apply-detail-labels.ts"
import { monthDay, stageLabel } from "./apply-stages.ts"
import { FAINT_TEXT } from "./apply-tone.ts"

export const TITLE_TEXT = "text-foreground/91"

export const RAIL_ROW =
  "h-8 w-full justify-start gap-[9px] rounded-[6px] px-2 text-[13px] font-normal text-foreground hover:bg-secondary aria-expanded:bg-secondary dark:hover:bg-secondary"

export function PriorityMark({ level }: { level: JobPriority }) {
  const filled = level === "low" ? 1 : level === "high" ? 3 : 2
  return (
    <svg
      data-slot="priority-bars"
      width="14"
      height="10"
      viewBox="0 0 14 10"
      aria-hidden
      className="shrink-0"
    >
      {[4, 7, 10].map((height, index) => (
        <rect
          key={height}
          x={1 + index * 4.5}
          y={10 - height}
          width="2.5"
          height={height}
          rx="1"
          className={index < filled ? "fill-muted-foreground" : "fill-input"}
        />
      ))}
    </svg>
  )
}

export function InitialsAvatar({
  initials,
  size,
  fontSize,
}: {
  initials: string
  size: number
  fontSize: number
}) {
  return (
    <svg
      data-slot="initials-avatar"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 text-muted-foreground"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2}
        className="fill-secondary"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={600}
        className="fill-current"
      >
        {initials}
      </text>
    </svg>
  )
}

export function RailSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  const [open, toggleOpen] = useReducer((value: boolean) => !value, true)
  return (
    <section
      aria-label={title}
      className={cn("flex flex-col gap-0.5", className)}
    >
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        onClick={toggleOpen}
        className={cn(
          "h-7 w-full justify-start gap-1.5 rounded-[6px] px-2 text-xs font-medium hover:bg-secondary aria-expanded:bg-transparent",
          FAINT_TEXT.card,
          "aria-expanded:text-muted-foreground/84"
        )}
      >
        {title}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3 transition-transform duration-(--duration-micro) ease-(--ease-micro)",
            !open && "-rotate-90"
          )}
        />
      </Button>
      {open ? children : null}
    </section>
  )
}

export function ChecklistItemRow({
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
      className="h-[34px] w-full justify-start gap-2.5 rounded-[6px] border-0 border-b border-foreground/6 px-2 text-[13.5px] font-normal hover:bg-secondary"
      onClick={onToggle}
    >
      {item.done ? (
        <Check
          aria-hidden
          strokeWidth={2.5}
          className="size-[15px] rounded-full bg-chart-3 p-[2.5px] text-card"
        />
      ) : (
        <span
          aria-hidden
          className="size-[15px] shrink-0 rounded-full ring-[1.2px] ring-input ring-inset"
        />
      )}
      <span className={item.done ? FAINT_TEXT.card : "text-foreground"}>
        {item.label}
      </span>
    </Button>
  )
}

const MOVED = /^You moved it to (saved|applied|interview|offer|closed)$/

function activityText(row: ActivityFeedRow) {
  const moved = MOVED.exec(row.summary)
  if (!moved) return row.summary
  const stage = moved[1] as JobStage
  return stage === "closed"
    ? railStageLabel(stage)
    : `You moved it to ${stageLabel(stage)}`
}

function ActivityIcon({ row }: { row: ActivityFeedRow }) {
  const className = "size-5 shrink-0 p-[3.5px] text-muted-foreground"
  if (row.command === "job.create")
    return <Plus aria-hidden className={className} />
  if (row.command === "job.move") {
    return row.summary.endsWith("closed") ? (
      <CircleX aria-hidden className={className} />
    ) : (
      <ArrowRight aria-hidden className={className} />
    )
  }
  return <Pencil aria-hidden className={className} />
}

export function ActivityItem({ row }: { row: ActivityFeedRow }) {
  return (
    <li
      data-slot="activity-item"
      className="flex h-7 items-center gap-2.5 px-1 text-[12.5px] text-muted-foreground"
    >
      <ActivityIcon row={row} />
      <span>{activityText(row)}</span>
      <time dateTime={row.createdAt} className={FAINT_TEXT.card}>
        {monthDay(new Date(row.createdAt))}
      </time>
    </li>
  )
}
