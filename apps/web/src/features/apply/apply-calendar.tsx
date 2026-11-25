import { useMemo, useReducer } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { SegmentedControl } from "@workspace/ui/components/segmented-control"

import { parseJobId, type JobId, type JobView } from "@workspace/domain"

import { catalogClient } from "@/lib/contract-client.ts"
import { useOwnerId } from "@/lib/owner-id.ts"
import {
  addDays,
  addMonths,
  calendarEvents,
  eventsInDays,
  monthTitle,
  monthWeeks,
  rangeFor,
  weekDays,
  weekTitle,
} from "./apply-calendar-model.ts"
import { MonthGrid } from "./apply-calendar-month.tsx"
import { WeekGrid } from "./apply-calendar-week.tsx"
import { zonedYmd } from "./apply-stages.ts"
import { useChosenTimeZone } from "./apply-time-zone.ts"

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

type AnchorState = { day: string; zone: string }

type AnchorAction =
  | { type: "stepped"; next: string }
  | { type: "today_chosen"; today: string }
  | {
      type: "zone_seen"
      zone: string
      today: string
      previousToday: string
    }

function anchorReducer(state: AnchorState, action: AnchorAction): AnchorState {
  if (action.type === "stepped") return { ...state, day: action.next }
  if (action.type === "today_chosen") return { ...state, day: action.today }
  if (state.zone === action.zone) return state
  return {
    zone: action.zone,
    day: state.day === action.previousToday ? action.today : state.day,
  }
}

export function ApplyCalendar({
  span,
  onSpan,
  company,
  location,
  showClosed,
  onOpenJob,
}: {
  span: "month" | "week"
  onSpan: (span: "month" | "week") => void
  company: string
  location: string
  showClosed: boolean
  onOpenJob: (jobId: JobId) => void
}) {
  const zone = useChosenTimeZone()
  const today = zonedYmd(new Date(), zone)
  const [anchorState, dispatchAnchor] = useReducer(anchorReducer, {
    day: today,
    zone,
  })
  if (anchorState.zone !== zone) {
    dispatchAnchor({
      type: "zone_seen",
      zone,
      today,
      previousToday: zonedYmd(new Date(), anchorState.zone),
    })
  }
  const anchor = anchorState.day
  const weeks = useMemo(() => monthWeeks(anchor), [anchor])
  const days = useMemo(
    () => (span === "week" ? weekDays(anchor) : weeks.flat()),
    [span, anchor, weeks]
  )
  const range = useMemo(() => rangeFor(days, zone), [days, zone])
  const query = catalogClient.useRead(useOwnerId(), "job.calendar", {
    from: range.from,
    to: range.to,
  })
  const events = useMemo(
    () =>
      eventsInDays(
        calendarEvents(
          (query.data ?? []).filter(
            (job) =>
              matches(job, company, location) &&
              (showClosed || job.stage !== "closed")
          ),
          zone
        ),
        days
      ),
    [query.data, company, location, showClosed, days, zone]
  )
  const openJob = (jobId: string) => {
    onOpenJob(parseJobId(jobId))
  }
  const unit = span === "week" ? "week" : "month"
  const step = (direction: 1 | -1) =>
    dispatchAnchor({
      type: "stepped",
      next:
        span === "week"
          ? addDays(anchor, direction * 7)
          : addMonths(anchor, direction),
    })

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
            className="size-11 rounded-md md:size-7"
            aria-label={`Previous ${unit}`}
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-[13px]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-11 rounded-md md:size-7"
            aria-label={`Next ${unit}`}
            onClick={() => step(1)}
          >
            <ChevronRight className="size-[13px]" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-md bg-card px-2.5 text-xs md:h-7"
            onClick={() => dispatchAnchor({ type: "today_chosen", today })}
          >
            Today
          </Button>
        </div>
        <SegmentedControl
          aria-label="Calendar span"
          size="sm"
          value={span}
          onChange={onSpan}
          className="[--ui-segc-card-shadow:0_1px_2px_rgb(0_0_0/0.1)]! [--ui-segc-pad:3px]! [--ui-segc-text:color-mix(in_srgb,var(--muted-foreground)_88%,transparent)]! [--ui-segc-track:var(--secondary)]!"
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
          <p>Couldn't load jobs.</p>
          <Button
            size="touch"
            type="button"
            onClick={() => void query.refetch()}
          >
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
          onOpenJob={openJob}
        />
      ) : (
        <WeekGrid
          days={days}
          today={today}
          events={events}
          onOpenJob={openJob}
        />
      )}
    </div>
  )
}
