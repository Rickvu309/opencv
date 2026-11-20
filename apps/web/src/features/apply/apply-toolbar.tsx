import { useId, type ReactNode } from "react"
import { Calendar, Funnel, Kanban, List, Plus, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderPrimary,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"
import {
  SegmentedControl,
  type SegmentOption,
} from "@workspace/ui/components/segmented-control"
import { cn } from "@workspace/ui/lib/utils"

import {
  activeFilterCount,
  type ApplyFilters,
  type ApplyView,
} from "./apply-search.ts"
import { FAINT_TEXT } from "./apply-tone.ts"
import "./design/page-header.css"

export function ApplyHeader({ onNewJob }: { onNewJob: () => void }) {
  return (
    <PageHeader>
      <PageHeaderTitle>Apply</PageHeaderTitle>
      <PageHeaderActions>
        <PageHeaderPrimary
          icon={<Plus />}
          data-primary-action
          onClick={onNewJob}
        >
          New job
        </PageHeaderPrimary>
      </PageHeaderActions>
    </PageHeader>
  )
}

const PRIORITY_COUNT_ORDER = ["high", "normal", "low"] as const

const PRIORITY_COUNT_LABEL = {
  high: "High",
  normal: "Normal",
  low: "Low",
} as const

function priorityCountRows(
  rows: readonly { priority: string; count: number }[]
) {
  return PRIORITY_COUNT_ORDER.map((priority) => ({
    priority,
    label: PRIORITY_COUNT_LABEL[priority],
    count: rows.find((row) => row.priority === priority)?.count ?? 0,
  }))
}

const VIEWS: SegmentOption<ApplyView>[] = [
  { value: "board", label: "Board", icon: <Kanban aria-hidden /> },
  { value: "list", label: "List", icon: <List aria-hidden /> },
  { value: "calendar", label: "Calendar", icon: <Calendar aria-hidden /> },
]

export function ApplyToolbar({
  view,
  onView,
  filters,
  onFilters,
  priorityCounts,
  priorityCountsFailed = false,
  showFilter = true,
  nextUp,
}: {
  view: ApplyView
  onView: (view: ApplyView) => void
  filters: ApplyFilters
  onFilters: (filters: ApplyFilters) => void
  priorityCounts?: readonly { priority: string; count: number }[]
  priorityCountsFailed?: boolean
  showFilter?: boolean
  nextUp?: ReactNode
}) {
  const count = activeFilterCount(filters)
  const priorityHeadingId = useId()
  return (
    <div
      data-slot="apply-toolbar"
      className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 py-1.5 pr-4 pl-5 md:h-11 md:flex-nowrap md:py-0"
    >
      <SegmentedControl
        aria-label="View"
        variant="buttons"
        size="sm"
        options={VIEWS}
        value={view}
        onChange={onView}
      />
      {nextUp}
      {showFilter ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                aria-label="Filter"
                className={cn(
                  "ml-auto h-11 min-w-11 rounded-full border border-border text-xs text-muted-foreground md:h-7 md:min-w-0",
                  count > 0
                    ? "gap-[5px] bg-accent px-2.5 hover:bg-accent"
                    : "w-11 bg-card md:w-7"
                )}
              />
            }
          >
            <Funnel className="size-3.5" />
            {count > 0 ? (
              <span className="font-semibold text-foreground">{count}</span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="flex flex-col gap-2">
            {priorityCounts || priorityCountsFailed ? (
              <div className="flex flex-col gap-1.5 border-b border-border pb-2">
                <p
                  id={priorityHeadingId}
                  className="text-sm font-medium text-foreground"
                >
                  Jobs by priority
                </p>
                <div
                  role="group"
                  aria-labelledby={priorityHeadingId}
                  className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground"
                >
                  {priorityCounts
                    ? priorityCountRows(priorityCounts).map(
                        ({ priority, label, count: priorityCount }) => (
                          <span key={priority}>
                            {label}{" "}
                            <span className="tabular-nums">
                              {priorityCount}
                            </span>
                          </span>
                        )
                      )
                    : null}
                  {priorityCountsFailed ? (
                    <span>Couldn't load priority counts.</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-company">Company</Label>
              <Input
                id="filter-company"
                value={filters.company}
                onChange={(event) =>
                  onFilters({ ...filters, company: event.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-location">Location</Label>
              <Input
                id="filter-location"
                value={filters.location}
                onChange={(event) =>
                  onFilters({ ...filters, location: event.target.value })
                }
              />
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}

function FilterChip({
  name,
  value,
  onRemove,
}: {
  name: string
  value: string
  onRemove: () => void
}) {
  return (
    <span
      data-slot="filter-chip"
      className="inline-flex min-h-7 max-w-full min-w-0 flex-wrap items-center gap-1 rounded-full border border-border bg-card py-1 ps-2.5 pe-1 text-xs"
    >
      <span className={FAINT_TEXT.card}>{name}</span>
      <span className="min-w-0 font-medium break-words text-foreground">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Remove ${name.toLowerCase()} filter`}
        className="size-11 shrink-0 rounded-sm p-0 text-muted-foreground hover:text-foreground md:size-[18px]"
        onClick={onRemove}
      >
        <X className="size-[18px] p-[3px]" />
      </Button>
    </span>
  )
}

export function ActiveFilters({
  filters,
  onFilters,
}: {
  filters: ApplyFilters
  onFilters: (filters: ApplyFilters) => void
}) {
  const company = filters.company.trim()
  const location = filters.location.trim()
  if (!company && !location) return null
  return (
    <div
      data-slot="active-filters"
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-1.5 bg-background px-3 py-1.5"
    >
      {company ? (
        <FilterChip
          name="Company"
          value={company}
          onRemove={() => onFilters({ ...filters, company: "" })}
        />
      ) : null}
      {location ? (
        <FilterChip
          name="Location"
          value={location}
          onRemove={() => onFilters({ ...filters, location: "" })}
        />
      ) : null}
    </div>
  )
}
