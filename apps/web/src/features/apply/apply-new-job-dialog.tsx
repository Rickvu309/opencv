import { useReducer, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { parseJobId, type JobStage } from "@workspace/domain"
import {
  ChevronRight,
  ClipboardPaste,
  Kanban,
  Link as LinkIcon,
  X,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Kbd } from "@workspace/ui/components/kbd"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/sonner"

import { ApiError } from "@/lib/api-error.ts"
import { useRunCommand } from "@/lib/contract-client.ts"

import { previewJob, useApplyCards } from "./apply-api.ts"
import { ALL_STAGES } from "./apply-stages.ts"
import {
  AlreadyTracked,
  Hint,
  PLACEHOLDER_CARD,
  PLACEHOLDER_SECONDARY,
} from "./apply-new-job-parts.tsx"
import {
  DIALOG_START,
  dialogReducer,
  type Draft,
} from "./apply-new-job-dialog.reducer.ts"
import { NewJobProperties } from "./apply-new-job-properties.tsx"

const UNREADABLE = "Can't read this link. Paste the job text below."

function asStage(value: string | undefined): JobStage | null {
  if (!value) return null
  return (ALL_STAGES as readonly string[]).includes(value)
    ? (value as JobStage)
    : null
}

function fullUrl(value: string) {
  const url = value.trim()
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function shownUrl(value: string) {
  return value.replace(/^https:\/\//i, "")
}

const INLINE_FIELD =
  "h-auto rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0 dark:bg-transparent"

export function NewJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const run = useRunCommand()
  const { cards } = useApplyCards()
  const titleRef = useRef<HTMLInputElement>(null)
  const companyRef = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const [
    { draft, preview, titleError, companyError, dateError, busy },
    dispatch,
  ] = useReducer(dialogReducer, DIALOG_START)

  function patch(fields: Partial<Draft>) {
    dispatch({ type: "fields_edited", fields })
  }

  function reset() {
    dispatch({ type: "closed" })
  }

  async function runPreview(input: { url?: string; text?: string }) {
    const result = await previewJob(input)
    const next: Partial<Draft> = {}
    if (result.status !== "unreadable") {
      if (result.fields.title) next.title = result.fields.title
      if (result.fields.company) next.company = result.fields.company
      if (result.fields.location) next.location = result.fields.location
    }
    if (result.status === "filled" && result.fields.description) {
      next.description = result.fields.description
    }
    dispatch({ type: "preview_read", preview: result, fields: next })
    if (result.status === "company-missing") companyRef.current?.focus()
    return result
  }

  async function onPaste() {
    const url = await navigator.clipboard
      .readText()
      .then((text) => text.trim())
      .catch(() => null)
    if (url === null) {
      linkRef.current?.focus()
      return
    }
    if (!url) return
    patch({ url: shownUrl(url) })
    await runPreview({ url: fullUrl(url) })
  }

  function duplicateJob() {
    return preview?.status === "duplicate" ? preview : null
  }

  async function save(anyway = false) {
    const title = draft.title.trim()
    const company = draft.company.trim()
    dispatch({
      type: "save_checked",
      titleMissing: !title,
      companyMissing: !company,
    })
    if (!title || !company) {
      ;(title ? companyRef : titleRef).current?.focus()
      return
    }
    if (draft.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(draft.deadline)) {
      dispatch({ type: "date_rejected" })
      return
    }
    dispatch({ type: "save_started" })
    try {
      const created = await run("job.create", {
        title,
        company,
        stage: draft.stage,
        ...(draft.description ? { description: draft.description } : {}),
        ...(draft.location ? { location: draft.location } : {}),
        ...(draft.url.trim() ? { jobUrl: fullUrl(draft.url) } : {}),
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
        dispatch({
          type: "duplicate_found",
          preview: {
            status: "duplicate",
            jobId: parseJobId(error.jobId),
            stage: asStage(error.stage) ?? "saved",
            fields: { title, company, location: draft.location },
          },
        })
      } else if (
        error instanceof ApiError &&
        error.code === "COMPANY_REQUIRED"
      ) {
        dispatch({ type: "company_required" })
        companyRef.current?.focus()
      }
    } finally {
      dispatch({ type: "save_ended" })
    }
  }

  const duplicate = duplicateJob()
  const onBoard = duplicate
    ? cards.find((card) => card.id === duplicate.jobId)
    : undefined

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
        showCloseButton={false}
        initialFocus={linkRef}
        overlayClassName="bg-foreground/18 supports-backdrop-filter:backdrop-blur-none"
        className="gap-0 bg-card p-0 shadow-lg ring-foreground/6 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:overflow-y-auto max-md:rounded-none sm:max-w-[620px] md:top-[140px] md:left-[calc(50%+122px)] md:translate-y-0"
        aria-describedby={undefined}
      >
        <DialogDescription className="sr-only">
          Paste the job link
        </DialogDescription>
        <form
          className="flex flex-col pt-3 pr-3.5 pb-3.5 pl-5"
          onSubmit={(event) => {
            event.preventDefault()
            void save(duplicate != null)
          }}
        >
          <div className="flex h-7 items-center gap-1.5 text-xs text-muted-foreground">
            <Kanban className="size-[13px]" aria-hidden />
            <span className="font-medium">Apply</span>
            <ChevronRight className="size-3" aria-hidden />
            <DialogTitle className="text-xs leading-normal font-normal text-muted-foreground">
              New job
            </DialogTitle>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto rounded-md text-muted-foreground"
                />
              }
            >
              <X className="size-7 p-1.5" aria-hidden />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
          <div className="mt-3.5 flex h-10 items-center gap-2 rounded-[11px] bg-secondary pr-[5px] pl-3 focus-within:ring-3 focus-within:ring-ring/50">
            <LinkIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={linkRef}
              aria-label="Paste the job link"
              placeholder="Paste the job link"
              value={draft.url}
              className={`${INLINE_FIELD} h-full flex-1 text-[13px] text-foreground md:text-[13px] ${PLACEHOLDER_SECONDARY}`}
              onChange={(event) => patch({ url: event.target.value })}
              onBlur={(event) => {
                const url = event.currentTarget.value.trim()
                if (!url) return
                patch({ url: shownUrl(url) })
                void runPreview({ url: fullUrl(url) })
              }}
            />
            {duplicate ? null : draft.url ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Clear link"
                className="size-6 rounded-md text-muted-foreground"
                onClick={() => {
                  dispatch({ type: "link_cleared" })
                  linkRef.current?.focus()
                }}
              >
                <X className="size-6 p-[5.5px]" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-[30px] gap-1.5 rounded-md px-2.5 text-xs shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-foreground/6"
                onClick={() => void onPaste()}
              >
                <ClipboardPaste
                  className="size-[13px] text-muted-foreground"
                  aria-hidden
                />
                Paste
              </Button>
            )}
          </div>
          {preview?.status === "filled" ? (
            <p role="status" className="sr-only">
              Filled
            </p>
          ) : null}
          {preview?.status === "unreadable" ? (
            <Hint>{preview.message || UNREADABLE}</Hint>
          ) : null}
          {duplicate ? (
            <div className="mt-5">
              <AlreadyTracked
                title={onBoard?.title ?? duplicate.fields.title}
                company={onBoard?.company ?? duplicate.fields.company}
                stage={onBoard?.stage ?? duplicate.stage}
                onOpen={() => {
                  onOpenChange(false)
                  void navigate({
                    to: "/apply/$jobId",
                    params: { jobId: duplicate.jobId },
                  })
                }}
              />
            </div>
          ) : (
            <>
              <Input
                ref={titleRef}
                aria-label="Role title"
                placeholder="Role title"
                value={draft.title}
                aria-invalid={titleError ? true : undefined}
                className={`${INLINE_FIELD} mt-5 text-xl leading-6 font-semibold tracking-[-0.3px] text-foreground md:text-xl ${PLACEHOLDER_CARD}`}
                onChange={(event) => {
                  dispatch({ type: "title_typed", value: event.target.value })
                }}
              />
              {titleError ? <Hint>{titleError}</Hint> : null}
              <Input
                ref={companyRef}
                aria-label="Company"
                placeholder="Company"
                value={draft.company}
                aria-invalid={companyError ? true : undefined}
                aria-describedby={
                  companyError ? "job-company-error" : undefined
                }
                className={`${INLINE_FIELD} mt-1.5 text-[15px] leading-[18px] text-muted-foreground md:text-[15px] ${PLACEHOLDER_CARD}`}
                onChange={(event) => {
                  dispatch({ type: "company_typed", value: event.target.value })
                }}
              />
              {companyError ? (
                <Hint id="job-company-error">{companyError}</Hint>
              ) : null}
              <Textarea
                aria-label="Add the job description"
                placeholder="Add the job description…"
                value={draft.description}
                className={`mt-4 field-sizing-fixed h-[120px] resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-[1.55] text-muted-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent ${PLACEHOLDER_CARD}`}
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
              <div className="mt-2">
                <NewJobProperties
                  stage={draft.stage}
                  deadline={draft.deadline}
                  location={draft.location}
                  dateError={dateError !== ""}
                  onStage={(stage) => patch({ stage })}
                  onDeadline={(deadline) => patch({ deadline })}
                  onLocation={(location) => patch({ location })}
                />
                {dateError ? <Hint>{dateError}</Hint> : null}
              </div>
            </>
          )}
          <div className="mt-3.5 h-px bg-border" />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-[30px] rounded-md px-3 text-[13px] font-normal text-muted-foreground"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            {duplicate ? (
              <Button
                type="submit"
                disabled={busy}
                className="h-[30px] rounded-md px-3 text-[13px] font-semibold"
              >
                Add anyway
              </Button>
            ) : (
              <Button
                type="submit"
                variant="glow"
                disabled={busy}
                aria-label="Add job"
                className="h-[30px] gap-2 rounded-md pr-2 pl-3 text-[13px] font-semibold"
              >
                <span>Add job</span>
                <Kbd className="h-[18px] min-w-0 rounded-[4px] bg-foreground/6 px-[5px] text-[11px] font-normal text-foreground/63">
                  ↵
                </Kbd>
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
