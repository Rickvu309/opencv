import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  commands,
  parsePaperId,
  type JobId,
  type JobDetail,
  type JobPriority,
  type JobStage,
} from "@workspace/domain"
import { Link, useNavigate } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight, MoreHorizontal, Star } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast, toastWithUndo } from "@workspace/ui/components/sonner"

import { authClient } from "@/lib/auth-client.ts"
import { recordFirstCafeItem } from "@/features/home/first-cafe-checklist.ts"

import {
  getJob,
  jobGetKey,
  jobListKey,
  listActivity,
  listJobs,
  listPaper,
  undoActivity,
  type PaperListItem,
} from "./apply-api.ts"
import {
  ActivityItem,
  ChecklistItem as ChecklistRow,
  PriorityBars,
  Property,
} from "./apply-parts.tsx"
import {
  ALL_STAGES,
  compareJobs,
  interviewInputValue,
  interviewInstant,
  priorityLabel,
  stageLabel,
} from "./apply-stages.ts"
import {
  activityKey,
  refreshQueries,
  useRunCommand,
} from "@/lib/contract-client.ts"

const POSTING = [
  ["About the role", "about"],
  ["What you'll do", "duties"],
  ["What they look for", "requirements"],
  ["Details", "details"],
] as const

function fieldTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
}

export function ApplyJobDetail({ jobId: id }: { jobId: JobId }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const run = useRunCommand()
  const { data: session } = authClient.useSession()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [step, setStep] = useState("")
  const [note, setNote] = useState("")
  const detail = useQuery({
    queryKey: jobGetKey(id),
    queryFn: () => getJob(id),
  })
  const jobs = useQuery({
    queryKey: jobListKey(),
    queryFn: listJobs,
  })
  const activity = useQuery({
    queryKey: activityKey(id),
    queryFn: () => listActivity(id),
  })

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      if (fieldTarget(event.target)) return
      event.preventDefault()
      setDeleteOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const ordered = [...(jobs.data ?? [])].sort(compareJobs)
  const index = ordered.findIndex((job) => job.id === id)
  const previous = index > 0 ? ordered[index - 1] : undefined
  const next = index >= 0 ? ordered[index + 1] : undefined
  const job = detail.data

  function noteCafe() {
    const userId = session?.user.id
    if (userId) recordFirstCafeItem(userId, "apply")
  }

  async function changeStage(stage: JobStage) {
    const result = await run("job.move", { jobId: id, stage })
    noteCafe()
    if (stage === "closed" && result.activityId) {
      const activityId = result.activityId
      toastWithUndo("Moved to Closed", () => {
        void undoActivity(queryClient, activityId)
      })
    }
  }

  async function savePatch(
    patch: Parameters<typeof run<"job.update">>[1]["patch"]
  ) {
    await run("job.update", { jobId: id, patch })
  }

  if (detail.isLoading) return <p role="status">Loading jobs</p>
  if (detail.isError || !job) {
    return (
      <div>
        <p>Could not load jobs. Refresh the page.</p>
        <Button type="button" onClick={() => void detail.refetch()}>
          Refresh
        </Button>
      </div>
    )
  }

  const done = job.checklist.filter((item) => item.done).length
  const total = job.checklist.length
  const prepName =
    total > 0 ? `Interview prep, ${done} of ${total}` : "Interview prep"
  const rows = (activity.data ?? []).filter((row) => !row.undoneAt)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 px-5 py-3"
      >
        <Link to="/app/apply" className="text-sm font-medium">
          Apply
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous job"
          disabled={!previous}
          onClick={() =>
            previous &&
            void navigate({
              to: "/app/apply/$jobId",
              params: { jobId: previous.id },
            })
          }
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm whitespace-nowrap">
          {index >= 0 ? ` ${index + 1} / ${ordered.length} ` : ""}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next job"
          disabled={!next}
          onClick={() =>
            next &&
            void navigate({
              to: "/app/apply/$jobId",
              params: { jobId: next.id },
            })
          }
        >
          <ChevronRight />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Favorite"
          aria-pressed={job.starred}
          onClick={() =>
            void run("job.star", { jobId: id, starred: !job.starred })
          }
        >
          <Star />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="More"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
              Delete job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-5 pb-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <header>
            <h1 className="text-lg font-medium">{job.title}</h1>
            <p className="text-sm text-muted-foreground">{job.company}</p>
          </header>
          <Posting job={job} />
          <section aria-label={prepName} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Interview prep</h2>
            {total > 0 ? (
              <p className="text-xs text-muted-foreground">
                {done} of {total}
              </p>
            ) : null}
            {job.checklist.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                onToggle={() =>
                  void run("job.setChecklistItem", {
                    jobId: id,
                    itemId: item.id,
                    done: !item.done,
                  })
                }
              />
            ))}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const label = step.trim()
                if (!label) return
                void run("job.addChecklistItem", { jobId: id, label }).then(
                  () => {
                    setStep("")
                  }
                )
              }}
            >
              <Label htmlFor="add-step" className="sr-only">
                Add a step
              </Label>
              <Input
                id="add-step"
                value={step}
                placeholder="Add a step"
                onChange={(event) => setStep(event.target.value)}
              />
              <Button type="submit" variant="ghost">
                Add a step
              </Button>
            </form>
          </section>
          <section aria-label="Activity" className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Activity</h2>
            <ul className="flex flex-col gap-1">
              {rows.map((row) => (
                <ActivityItem key={row.id} row={row} />
              ))}
            </ul>
          </section>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const body = note.trim()
              if (!body) return
              void run("job.addNote", { jobId: id, body }).then(() => {
                setNote("")
              })
            }}
          >
            <Label htmlFor="job-note">Leave a note</Label>
            <Textarea
              id="job-note"
              value={note}
              placeholder="Leave a note…"
              onChange={(event) => setNote(event.target.value)}
            />
            <Button type="submit" variant="ghost">
              Leave a note
            </Button>
          </form>
        </div>
        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
          <Button
            type="button"
            variant="ghost"
            onClick={() => toast("Subscriptions are not on yet.")}
          >
            Subscribe
          </Button>
          <h2 className="text-sm font-medium">Properties</h2>
          <Property label="Stage">
            <Select
              value={job.stage}
              onValueChange={(value) => {
                if (value) void changeStage(value as JobStage)
              }}
            >
              <SelectTrigger aria-label="Stage">
                <SelectValue>{stageLabel(job.stage)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ALL_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stageLabel(stage)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Property>
          <Property label="Priority">
            <div className="flex items-center gap-2">
              <PriorityBars level={job.priority} />
              <Select
                value={job.priority}
                onValueChange={(value) => {
                  if (value) void savePatch({ priority: value as JobPriority })
                }}
              >
                <SelectTrigger aria-label="Priority">
                  <SelectValue>{priorityLabel(job.priority)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["low", "normal", "high"] as const).map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priorityLabel(priority)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Property>
          <Property label="Location">
            <Input
              aria-label="Location"
              defaultValue={job.location ?? ""}
              key={`${job.id}-location-${job.location ?? ""}`}
              onBlur={(event) =>
                void savePatch({ location: event.target.value || null })
              }
            />
          </Property>
          <Property label="Interview">
            <Input
              aria-label="Interview"
              type="datetime-local"
              defaultValue={interviewInputValue(job.interviewAt)}
              key={`${job.id}-interview-${job.interviewAt ?? ""}`}
              onBlur={(event) =>
                void savePatch({
                  interviewAt: interviewInstant(event.target.value),
                })
              }
            />
          </Property>
          <Property label="Deadline">
            <Input
              aria-label="Deadline"
              type="date"
              defaultValue={job.deadline ?? ""}
              key={`${job.id}-deadline-${job.deadline ?? ""}`}
              placeholder="Add deadline"
              onBlur={(event) =>
                void savePatch({ deadline: event.target.value || null })
              }
            />
          </Property>
          <Property label="Recruiter">
            <Input
              aria-label="Recruiter"
              defaultValue={job.recruiterName ?? ""}
              key={`${job.id}-recruiter-${job.recruiterName ?? ""}`}
              placeholder="Add recruiter"
              onBlur={(event) =>
                void savePatch({ recruiterName: event.target.value || null })
              }
            />
          </Property>
          <Property label="Source">
            <p className="text-sm">{job.sourceHost || job.jobUrl || ""}</p>
          </Property>
          <PaperField label="CV" kind="cv" job={job} />
          <PaperField label="Cover letter" kind="letter" job={job} />
        </aside>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-slot="confirm-delete">
          <DialogTitle>Delete {job.title}?</DialogTitle>
          <DialogDescription>This can't be undone.</DialogDescription>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="glow"
              onClick={() =>
                void changeStage("closed").then(() => setDeleteOpen(false))
              }
            >
              Move to Closed
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                // Navigate before refreshing, so the deleted job's own read is
                // not refetched into an error on screen.
                void run("job.delete", { jobId: id }, { refresh: false }).then(
                  () => {
                    const destination = next ?? previous
                    if (destination) {
                      void navigate({
                        to: "/app/apply/$jobId",
                        params: { jobId: destination.id },
                      })
                    } else {
                      void navigate({ to: "/app/apply" })
                    }
                    queryClient.removeQueries({ queryKey: jobGetKey(id) })
                    void refreshQueries(
                      queryClient,
                      commands["job.delete"].invalidates({ jobId: id })
                    )
                  }
                )
              }}
            >
              Delete job
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Posting({ job }: { job: JobDetail }) {
  if (!job.posting) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">About the role</h2>
        <p className="text-sm whitespace-pre-wrap">{job.description}</p>
      </section>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {POSTING.map(([heading, key]) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{heading}</h2>
          <p className="text-sm whitespace-pre-wrap">{job.posting?.[key]}</p>
        </section>
      ))}
    </div>
  )
}

function PaperField({
  label,
  kind,
  job,
}: {
  label: string
  kind: "cv" | "letter"
  job: JobDetail
}) {
  const run = useRunCommand()
  const linked = kind === "cv" ? job.linked.cv : job.linked.letter
  const [docs, setDocs] = useState<PaperListItem[] | null>(null)

  async function openList() {
    const rows = await listPaper(kind)
    setDocs(rows.filter((row) => row.kind === kind))
  }

  return (
    <Property label={label}>
      {linked ? <p className="text-sm">{linked.name}</p> : null}
      <Button type="button" variant="ghost" onClick={() => void openList()}>
        Find in Paper
      </Button>
      {docs ? (
        <div className="flex flex-col gap-1">
          {docs.map((doc) => (
            <Button
              key={doc.id}
              type="button"
              variant="ghost"
              onClick={() =>
                void run("job.linkPaper", {
                  jobId: job.id,
                  docId: parsePaperId(doc.id),
                  kind,
                })
              }
            >
              {doc.name}
            </Button>
          ))}
          {linked ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                void run("job.unlinkPaper", { jobId: job.id, kind })
              }
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
      {kind === "letter" ? (
        <Link to="/app/paper" className="text-sm underline">
          Write a new cover letter
        </Link>
      ) : null}
    </Property>
  )
}
