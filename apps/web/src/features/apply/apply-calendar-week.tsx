import { Flag } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { cn } from "@workspace/ui/lib/utils"

import {
  TONE,
  WEEKDAYS,
  blockSpan,
  clock,
  dayName,
  eventsOn,
  hoursFor,
  placeInterviews,
  weekdayIndex,
  type CalendarEvent,
} from "./apply-calendar-model.ts"

const HOUR_PX = 58

function EventBlock({
  event,
  lane,
  lanes,
  hours,
  onOpenJob,
}: {
  event: CalendarEvent
  lane: number
  lanes: number
  hours: number[]
  onOpenJob: (jobId: string) => void
}) {
  const span = blockSpan(event, hours)
  const { job } = event
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={`Interview ${clock(event.startMinutes)} to ${clock(event.endMinutes)}: ${job.title}, ${job.company}`}
      onClick={() => onOpenJob(job.id)}
      className="absolute flex h-auto min-w-0 flex-col items-start justify-start gap-px overflow-hidden rounded-md bg-chart-2/[0.09] py-1.5 pr-2 pl-2.5 text-start whitespace-normal hover:bg-chart-2/[0.15] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        top: (span.top / 60) * HOUR_PX + 1,
        height: (span.length / 60) * HOUR_PX - 2,
        left: `calc(${(lane / lanes) * 100}% + 4px)`,
        width: `calc(${100 / lanes}% - 8px)`,
      }}
    >
      <span className="truncate text-xs font-medium text-[color-mix(in_oklab,var(--chart-2),var(--foreground)_38%)]">
        {job.title}
      </span>
      <span className="truncate text-[11.5px] text-[color-mix(in_oklab,var(--chart-2),var(--foreground)_19%)]">
        {job.company}
      </span>
      <span className="truncate text-[11px] font-normal text-[color-mix(in_srgb,var(--chart-2)_68%,var(--foreground))]">
        {`${clock(event.startMinutes)} to ${clock(event.endMinutes)}`}
      </span>
    </Button>
  )
}

export function WeekGrid({
  days,
  today,
  events,
  onOpenJob,
}: {
  days: string[]
  today: string
  events: CalendarEvent[]
  onOpenJob: (jobId: string) => void
}) {
  const hours = hoursFor(events)
  return (
    <div className="min-h-0 flex-1 overflow-x-auto px-6 pb-5">
      <div className="grid min-w-3xl grid-cols-[52px_repeat(7,minmax(0,1fr))]">
        <div aria-hidden="true" />
        {days.map((day) => (
          <div
            key={day}
            className={cn(
              "p-2 text-xs font-semibold",
              "border-s border-foreground/6",
              day === today ? "text-foreground" : TONE.label
            )}
          >
            {WEEKDAYS[weekdayIndex(day)]} {Number(day.slice(8))}
          </div>
        ))}
        <div className={cn("pt-2 pr-3 text-right text-[10px]", TONE.label)}>
          All day
        </div>
        {days.map((day, column) => (
          <div
            key={day}
            role="group"
            aria-label={`${dayName(day)}, all day`}
            className={cn(
              "flex min-h-9 flex-col gap-1 p-1",
              "border-s border-foreground/6",
              column > 4 && "bg-foreground/[0.015]"
            )}
          >
            {eventsOn(events, day)
              .filter((event) => event.kind === "deadline")
              .map(({ key, job }) => (
                <Button
                  type="button"
                  variant="ghost"
                  key={key}
                  aria-label={`Deadline: ${job.title}`}
                  onClick={() => onOpenJob(job.id)}
                  className="flex h-[22px] min-w-0 items-center gap-[5px] rounded-[5px] bg-secondary px-[7px]"
                >
                  <Flag className="size-[11px] text-muted-foreground" />
                  <span className="truncate text-[11.5px] font-medium text-foreground">
                    {job.title} due
                  </span>
                </Button>
              ))}
          </div>
        ))}
        <div>
          {hours.map((hour) => (
            <div key={hour} style={{ height: HOUR_PX }}>
              <span
                className={cn(
                  "block w-10 -translate-y-1/2 text-right text-[10.5px]",
                  TONE.label
                )}
              >
                {hour}:00
              </span>
            </div>
          ))}
        </div>
        {days.map((day, column) => (
          <div
            key={day}
            role="group"
            aria-label={dayName(day)}
            className={cn(
              "relative",
              "border-s border-foreground/6",
              column > 4 && "bg-foreground/[0.015]"
            )}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-t border-foreground/6"
                style={{ height: HOUR_PX }}
              />
            ))}
            {placeInterviews(
              eventsOn(events, day).filter(
                (event) => event.kind === "interview"
              )
            ).map(({ event, lane, lanes }) => (
              <EventBlock
                key={event.key}
                event={event}
                lane={lane}
                lanes={lanes}
                hours={hours}
                onOpenJob={onOpenJob}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
