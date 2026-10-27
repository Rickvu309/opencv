import { useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { parseJobId, type JobPreview, type JobStage } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
import { toast } from "@workspace/ui/components/sonner"

import { ApiError } from "@/lib/api-error.ts"
import { useRunCommand } from "@/lib/contract-client.ts"

import { previewJob } from "./apply-api.ts"
import { ALL_STAGES, stageLabel } from "./apply-stages.ts"

const COMPANY_REQUIRED = "Add the company name to save this job."
const TITLE_REQUIRED = "Add the role title to save this job."
const UNREADABLE = "Can't read this link. Paste the job text below."

type Draft = {
  url: string
  title: string
  company: string
  location: string
  description: string
  stage: JobStage
  deadline: string
}

const EMPTY: Draft = {
  url: "",
  title: "",
  company: "",
  location: "",
  description: "",
  stage: "saved",
  deadline: "",
}

function asStage(value: string | undefined): JobStage | null {
  if (!value) return null
  return (ALL_STAGES as readonly string[]).includes(value)
    ? (value as JobStage)
    : null
}

export function NewJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const run = useRunCommand()
  const companyRef = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [preview, setPreview] = useState<JobPreview | null>(null)
  const [titleError, setTitleError] = useState("")
  const [companyError, setCompanyError] = useState("")
  const [dateError, setDateError] = useState("")
  const [busy, setBusy] = useState(false)

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  function reset() {
    setDraft(EMPTY)
    setPreview(null)
    setTitleError("")
    setCompanyError("")
    setDateError("")
  }

  async function runPreview(input: { url?: string; text?: string }) {
    const result = await previewJob(input)
    setPreview(result)
    const next: Partial<Draft> = {}
    if (result.status !== "unreadable") {
      if (result.fields.title) next.title = result.fields.title
      if (result.fields.company) next.company = result.fields.company
      if (result.fields.location) next.location = result.fields.location
    }
    if (result.status === "filled" && result.fields.description) {
      next.description = result.fields.description
    }
    if (Object.keys(next).length > 0) patch(next)
    if (result.status === "company-missing") {
      setCompanyError(COMPANY_REQUIRED)
      companyRef.current?.focus()
    } else {
      setCompanyError("")
    }
    return result
  }

  async function onPaste() {
    await runPreview({ url: linkRef.current?.value ?? draft.url })
  }

  function duplicateJob() {
    return preview?.status === "duplicate" ? preview : null
  }

  async function save(anyway = false) {
    const title = draft.title.trim()
    const company = draft.company.trim()
    if (!title) {
      setTitleError(TITLE_REQUIRED)
      return
    }
    setTitleError("")
    if (!company) {
      setCompanyError(COMPANY_REQUIRED)
      companyRef.current?.focus()
      return
    }
    setCompanyError("")
    if (draft.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(draft.deadline)) {
      setDateError("Use a real date.")
      return
    }
    setDateError("")
    setBusy(true)
    try {
      const created = await run("job.create", {
        title,
        company,
        stage: draft.stage,
        ...(draft.description ? { description: draft.description } : {}),
        ...(draft.location ? { location: draft.location } : {}),
        ...(draft.url ? { jobUrl: draft.url } : {}),
        ...(draft.deadline ? { deadline: draft.deadline } : {}),
        ...(anyway ? { anyway: true } : {}),
      })
      if (created.stage === "saved") toast("Job added to Saved")
      reset()
      onOpenChange(false)
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "DUPLICATE_JOB" &&
        error.jobId
      ) {
        setPreview({
          status: "duplicate",
          jobId: parseJobId(error.jobId),
          stage: asStage(error.stage) ?? "saved",
          fields: { title, company, location: draft.location },
        })
      } else if (
        error instanceof ApiError &&
        error.code === "COMPANY_REQUIRED"
      ) {
        setCompanyError(COMPANY_REQUIRED)
        companyRef.current?.focus()
      }
    } finally {
      setBusy(false)
    }
  }

  const duplicate = duplicateJob()
  const addDisabled =
    busy || draft.company.trim() === "" || draft.title.trim() === ""
  const stageName = stageLabel(draft.stage)
  const duplicateStageName = stageLabel(duplicate?.stage ?? "saved")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent
        data-slot="new-job-dialog"
        className="max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none sm:max-w-md"
        aria-describedby={undefined}
      >
        <DialogTitle>New job</DialogTitle>
        <DialogDescription className="sr-only">
          Paste the job link
        </DialogDescription>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void save(duplicate != null)
          }}
        >
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor="job-link">Paste the job link</Label>
              <Input
                id="job-link"
                ref={linkRef}
                value={draft.url}
                onChange={(event) => patch({ url: event.target.value })}
                onBlur={(event) => {
                  const url = event.currentTarget.value.trim()
                  if (url) void runPreview({ url })
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              className="mt-5"
              onClick={() => void onPaste()}
            >
              Paste
            </Button>
          </div>
          {preview?.status === "filled" ? <p>Filled</p> : null}
          {preview?.status === "unreadable" ? (
            <p>{preview.message || UNREADABLE}</p>
          ) : null}
          {duplicate ? (
            <div>
              <p>Already on your board</p>
              <p>
                {duplicate.fields.title} at {duplicate.fields.company}, in{" "}
                {duplicateStageName}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onOpenChange(false)
                  void navigate({
                    to: "/app/apply/$jobId",
                    params: { jobId: duplicate.jobId },
                  })
                }}
              >
                Open
              </Button>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <Label htmlFor="job-title">Role title</Label>
            <Input
              id="job-title"
              value={draft.title}
              aria-invalid={titleError ? true : undefined}
              onChange={(event) => patch({ title: event.target.value })}
            />
            {titleError ? <p>{titleError}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="job-company">Company</Label>
            <Input
              id="job-company"
              ref={companyRef}
              value={draft.company}
              aria-invalid={companyError ? true : undefined}
              aria-describedby={companyError ? "job-company-error" : undefined}
              onChange={(event) => {
                patch({ company: event.target.value })
                if (event.target.value.trim()) setCompanyError("")
              }}
            />
            {companyError ? <p id="job-company-error">{companyError}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <Textarea
              id="job-description"
              aria-label="Add the job description"
              value={draft.description}
              placeholder="Add the job description…"
              onChange={(event) => patch({ description: event.target.value })}
              onBlur={() => {
                if (
                  preview?.status === "unreadable" &&
                  draft.description.trim()
                ) {
                  void runPreview({ text: draft.description })
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label id="job-stage-label">Stage</Label>
            <Select
              value={draft.stage}
              onValueChange={(value) => {
                if (value) patch({ stage: value as JobStage })
              }}
            >
              <SelectTrigger aria-labelledby="job-stage-label">
                <SelectValue>{stageName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ALL_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stageLabel(stage)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="job-deadline">Deadline</Label>
            <Input
              id="job-deadline"
              type="date"
              value={draft.deadline}
              aria-invalid={dateError ? true : undefined}
              onChange={(event) => patch({ deadline: event.target.value })}
            />
            {dateError ? <p>{dateError}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="glow" disabled={addDisabled}>
              {duplicate ? "Add anyway" : "Add job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
