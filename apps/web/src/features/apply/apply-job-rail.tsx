import { useReducer, useRef, type ReactNode } from "react"
import { useEffectReducer, type EffectReducer } from "use-effect-reducer"
import { Link } from "@tanstack/react-router"
import {
  Calendar,
  FileText,
  Flag,
  Mail,
  MapPin,
  PenLine,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react"

import {
  jobPatchSchema,
  parsePaperId,
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
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Separator } from "@workspace/ui/components/separator"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { cn } from "@workspace/ui/lib/utils"

import { reportRejected } from "@/lib/command-failure.ts"
import { useRunCommand } from "@/lib/contract-client.ts"

import { listPaper, type PaperListItem } from "./apply-api.ts"
import { railStageLabel } from "./apply-detail-labels.ts"
import {
  InitialsAvatar,
  PriorityMark,
  RAIL_ROW,
  RailSection,
} from "./apply-detail-parts.tsx"
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
import { FAINT_TEXT } from "./apply-tone.ts"

const POPOVER =
  "w-[270px] gap-0.5 rounded-[10px] p-1.5 shadow-[0_2px_4px_rgb(0_0_0/0.06),0_24px_60px_rgb(0_0_0/0.14)] ring-foreground/6"
const MENU_ITEM = "h-8 gap-[9px] px-2 text-[13px]"
const PRIORITIES: readonly JobPriority[] = ["high", "normal", "low"]

const PICKER_ROW =
  "w-full justify-start gap-[9px] rounded-[6px] px-2 text-[12.5px] font-normal text-foreground hover:bg-secondary"

function interviewLabel(iso: string) {
  const at = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  return `Interview ${monthDay(at)}, ${read("hour")}:${read("minute")}`
}

function Label({ children, empty }: { children: ReactNode; empty?: boolean }) {
  return (
    <span className={cn("truncate", empty && FAINT_TEXT.card)}>{children}</span>
  )
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
        <Label empty={empty}>{label}</Label>
      </PopoverTrigger>
      <PopoverContent align="start" className={POPOVER}>
        <PopoverTitle className="sr-only">{ariaLabel}</PopoverTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void commit()
          }}
        >
          <Input
            aria-label={ariaLabel}
            type={inputType}
            value={draft}
            disabled={pending}
            onChange={(event) =>
              dispatch({ type: "typed", value: event.target.value })
            }
            className="h-8 rounded-[6px] text-[13px] md:text-[13px]"
          />
          {error ? (
            <p role="alert" className="pt-1 text-[12px] text-destructive">
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
        <Label>{railStageLabel(job.stage)}</Label>
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
        <Label>{priorityLabel(job.priority)}</Label>
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

type PickerDoc = PaperListItem & { status?: string; updatedAt?: string }

function docMeta(doc: PickerDoc) {
  const draft = doc.status === "draft"
  if (!doc.updatedAt) return draft ? "Draft" : ""
  const edited = monthDay(new Date(doc.updatedAt))
  return draft ? `Draft, edited ${edited}` : `Edited ${edited}`
}

type PickerList =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; docs: PickerDoc[] }

type PickerState = {
  open: boolean
  list: PickerList
  search: string
  request: number
}

type PickerEvent =
  | { type: "opened"; kind: "cv" | "letter" }
  | { type: "closed" }
  | { type: "search_typed"; value: string }
  | { type: "docs_loaded"; docs: PickerDoc[]; request: number }
  | { type: "docs_failed"; request: number }

const pickerReducer: EffectReducer<PickerState, PickerEvent> = (
  state,
  event,
  exec
) => {
  switch (event.type) {
    case "opened": {
      const request = state.request + 1
      exec((_state, _effect, dispatch) => {
        void listPaper(event.kind)
          .then((rows) =>
            dispatch({
              type: "docs_loaded",
              docs: rows.filter((row) => row.kind === event.kind),
              request,
            })
          )
          .catch(() => dispatch({ type: "docs_failed", request }))
      })
      return {
        ...state,
        open: true,
        list: { status: "loading" },
        search: "",
        request,
      }
    }
    case "closed":
      return { ...state, open: false }
    case "search_typed":
      return { ...state, search: event.value }
    case "docs_loaded":
      return event.request === state.request
        ? { ...state, list: { status: "ready", docs: event.docs } }
        : state
    case "docs_failed":
      return event.request === state.request
        ? { ...state, list: { status: "error" } }
        : state
  }
}

function PaperRow({ kind, job }: { kind: "cv" | "letter"; job: JobDetail }) {
  const run = useRunCommand()
  const linked = kind === "cv" ? job.linked.cv : job.linked.letter
  const [{ open, list, search }, dispatch] = useEffectReducer(pickerReducer, {
    open: false,
    list: { status: "loading" },
    search: "",
    request: 0,
  })
  const DocIcon = kind === "cv" ? FileText : Mail
  const addLabel = kind === "cv" ? "Add CV" : "Add cover letter"
  const noun = kind === "cv" ? "CVs" : "cover letters"
  const docs = list.status === "ready" ? list.docs : []
  const shown = docs.filter((doc) =>
    doc.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) =>
        dispatch(next ? { type: "opened", kind } : { type: "closed" })
      }
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={
              linked
                ? `${kind === "cv" ? "CV" : "Cover letter"}: ${linked.name}`
                : addLabel
            }
            className={cn("h-11 md:h-8", RAIL_ROW)}
          />
        }
      >
        {linked ? (
          <FileText aria-hidden className="size-3.5 text-muted-foreground" />
        ) : (
          <Plus aria-hidden className="size-3.5 text-muted-foreground" />
        )}
        <Label empty={!linked}>{linked ? linked.name : addLabel}</Label>
      </PopoverTrigger>
      <PopoverContent align="start" className={POPOVER}>
        <PopoverTitle className="sr-only">
          {kind === "cv" ? "CV" : "Cover letter"}
        </PopoverTitle>
        <div className="flex h-8 items-center gap-2 border-b border-foreground/6 px-2">
          <Search aria-hidden className="size-[13px] text-muted-foreground" />
          <Input
            aria-label="Find in Paper"
            value={search}
            placeholder="Find in Paper"
            className="h-11 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0 md:h-8 md:text-[12.5px] dark:bg-transparent"
            onChange={(event) =>
              dispatch({ type: "search_typed", value: event.target.value })
            }
          />
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          {list.status === "loading" ? (
            <p
              role="status"
              className="px-2 py-3 text-sm text-muted-foreground"
            >
              Loading Paper…
            </p>
          ) : list.status === "error" ? (
            <>
              <p
                role="alert"
                className="px-2 py-3 text-sm text-muted-foreground"
              >
                Could not load Paper. Try again.
              </p>
              <Button
                type="button"
                variant="ghost"
                className={cn("h-11 md:h-9", PICKER_ROW)}
                onClick={() => dispatch({ type: "opened", kind })}
              >
                Try again
              </Button>
            </>
          ) : shown.length === 0 ? (
            <>
              <p
                role="status"
                className="px-2 py-3 text-sm text-muted-foreground"
              >
                {docs.length === 0
                  ? `No ${noun} in Paper yet.`
                  : `No ${noun} match your search.`}
              </p>
              {search.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  className={cn("h-11 md:h-9", PICKER_ROW)}
                  onClick={() => dispatch({ type: "search_typed", value: "" })}
                >
                  Clear search
                </Button>
              ) : null}
              {kind === "cv" && docs.length === 0 ? (
                <Link
                  to="/paper"
                  className="px-2 py-2 text-sm text-foreground hover:underline"
                >
                  Create a CV in Paper
                </Link>
              ) : null}
            </>
          ) : null}
          {shown.map((doc) => (
            <Button
              key={doc.id}
              type="button"
              variant="ghost"
              className={cn("h-11 md:h-9", PICKER_ROW)}
              onClick={() => {
                void run("job.linkPaper", {
                  jobId: job.id,
                  docId: parsePaperId(doc.id),
                  kind,
                }).catch(reportRejected("link this paper"))
                dispatch({ type: "closed" })
              }}
            >
              <DocIcon aria-hidden className="size-3.5 text-muted-foreground" />
              <span className="flex min-w-0 flex-col items-start">
                <span className="truncate">{doc.name}</span>
                {docMeta(doc) ? (
                  <span className="text-[11px] text-muted-foreground">
                    {docMeta(doc)}
                  </span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
        {linked || kind === "letter" ? (
          <Separator className="my-0.5 bg-foreground/6" />
        ) : null}
        {linked ? (
          <Button
            type="button"
            variant="ghost"
            className={cn(PICKER_ROW, "h-11 md:h-8")}
            onClick={() => {
              void run("job.unlinkPaper", { jobId: job.id, kind }).catch(
                reportRejected("remove this paper")
              )
              dispatch({ type: "closed" })
            }}
          >
            <X aria-hidden className="size-3.5 text-muted-foreground" />
            Remove
          </Button>
        ) : null}
        {kind === "letter" ? (
          <Link
            to="/paper"
            className="flex h-11 items-center gap-[9px] rounded-[6px] px-2 text-[12.5px] text-foreground hover:bg-secondary md:h-8"
          >
            <PenLine aria-hidden className="size-3.5 text-muted-foreground" />
            Write a new cover letter
          </Link>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export function JobRail({
  job,
  onStage,
  onPriority,
}: {
  job: JobDetail
  onStage: (stage: JobStage) => void
  onPriority: (priority: JobPriority) => void
}) {
  const run = useRunCommand()

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
      className="flex w-full shrink-0 flex-col gap-0.5 border-t border-foreground/6 px-3.5 py-4 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l"
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
            job.interviewAt ? interviewLabel(job.interviewAt) : "Add interview"
          }
          empty={!job.interviewAt}
          ariaLabel="Interview"
          inputType="datetime-local"
          value={interviewInputValue(job.interviewAt)}
          onSave={(value) => save({ interviewAt: interviewInstant(value) })}
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
