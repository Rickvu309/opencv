import { useId, useReducer, useRef, type ReactNode } from "react"
import { Calendar, Flag, MapPin, UserPlus } from "lucide-react"

import {
  jobPatchSchema,
  type JobDetail,
  type JobPriority,
  type JobStage,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { cn } from "@workspace/ui/lib/utils"

import { useRunCommand } from "@/lib/contract-client.ts"

import { railStageLabel } from "./apply-detail-labels.ts"
import {
  InitialsAvatar,
  PriorityMark,
  RAIL_POPOVER,
  RAIL_ROW,
  RailLabel,
  RailSection,
} from "./apply-detail-parts.tsx"
import { PaperRow } from "./apply-job-rail-paper.tsx"
import {
  ALL_STAGES,
  companyInitials,
  deadlineInstant,
  interviewInputValue,
  interviewInstant,
  monthDay,
  priorityLabel,
  stageLabel,
} from "./apply-stages.ts"
import { PostingSource } from "./apply-posting-source.tsx"
import { useChosenTimeZone } from "./apply-time-zone.ts"

const MENU_ITEM = "h-8 gap-[9px] px-2 text-[13px]"
const PRIORITIES: readonly JobPriority[] = ["high", "normal", "low"]

function interviewLabel(iso: string, zone: string) {
  const at = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  return `Interview ${monthDay(at, zone)}, ${read("hour")}:${read("minute")}`
}

function jobPropertyError(
  field: "location" | "recruiterName",
  value: string,
  label: string
) {
  const result = jobPatchSchema.safeParse({ [field]: value || null })
  return result.success ? null : `${label} must be 200 characters or fewer.`
}

function EditRow({
  icon,
  label,
  empty,
  ariaLabel,
  inputType = "text",
  value,
  validate,
  onSave,
}: {
  icon: ReactNode
  label: string
  empty: boolean
  ariaLabel: string
  inputType?: "text" | "date" | "datetime-local"
  value: string
  validate?: (value: string) => string | null
  onSave: (value: string) => Promise<void>
}) {
  const errorId = useId()
  const [{ open, draft, error, pending }, dispatch] = useReducer(editReducer, {
    open: false,
    draft: value,
    error: null,
    pending: false,
  })

  const saving = useRef(false)

  async function commit() {
    if (saving.current) return
    if (draft === value) {
      dispatch({ type: "closed" })
      return
    }
    const validationError = validate?.(draft)
    if (validationError) {
      dispatch({ type: "failed", error: validationError })
      return
    }
    saving.current = true
    dispatch({ type: "saving" })
    try {
      await onSave(draft)
      dispatch({ type: "saved" })
    } catch {
      dispatch({
        type: "failed",
        error: `Could not save ${ariaLabel.toLowerCase()}. Try again.`,
      })
    } finally {
      saving.current = false
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (saving.current) return
        if (next) {
          dispatch({ type: "opened", value })
        } else if (details.reason === "escape-key") {
          dispatch({ type: "closed" })
        } else {
          void commit()
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={empty ? label : `${ariaLabel}: ${label}`}
            className={cn("h-11 md:h-8", RAIL_ROW)}
          />
        }
      >
        {icon}
        <RailLabel empty={empty}>{label}</RailLabel>
      </PopoverTrigger>
      <PopoverContent align="start" className={RAIL_POPOVER}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void commit()
          }}
        >
          <Input
            aria-label={ariaLabel}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            type={inputType}
            value={draft}
            disabled={pending}
            onChange={(event) =>
              dispatch({ type: "typed", value: event.target.value })
            }
            className="h-11 rounded-[6px] text-base md:h-8 md:text-[13px]"
          />
          {error ? (
            <p
              id={errorId}
              role="alert"
              className="pt-1 text-[12px] text-destructive"
            >
              {error}
            </p>
          ) : null}
        </form>
      </PopoverContent>
    </Popover>
  )
}

function StageRow({
  job,
  onStage,
}: {
  job: JobDetail
  onStage: (stage: JobStage) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={`Stage: ${railStageLabel(job.stage)}`}
            className={cn("h-11 md:h-8", RAIL_ROW)}
          />
        }
      >
        <StageIcon stage={job.stage} />
        <RailLabel>{railStageLabel(job.stage)}</RailLabel>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {ALL_STAGES.map((stage) => (
          <DropdownMenuItem
            key={stage}
            className={MENU_ITEM}
            onClick={() => onStage(stage)}
          >
            <span aria-hidden className="flex">
              <StageIcon stage={stage} />
            </span>
            {stageLabel(stage)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PriorityRow({
  job,
  onPriority,
}: {
  job: JobDetail
  onPriority: (priority: JobPriority) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={`Priority: ${priorityLabel(job.priority)}`}
            className={cn("h-11 md:h-8", RAIL_ROW)}
          />
        }
      >
        <PriorityMark level={job.priority} />
        <RailLabel>{priorityLabel(job.priority)}</RailLabel>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {PRIORITIES.map((priority) => (
          <DropdownMenuItem
            key={priority}
            className={MENU_ITEM}
            onClick={() => onPriority(priority)}
          >
            <PriorityMark level={priority} />
            {priorityLabel(priority)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type EditState = {
  open: boolean
  draft: string
  error: string | null
  pending: boolean
}

type EditAction =
  | { type: "opened"; value: string }
  | { type: "closed" }
  | { type: "typed"; value: string }
  | { type: "saving" }
  | { type: "saved" }
  | { type: "failed"; error: string }

function editReducer(state: EditState, action: EditAction): EditState {
  switch (action.type) {
    case "opened":
      return { open: true, draft: action.value, error: null, pending: false }
    case "closed":
      return { ...state, open: false, error: null, pending: false }
    case "typed":
      return { ...state, draft: action.value, error: null }
    case "saving":
      return { ...state, error: null, pending: true }
    case "saved":
      return { ...state, open: false, error: null, pending: false }
    case "failed":
      return { ...state, open: true, error: action.error, pending: false }
  }
}

export function JobRail({
  job,
  onStage,
  onPriority,
  className,
}: {
  job: JobDetail
  onStage: (stage: JobStage) => void
  onPriority: (priority: JobPriority) => void
  className?: string
}) {
  const run = useRunCommand()
  const zone = useChosenTimeZone()

  function save(
    patch: Parameters<typeof run<"job.update">>[1]["patch"]
  ): Promise<void> {
    return run("job.update", { jobId: job.id, patch }).then(() => undefined)
  }

  const location = job.location ?? ""
  const deadline = job.deadline ?? ""
  const recruiter = job.recruiterName ?? ""

  return (
    <aside
      aria-label="Properties"
      className={cn(
        "flex w-full shrink-0 flex-col gap-0.5 border-t border-foreground/6 px-3.5 py-4 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l",
        className
      )}
    >
      <RailSection title="Properties">
        <StageRow job={job} onStage={onStage} />
        <PriorityRow job={job} onPriority={onPriority} />
        <EditRow
          key={`location-${location}`}
          icon={<MapPin aria-hidden className="size-3.5 text-chart-1" />}
          label={location || "Add location"}
          empty={!location}
          ariaLabel="Location"
          value={location}
          validate={(value) => jobPropertyError("location", value, "Location")}
          onSave={(value) => save({ location: value || null })}
        />
        <EditRow
          key={`interview-${job.interviewAt ?? ""}`}
          icon={<Calendar aria-hidden className="size-3.5 text-chart-3" />}
          label={
            job.interviewAt
              ? interviewLabel(job.interviewAt, zone)
              : "Add interview"
          }
          empty={!job.interviewAt}
          ariaLabel="Interview"
          inputType="datetime-local"
          value={interviewInputValue(job.interviewAt, zone)}
          onSave={(value) =>
            save({ interviewAt: interviewInstant(value, zone) })
          }
        />
        <EditRow
          key={`deadline-${deadline}`}
          icon={
            <Flag
              aria-hidden
              className={cn(
                "size-3.5",
                deadline ? "text-chart-4" : "text-muted-foreground"
              )}
            />
          }
          label={
            deadline
              ? `Apply by ${monthDay(deadlineInstant(deadline), "UTC")}`
              : "Add deadline"
          }
          empty={!deadline}
          ariaLabel="Deadline"
          inputType="date"
          value={deadline}
          onSave={(value) => save({ deadline: value || null })}
        />
        <EditRow
          key={`recruiter-${recruiter}`}
          icon={
            recruiter ? (
              <InitialsAvatar
                initials={companyInitials(recruiter)}
                size={16}
                fontSize={7}
              />
            ) : (
              <UserPlus
                aria-hidden
                className="size-3.5 text-muted-foreground"
              />
            )
          }
          label={recruiter || "Add recruiter"}
          empty={!recruiter}
          ariaLabel="Recruiter"
          value={recruiter}
          validate={(value) =>
            jobPropertyError("recruiterName", value, "Recruiter")
          }
          onSave={(value) => save({ recruiterName: value || null })}
        />
        <PostingSource jobUrl={job.jobUrl} sourceHost={job.sourceHost} />
      </RailSection>
      <RailSection title="Paper" className="mt-3.5">
        <PaperRow kind="cv" job={job} />
        <PaperRow kind="letter" job={job} />
      </RailSection>
    </aside>
  )
}
