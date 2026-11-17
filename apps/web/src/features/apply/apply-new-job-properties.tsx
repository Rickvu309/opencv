import { useReducer } from "react"
import { CalendarIcon, MapPin } from "lucide-react"
import type { JobStage } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { StageIcon } from "@workspace/ui/components/stage-icon"

import {
  ALL_STAGES,
  deadlineInstant,
  monthDay,
  stageLabel,
} from "./apply-stages.ts"

function locationReducer(
  _open: boolean,
  action: { type: "opened" | "closed" }
) {
  return action.type === "opened"
}

const CHIP =
  "gap-1.5 rounded-full border-border px-[9px] text-xs font-normal text-foreground [&_svg:not([class*='size-'])]:size-[13px]"

export function NewJobProperties({
  stage,
  deadline,
  location,
  dateError,
  dateErrorId,
  onStage,
  onDeadline,
  onLocation,
}: {
  stage: JobStage
  deadline: string
  location: string
  dateError: boolean
  dateErrorId?: string
  onStage: (stage: JobStage) => void
  onDeadline: (deadline: string) => void
  onLocation: (location: string) => void
}) {
  const [locationOpen, dispatchLocation] = useReducer(locationReducer, false)
  const deadlineValid = /^\d{4}-\d{2}-\d{2}$/.test(deadline)
  const deadlineText = deadlineValid
    ? monthDay(deadlineInstant(deadline), "UTC")
    : "Deadline"

  return (
    <div className="flex flex-wrap items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label={`Stage: ${stageLabel(stage)}`}
              className={`h-11 md:h-7 ${CHIP}`}
            />
          }
        >
          <StageIcon stage={stage} />
          {stageLabel(stage)}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-36">
          <DropdownMenuRadioGroup
            value={stage}
            onValueChange={(value) => onStage(value as JobStage)}
          >
            {ALL_STAGES.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {stageLabel(option)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? dateErrorId : undefined}
              className={`h-11 md:h-7 ${CHIP} ${deadlineValid ? "" : "text-muted-foreground"}`}
            />
          }
        >
          <CalendarIcon className="text-muted-foreground" aria-hidden />
          {deadlineText}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48">
          <Input
            type="date"
            aria-label="Deadline"
            value={deadline}
            onChange={(event) => onDeadline(event.target.value)}
          />
        </PopoverContent>
      </Popover>
      {
        <Popover
          open={locationOpen}
          onOpenChange={(open) =>
            dispatchLocation({ type: open ? "opened" : "closed" })
          }
        >
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className={`h-11 md:h-7 ${CHIP}`}
              />
            }
          >
            <MapPin className="text-chart-1" aria-hidden />
            {location || (
              <span className="text-muted-foreground">Location</span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56">
            <Input
              aria-label="Location"
              value={location}
              onChange={(event) => onLocation(event.target.value)}
            />
          </PopoverContent>
        </Popover>
      }
    </div>
  )
}
