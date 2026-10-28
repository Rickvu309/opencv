import { useState, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  Calendar,
  FileText,
  Flag,
  Link as LinkIcon,
  Mail,
  MapPin,
  PenLine,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react"

import {
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
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Separator } from "@workspace/ui/components/separator"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { cn } from "@workspace/ui/lib/utils"

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
import { FAINT_TEXT } from "./apply-tone.ts"

const POPOVER =
  "w-[270px] gap-0.5 rounded-[10px] p-1.5 shadow-[0_2px_4px_rgb(0_0_0/0.06),0_24px_60px_rgb(0_0_0/0.14)] ring-foreground/6"
const MENU_ITEM = "h-8 gap-[9px] px-2 text-[13px]"
const PRIORITIES: readonly JobPriority[] = ["high", "normal", "low"]

const PICKER_ROW =
  "h-9 w-full justify-start gap-[9px] rounded-[6px] px-2 text-[12.5px] font-normal text-foreground hover:bg-secondary"

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

function EditRow({
  icon,
  label,
  empty,
  ariaLabel,
  inputType = "text",
  value,
  onSave,
}: {
  icon: ReactNode
  label: string
  empty: boolean
  ariaLabel: string
  inputType?: "text" | "date" | "datetime-local"
  value: string
  onSave: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    if (draft !== value) onSave(draft)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (next) setDraft(value)
        else if (details.reason !== "escape-key") commit()
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={empty ? label : `${ariaLabel}: ${label}`}
            className={RAIL_ROW}
          />
        }
      >
        {icon}
        <Label empty={empty}>{label}</Label>
      </PopoverTrigger>
      <PopoverContent align="start" className={POPOVER}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            commit()
            setOpen(false)
          }}
        >
          <Input
            aria-label={ariaLabel}
            type={inputType}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-8 rounded-[6px] text-[13px] md:text-[13px]"
          />
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
            className={RAIL_ROW}
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
            className={RAIL_ROW}
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

type PickerDoc = PaperListItem & { status?: string; updatedAt?: string }

function docMeta(doc: PickerDoc) {
  const draft = doc.status === "draft"
  if (!doc.updatedAt) return draft ? "Draft" : ""
  const edited = monthDay(new Date(doc.updatedAt))
  return draft ? `Draft, edited ${edited}` : `Edited ${edited}`
}

function PaperRow({ kind, job }: { kind: "cv" | "letter"; job: JobDetail }) {
  const run = useRunCommand()
  const linked = kind === "cv" ? job.linked.cv : job.linked.letter
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<PickerDoc[] | null>(null)
  const [search, setSearch] = useState("")
  const DocIcon = kind === "cv" ? FileText : Mail
  const addLabel = kind === "cv" ? "Add CV" : "Add cover letter"
  const shown = (docs ?? []).filter((doc) =>
    doc.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  function toggle(next: boolean) {
    setOpen(next)
    if (!next) return
    setSearch("")
    void listPaper(kind)
      .then((rows) => setDocs(rows.filter((row) => row.kind === kind)))
      .catch(() => setDocs([]))
  }

  return (
    <Popover open={open} onOpenChange={toggle}>
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
            className={RAIL_ROW}
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
        <div className="flex h-8 items-center gap-2 border-b border-foreground/6 px-2">
          <Search aria-hidden className="size-[13px] text-muted-foreground" />
          <Input
            aria-label="Find in Paper"
            value={search}
            placeholder="Find in Paper"
            className="h-8 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0 md:text-[12.5px] dark:bg-transparent"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          {shown.map((doc) => (
            <Button
              key={doc.id}
              type="button"
              variant="ghost"
              className={PICKER_ROW}
              onClick={() => {
                void run("job.linkPaper", {
                  jobId: job.id,
                  docId: parsePaperId(doc.id),
                  kind,
                })
                setOpen(false)
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
            className={cn(PICKER_ROW, "h-8")}
            onClick={() => {
              void run("job.unlinkPaper", { jobId: job.id, kind })
              setOpen(false)
            }}
          >
            <X aria-hidden className="size-3.5 text-muted-foreground" />
            Remove
          </Button>
        ) : null}
        {kind === "letter" ? (
          <Link
            to="/paper"
            className="flex h-8 items-center gap-[9px] rounded-[6px] px-2 text-[12.5px] text-foreground hover:bg-secondary"
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
}: {
  job: JobDetail
  onStage: (stage: JobStage) => void
}) {
  const run = useRunCommand()

  function save(patch: Parameters<typeof run<"job.update">>[1]["patch"]) {
    void run("job.update", { jobId: job.id, patch })
  }

  const location = job.location ?? ""
  const deadline = job.deadline ?? ""
  const recruiter = job.recruiterName ?? ""
  const source = job.sourceHost || job.jobUrl || ""

  return (
    <aside
      aria-label="Properties"
      className="flex w-full shrink-0 flex-col gap-0.5 border-t border-foreground/6 px-3.5 py-4 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l"
    >
      <RailSection title="Properties">
        <StageRow job={job} onStage={onStage} />
        <PriorityRow job={job} onPriority={(priority) => save({ priority })} />
        <EditRow
          key={`location-${location}`}
          icon={<MapPin aria-hidden className="size-3.5 text-chart-1" />}
          label={location || "Add location"}
          empty={!location}
          ariaLabel="Location"
          value={location}
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
          onSave={(value) => save({ recruiterName: value || null })}
        />
        {source ? (
          <div
            data-slot="property"
            className="flex h-8 items-center gap-[9px] px-2 text-[13px] text-foreground"
          >
            <LinkIcon
              aria-hidden
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="truncate">{source}</span>
          </div>
        ) : null}
      </RailSection>
      <RailSection title="Paper" className="mt-3.5">
        <PaperRow kind="cv" job={job} />
        <PaperRow kind="letter" job={job} />
      </RailSection>
    </aside>
  )
}
