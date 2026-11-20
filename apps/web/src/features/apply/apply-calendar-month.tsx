import { StageIcon } from "@workspace/ui/components/stage-icon"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { FAINT_TEXT } from "./apply-tone.ts"
import {
  TONE,
  WEEKDAYS,
  clock,
  dayName,
  eventsOn,
  type CalendarEvent,
} from "./apply-calendar-model.ts"

function MonthChip({
  event,
  onOpenJob,
}: {
  event: CalendarEvent
  onOpenJob: (jobId: string) => void
}) {
  const { job } = event
  const label =
    event.kind === "interview"
      ? `${clock(event.startMinutes)} ${job.title}`
      : job.title
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={
        event.kind === "interview"
          ? `Interview ${clock(event.startMinutes)}: ${job.title}, ${job.company}`
          : `Deadline: ${job.title}, ${job.company}`
      }
      onClick={() => onOpenJob(job.id)}
      className="flex h-11 min-w-0 items-center justify-start gap-1.5 rounded-sm bg-secondary px-[7px] text-start md:h-[22px]"
    >
      <StageIcon stage={job.stage} size={14} />
      <span
        className={cn(
          "truncate text-[11.5px] font-medium",
          job.stage === "closed" ? FAINT_TEXT.secondary : "text-foreground"
        )}
      >
        {label}
      </span>
    </Button>
  )
}

export function MonthGrid({
  weeks,
  month,
  today,
  events,
  onOpenJob,
}: {
  weeks: string[][]
  month: string
  today: string
  events: CalendarEvent[]
  onOpenJob: (jobId: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-5">
      <div className="grid h-7 grid-cols-7 items-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={cn("text-[11px] font-semibold", TONE.label)}
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
                  day.slice(0, 7) === month
                    ? TONE.number
                    : column > 4
                      ? TONE.faintOnTint
                      : TONE.faint,
                  day === today && "bg-foreground font-bold text-background"
                )}
              >
                {Number(day.slice(8))}
              </span>
              {eventsOn(events, day).map((event) => (
                <MonthChip
                  key={event.key}
                  event={event}
                  onOpenJob={onOpenJob}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
