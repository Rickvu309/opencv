import type { ReactNode } from "react"
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  MapPin,
  Plus,
  Check,
  Building2,
} from "lucide-react"
import { cn } from "./cn"
import { StageIcon, STAGE_LABEL, type Stage } from "./brand"

export type Priority = "none" | "low" | "medium" | "high"

export interface Job {
  id: string
  role: string
  company: string
  stage: Stage
  /** Lucide icon for the company tile. Company tiles stay dark, never colored. */
  logo?: ReactNode
  priority?: Priority
  location?: string
  date?: string
  interview?: string
}

/** Signal bars. Low 1, medium 2, high 3. */
export function PriorityBars({ level = "medium" }: { level?: Priority }) {
  const n = { none: 0, low: 1, medium: 2, high: 3 }[level]
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      role="img"
      aria-label={`${level} priority`}
    >
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1 + i * 4}
          y={8 - i * 3}
          width="2.4"
          height={3 + i * 3}
          rx="0.8"
          fill={i < n ? "var(--color-fg-2)" : "var(--color-border-strong)"}
        />
      ))}
    </svg>
  )
}

export function CompanyTile({
  icon,
  size = 28,
}: {
  icon?: ReactNode
  size?: 20 | 28
}) {
  return (
    <span
      className={cn(
        "bg-surface text-fg inline-flex shrink-0 items-center justify-center ring-[0.5px] ring-border",
        size === 28
          ? "rounded-row size-7 [&_svg]:size-3.5"
          : "size-5 rounded-[5px] [&_svg]:size-[11px]"
      )}
    >
      {icon ?? <Building2 />}
    </span>
  )
}

function PropChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-row text-small text-fg-2 inline-flex h-[22px] items-center gap-1 px-1.5 ring-[0.5px] ring-border ring-inset [&_svg]:size-3">
      {children}
    </span>
  )
}

/** Board card. Job title first, company second. No tags; the stage lives in the lane. */
export function JobCard({
  job,
  selected,
  onClick,
  className,
}: {
  job: Job
  selected?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-tile bg-surface hover:ring-border-strong flex w-full flex-col gap-2 p-3 text-left ring-[0.5px] ring-border transition-shadow hover:ring-1",
        selected && "ring-focus hover:ring-focus ring-[1.5px]",
        className
      )}
    >
      <span className="flex items-start gap-2.5">
        <CompanyTile icon={job.logo} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{job.role}</span>
          <span className="text-small text-fg-2 truncate">{job.company}</span>
        </span>
      </span>
      {job.interview && (
        <span className="rounded-row bg-subtle text-small ml-[38px] inline-flex h-[22px] w-fit items-center gap-1.5 px-2 font-medium">
          <Calendar className="text-indigo size-3" aria-hidden />
          {job.interview}
        </span>
      )}
      <span className="flex items-center gap-1.5 pl-[38px]">
        <PropChip>
          <PriorityBars level={job.priority} />
        </PropChip>
        {job.location && (
          <PropChip>
            <MapPin className="text-info" aria-hidden />
            {job.location}
          </PropChip>
        )}
        <span className="flex-1" />
        {job.date && <span className="text-small text-fg-3">{job.date}</span>}
      </span>
    </button>
  )
}

/** List view row: stage, company tile, job title, company, interview, date. */
export function JobRow({
  job,
  selected,
  onClick,
}: {
  job: Job
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-row hover:bg-subtle flex h-10 w-full items-center gap-2.5 px-4 text-left",
        selected && "bg-active hover:bg-active"
      )}
    >
      <StageIcon stage={job.stage} />
      <CompanyTile icon={job.logo} size={20} />
      <span className="font-medium">{job.role}</span>
      <span className="text-fg-3 flex-1 truncate">{job.company}</span>
      {job.interview && (
        <span className="bg-subtle text-small inline-flex h-[22px] items-center gap-1.5 rounded-[5px] px-[7px] font-medium">
          <Calendar className="text-indigo size-3" aria-hidden />
          {job.interview}
        </span>
      )}
      {job.date && (
        <span className="text-small text-fg-3 w-14 text-right">{job.date}</span>
      )}
    </button>
  )
}

/** Groups list rows by stage. Collapsed groups keep their count. */
export function ListGroup({
  stage,
  count,
  open,
  onToggle,
  onAdd,
  children,
}: {
  stage: Stage
  count: number
  open: boolean
  onToggle: () => void
  onAdd?: () => void
  children?: ReactNode
}) {
  return (
    <section>
      <div className="rounded-row bg-subtle flex h-9 items-center gap-2 px-3">
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="text-fg-3 size-3.5" />
          ) : (
            <ChevronRight className="text-fg-3 size-3.5" />
          )}
          <StageIcon stage={stage} />
          <span className="font-medium">{STAGE_LABEL[stage]}</span>
          <span className="text-fg-3">{count}</span>
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            aria-label={`Add to ${STAGE_LABEL[stage]}`}
            className="text-fg-3 hover:text-fg"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>
      {open && <div className="flex flex-col py-1">{children}</div>}
    </section>
  )
}

/** A stage column. The lane stays light, the cards carry the content. */
export function BoardLane({
  stage,
  count,
  onAdd,
  dropTarget,
  children,
}: {
  stage: Stage
  count: number
  onAdd?: () => void
  dropTarget?: boolean
  children?: ReactNode
}) {
  return (
    <section
      className={cn(
        "rounded-row flex w-[244px] shrink-0 flex-col gap-2 p-2",
        dropTarget ? "ring-focus bg-[#EEF1FB] ring-[1.5px]" : "bg-[#FAFAFA]"
      )}
      aria-label={STAGE_LABEL[stage]}
    >
      <div className="flex h-7 items-center gap-2 px-1">
        <StageIcon stage={stage} />
        <span className="font-medium">{STAGE_LABEL[stage]}</span>
        <span className="text-fg-3 flex-1">{count}</span>
        {onAdd && (
          <button
            onClick={onAdd}
            aria-label={`Add to ${STAGE_LABEL[stage]}`}
            className="text-fg-3 hover:text-fg"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>
      {count === 0 && !children ? (
        <div className="rounded-tile text-small text-fg-3 flex h-[72px] items-center justify-center ring-1 ring-border ring-inset">
          Drop a job here
        </div>
      ) : (
        children
      )}
    </section>
  )
}

/** Rows in the detail rail. Empty properties read as an action. */
export function Property({
  icon,
  children,
  empty,
  onClick,
}: {
  icon: ReactNode
  children: ReactNode
  empty?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-row hover:bg-subtle flex h-8 w-full items-center gap-[9px] px-2 text-left [&>svg]:size-3.5",
        empty ? "text-fg-3" : "text-fg"
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  )
}

export function RailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-px">
      <div className="text-small text-fg-3 flex h-7 items-center gap-1 px-2">
        {title}
        <ChevronDown className="size-3" aria-hidden />
      </div>
      {children}
    </div>
  )
}

/** Interview prep and next steps. */
export function ChecklistItem({
  done,
  onToggle,
  children,
}: {
  done: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <label className="group rounded-row hover:bg-subtle flex h-8 cursor-pointer items-center gap-2.5 px-2">
      <button
        role="checkbox"
        aria-checked={done}
        onClick={onToggle}
        className={cn(
          "inline-flex size-[15px] shrink-0 items-center justify-center rounded-full",
          done ? "bg-stage-offer" : "ring-border-strong ring-[1.2px] ring-inset"
        )}
      >
        {done && <Check className="size-2.5 text-white" strokeWidth={3} />}
      </button>
      <span className={cn(done && "text-fg-3 line-through")}>{children}</span>
    </label>
  )
}

export function ActivityItem({
  icon,
  children,
  when,
}: {
  icon: ReactNode
  children: ReactNode
  when: string
}) {
  return (
    <div className="flex min-h-7 items-center gap-2.5">
      <span className="bg-subtle text-fg-3 inline-flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-[11px]">
        {icon}
      </span>
      <span className="text-fg-2">{children}</span>
      <span className="text-fg-3">{when}</span>
    </div>
  )
}
