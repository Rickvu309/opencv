import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { JobView } from "@workspace/domain"

import { calendarJobs, jobCalendarKey } from "./apply-api.ts"
import { PROFILE_ZONE, deadlineInstant, zonedYmd } from "./apply-stages.ts"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const

function addDays(ymd: string, days: number) {
  const date = deadlineInstant(ymd)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekdayIndex(ymd: string) {
  const day = deadlineInstant(ymd).getUTCDay()
  return day === 0 ? 6 : day - 1
}

function monthDays(cursor: Date) {
  const ymd = zonedYmd(cursor)
  const [year, month] = ymd.split("-")
  const first = `${year}-${month}-01`
  const start = addDays(first, -weekdayIndex(first))
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function weekDays(cursor: Date) {
  const ymd = zonedYmd(cursor)
  const start = addDays(ymd, -weekdayIndex(ymd))
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function rangeFor(days: string[]) {
  const from = `${days[0]}T00:00:00.000Z`
  const to = `${addDays(days.at(-1)!, 1)}T00:00:00.000Z`
  return { from, to }
}

function dayName(ymd: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(deadlineInstant(ymd))
}

function hourOf(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PROFILE_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  return Number(parts.find((part) => part.type === "hour")?.value)
}

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
  const [cursor, setCursor] = useState(() => new Date())
  const today = zonedYmd(new Date())
  const days = useMemo(
    () => (span === "week" ? weekDays(cursor) : monthDays(cursor)),
    [span, cursor]
  )
  const range = useMemo(() => rangeFor(days), [days])
  const query = useQuery({
    queryKey: jobCalendarKey(range.from, range.to),
    queryFn: () => calendarJobs(range.from, range.to),
  })
  const jobs = (query.data ?? []).filter(
    (job) =>
      matches(job, company, location) && (showClosed || job.stage !== "closed")
  )

  function titlesOn(day: string) {
    return jobs.filter((job) => {
      if (job.deadline === day) return true
      return (
        job.interviewAt != null && zonedYmd(new Date(job.interviewAt)) === day
      )
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCursor(new Date())}
        >
          Today
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={span === "week"}
          onClick={() => onSpan("week")}
        >
          Week
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={span === "month"}
          onClick={() => onSpan("month")}
        >
          Month
        </Button>
      </div>
      {query.isLoading ? <p role="status">Loading jobs</p> : null}
      {query.isError ? (
        <div>
          <p>Could not load jobs. Refresh the page.</p>
          <Button type="button" onClick={() => void query.refetch()}>
            Refresh
          </Button>
        </div>
      ) : null}
      {span === "month" ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="hidden text-xs text-muted-foreground md:block"
            >
              {day}
            </div>
          ))}
          {days.map((day) => {
            const deadlineToday = jobs.some(
              (job) => job.deadline === day && day === today
            )
            return (
              <div
                key={day}
                role="group"
                aria-label={dayName(day)}
                className={cn(
                  "min-h-16 rounded-md border border-border p-1",
                  day === today && "bg-accent"
                )}
              >
                <span className="text-xs">{Number(day.slice(8))}</span>
                {titlesOn(day).map((job) => (
                  <p
                    key={job.id}
                    role="group"
                    aria-label={job.title}
                    className={cn(
                      "truncate text-xs",
                      deadlineToday && job.deadline === day && "bg-accent"
                    )}
                  >
                    {job.title}
                  </p>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2 md:grid md:grid-cols-7">
          {days.map((day) => (
            <div
              key={day}
              role="group"
              aria-label={dayName(day)}
              className={cn(
                "rounded-md border border-border p-2",
                day === today && "bg-accent"
              )}
            >
              <p className="text-xs text-muted-foreground">
                {WEEKDAYS[weekdayIndex(day)]} {Number(day.slice(8))}
              </p>
              <p className="text-xs text-muted-foreground">All day</p>
              {jobs
                .filter((job) => job.deadline === day)
                .map((job) => (
                  <p
                    key={job.id}
                    role="group"
                    aria-label={job.title}
                    className={cn("text-xs", day === today && "bg-accent")}
                  >
                    {job.title}
                  </p>
                ))}
              {HOURS.map((hour) => {
                const atHour = jobs.filter(
                  (job) =>
                    job.interviewAt != null &&
                    zonedYmd(new Date(job.interviewAt)) === day &&
                    hourOf(job.interviewAt) === hour
                )
                if (atHour.length === 0) return null
                return (
                  <div key={hour}>
                    <p className="text-xs text-muted-foreground">{hour}:00</p>
                    {atHour.map((job) => (
                      <p
                        key={job.id}
                        role="group"
                        aria-label={job.title}
                        className="text-xs"
                      >
                        {job.title}
                      </p>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
