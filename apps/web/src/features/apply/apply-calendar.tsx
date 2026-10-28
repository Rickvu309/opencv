import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { SegmentedControl } from "@workspace/ui/components/segmented-control"

import type { JobView } from "@workspace/domain"

import { calendarJobs, jobCalendarKey } from "./apply-api.ts"
import {
  addDays,
  addMonths,
  calendarEvents,
  monthTitle,
  monthWeeks,
  rangeFor,
  weekDays,
  weekTitle,
} from "./apply-calendar-model.ts"
import { MonthGrid } from "./apply-calendar-month.tsx"
import { WeekGrid } from "./apply-calendar-week.tsx"
import { zonedYmd } from "./apply-stages.ts"

function matches(job: JobView, company: string, location: string) {
  const companyNeedle = company.trim().toLowerCase()
  const locationNeedle = location.trim().toLowerCase()
  if (companyNeedle && !job.company.toLowerCase().includes(companyNeedle)) {
    return false
  }
  if (
    locationNeedle &&
    !(job.location ?? "").toLowerCase().includes(locationNeedle)
  ) {
    return false
  }
  return true
}

export function ApplyCalendar({
  span,
  onSpan,
  company,
  location,
  showClosed,
}: {
  span: "month" | "week"
  onSpan: (span: "month" | "week") => void
  company: string
  location: string
  showClosed: boolean
}) {
  const [anchor, setAnchor] = useState(() => zonedYmd(new Date()))
  const today = zonedYmd(new Date())
  const weeks = useMemo(() => monthWeeks(anchor), [anchor])
  const days = useMemo(
    () => (span === "week" ? weekDays(anchor) : weeks.flat()),
    [span, anchor, weeks]
  )
  const range = useMemo(() => rangeFor(days), [days])
  const query = useQuery({
    queryKey: jobCalendarKey(range.from, range.to),
    queryFn: () => calendarJobs(range.from, range.to),
  })
  const events = useMemo(
    () =>
      calendarEvents(
        (query.data ?? []).filter(
          (job) =>
            matches(job, company, location) &&
            (showClosed || job.stage !== "closed")
        )
      ),
    [query.data, company, location, showClosed]
  )
  const unit = span === "week" ? "week" : "month"
  const step = (direction: 1 | -1) =>
    setAnchor(
      span === "week"
        ? addDays(anchor, direction * 7)
        : addMonths(anchor, direction)
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <h2 className="text-lg font-semibold tracking-[-0.5px]">
            {span === "week" ? weekTitle(days) : monthTitle(anchor)}
          </h2>
          <span aria-hidden="true" className="w-2" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-md"
            aria-label={`Previous ${unit}`}
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-[13px]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-md"
            aria-label={`Next ${unit}`}
            onClick={() => step(1)}
          >
            <ChevronRight className="size-[13px]" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-7 rounded-md bg-card px-2.5 text-[12.5px]"
            onClick={() => setAnchor(today)}
          >
            Today
          </Button>
        </div>
        <SegmentedControl
          aria-label="Calendar span"
          size="sm"
          value={span}
          onChange={onSpan}
          className="[--ui-segc-card-shadow:0_1px_2px_rgb(0_0_0/0.1)]! [--ui-segc-pad:3px]! [--ui-segc-text:var(--muted-foreground)]! [--ui-segc-track:var(--secondary)]!"
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </div>
      {query.isLoading ? (
        <p role="status" className="px-6">
          Loading jobs
        </p>
      ) : null}
      {query.isError ? (
        <div className="px-6">
          <p>Could not load jobs. Refresh the page.</p>
          <Button type="button" onClick={() => void query.refetch()}>
            Refresh
          </Button>
        </div>
      ) : null}
      {span === "month" ? (
        <MonthGrid
          weeks={weeks}
          month={anchor.slice(0, 7)}
          today={today}
          events={events}
        />
      ) : (
        <WeekGrid days={days} today={today} events={events} />
      )}
    </div>
  )
}
