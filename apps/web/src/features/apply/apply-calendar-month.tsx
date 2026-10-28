import { StageIcon } from "@workspace/ui/components/stage-icon"
import { cn } from "@workspace/ui/lib/utils"

import {
  TONE,
  WEEKDAYS,
  clock,
  dayName,
  eventsOn,
  type CalendarEvent,
} from "./apply-calendar-model.ts"

function MonthChip({ event }: { event: CalendarEvent }) {
  const { job } = event
  const label =
    event.kind === "interview"
      ? `${clock(event.startMinutes)} ${job.title}`
      : job.title
  return (
    <div
      role="group"
      aria-label={job.title}
      className="flex h-[22px] items-center gap-1.5 rounded-[5px] bg-secondary px-[7px]"
    >
      <StageIcon stage={job.stage} size={14} />
      <span
        className={cn(
          "truncate text-[11.5px] font-medium",
          job.stage === "closed" ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {label}
      </span>
    </div>
  )
}

export function MonthGrid({
  weeks,
  month,
  today,
  events,
}: {
  weeks: string[][]
  month: string
  today: string
  events: CalendarEvent[]
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-5">
      <div className="grid h-7 grid-cols-7 items-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-[11px] font-semibold text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid min-h-24 flex-1 grid-cols-7">
          {week.map((day, column) => (
            <div
              key={day}
              role="group"
              aria-label={dayName(day)}
              className={cn(
                "flex min-w-0 flex-col gap-1 border-t border-foreground/6 p-1.5",
                column > 0 && "border-s",
                column > 4 && "bg-foreground/[0.015]"
              )}
            >
              <span
                className={cn(
                  "flex size-[22px] items-center justify-center rounded-full text-xs font-medium",
                  day.slice(0, 7) === month ? TONE.number : TONE.faint,
                  day === today && "bg-foreground font-bold text-background"
                )}
              >
                {Number(day.slice(8))}
              </span>
              {eventsOn(events, day).map((event) => (
                <MonthChip key={event.key} event={event} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
