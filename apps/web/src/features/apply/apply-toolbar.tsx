import type { ReactNode } from "react"
import {
  Calendar,
  Funnel,
  Kanban,
  List,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react"

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
import { cn } from "@workspace/ui/lib/utils"

import {
  activeFilterCount,
  type ApplyFilters,
  type ApplyView,
} from "./apply-search.ts"
import { FAINT_TEXT } from "./apply-tone.ts"
import "./design/page-header.pen.css"

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

const VIEWS: { view: ApplyView; label: string; icon: LucideIcon }[] = [
  { view: "board", label: "Board", icon: Kanban },
  { view: "list", label: "List", icon: List },
  { view: "calendar", label: "Calendar", icon: Calendar },
]

export function ApplyToolbar({
  view,
  onView,
  filters,
  onFilters,
  children,
}: {
  view: ApplyView
  onView: (view: ApplyView) => void
  filters: ApplyFilters
  onFilters: (filters: ApplyFilters) => void
  children?: ReactNode
}) {
  const count = activeFilterCount(filters)
  return (
    <div
      data-slot="apply-toolbar"
      className="flex min-h-11 shrink-0 flex-wrap items-center gap-1.5 px-3 md:h-11 md:flex-nowrap"
    >
      {VIEWS.map(({ view: id, label, icon: Icon }) => {
        const active = view === id
        return (
          <Button
            key={id}
            type="button"
            variant="ghost"
            aria-pressed={active}
            className={cn(
              "h-11 gap-1.5 rounded-full border px-2.5 text-xs md:h-7",
              active
                ? "border-transparent bg-accent font-medium text-foreground hover:bg-accent"
                : "border-border font-normal text-muted-foreground"
            )}
            onClick={() => onView(id)}
          >
            <Icon
              className={cn(
                "size-[13px]",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            />
            {label}
          </Button>
        )
      })}
      {children}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label="Filter"
              className={cn(
                "mr-[34px] ml-auto h-11 min-w-11 rounded-full border border-border text-xs text-muted-foreground md:h-7 md:min-w-0",
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
        className="size-11 shrink-0 rounded-[5px] p-0 text-muted-foreground hover:text-foreground md:size-[18px]"
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
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-1.5 bg-card px-3 py-1.5"
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
