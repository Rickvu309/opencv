import { Check, FilePlus, Link2Off, Paperclip, Search } from "lucide-react"
import {
  useEffect,
  useId,
  useReducer,
  useRef,
  type MutableRefObject,
} from "react"
import { type JobView } from "@workspace/domain/apply"
import { WORD_LIMITS } from "@workspace/domain/paper-doc"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"

import { listJobs } from "@/features/apply/apply-api.ts"
import { startChat } from "@/features/coach/chat-api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { isAbortError } from "@/lib/sse.ts"
import { useQueryClient } from "@tanstack/react-query"

import {
  extractLetterAttachment,
  followPaperTurn,
  PaperLimitError,
  stopPaperChat,
  streamPaperTurn,
} from "./paper-api.ts"
import {
  initialLetterStart,
  letterStartReducer,
} from "./paper-letter-start.reducer.ts"

import { openBlankPage } from "./paper-new-dialog.tsx"
import { letterDraftText } from "./paper-letter-context.ts"
import {
  clearStoppedLetter,
  rememberStoppedLetter,
} from "./paper-letter-resume.ts"

const LETTER_LINE = 2000

export const EMAIL_PLACEHOLDER = "[Your email]"

export function letterLines(text: string, email?: string): string[] {
  const lines: string[] = []
  const filled = email ? text.split(EMAIL_PLACEHOLDER).join(email) : text
  for (const paragraph of filled.split(/\n\s*\n+/)) {
    const line = paragraph.replace(/\s*\n\s*/g, " ").trim()
    for (let index = 0; index < line.length; index += LETTER_LINE)
      lines.push(line.slice(index, index + LETTER_LINE))
  }
  return lines
}

type DraftOperation = {
  controller: AbortController
  chatId: string | null
  text: string
  stopped: boolean
}

function unreadableLink(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .every((token) => {
      const link = token.replace(/^<|>$/g, "")
      try {
        const { hostname } = new URL(
          /^https?:\/\//i.test(link) ? link : `https://${link}`
        )
        return ["linkedin.com", "lnkd.in", "docs.google.com"].some(
          (host) => hostname === host || hostname.endsWith(`.${host}`)
        )
      } catch {
        return false
      }
    })
}

function resetClock(iso: string | null) {
  if (!iso) return "later"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "later"
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function PaperLetterStart({
  jobs: jobsProp,
  onCreated,
  onDraftingStart,
  onDraftText,
  onDraftContinues,
  onDraftWaiting,
  onDraftingEnd,
  stopRef,
}: {
  jobs?: JobView[]
  onCreated: (id: string) => void
  onDraftingStart?: (draftName: string, attribution: string | null) => void
  onDraftText?: (text: string) => void
  onDraftContinues?: () => void
  onDraftWaiting?: (chatId: string | null) => void
  onDraftingEnd?: () => void
  stopRef?: MutableRefObject<(() => void) | null>
}) {
  const signedInEmail = authClient.useSession().data?.user.email
  const guidanceId = useId()
  const queryClient = useQueryClient()
  const [
    { jobs, query, selected, drafting, text, limit, error, attachment },
    dispatch,
  ] = useReducer(letterStartReducer, jobsProp ?? [], initialLetterStart)
  const attachmentInput = useRef<HTMLInputElement>(null)
  const attachmentAbort = useRef<AbortController | null>(null)
  const attached = attachment.status === "ready" ? attachment.context : null
  const attaching = attachment.status === "loading"
  const unread = unreadableLink(query)
  const needsContext = !selected && (!query.trim() || unread) && !attached

  const activeDraft = useRef<DraftOperation | null>(null)
  const shown = jobs.filter((job) => {
    const hay = `${job.title} ${job.company}`.toLowerCase()
    const needle = query.trim().toLowerCase()
    return needle === "" || hay.includes(needle)
  })

  useEffect(() => {
    if (jobsProp) {
      dispatch({ type: "jobs_loaded", jobs: jobsProp })
      return
    }
    void listJobs()
      .then((loaded) => dispatch({ type: "jobs_loaded", jobs: loaded }))
      .catch((err: unknown) => {
        dispatch({
          type: "jobs_failed",
          message:
            err instanceof Error
              ? err.message
              : "Could not load jobs. Refresh the page.",
        })
      })
  }, [jobsProp])

  useEffect(
    () => () => {
      attachmentAbort.current?.abort()
      const draft = activeDraft.current
      activeDraft.current = null
      draft?.controller.abort()
      if (draft?.chatId) void stopPaperChat(queryClient, draft.chatId)
    },
    [queryClient]
  )

  async function attach(file: File) {
    attachmentAbort.current?.abort()
    const controller = new AbortController()
    attachmentAbort.current = controller
    dispatch({ type: "attachment_started" })
    try {
      const context = await extractLetterAttachment(file, controller.signal)
      if (!controller.signal.aborted)
        dispatch({ type: "attachment_loaded", context })
    } catch (err) {
      if (!controller.signal.aborted)
        dispatch({
          type: "attachment_failed",
          message:
            err instanceof ApiError
              ? err.message
              : "Could not read that file. Try again.",
        })
    }
  }

  async function draft() {
    if (attaching || needsContext || activeDraft.current) return
    const operation: DraftOperation = {
      controller: new AbortController(),
      chatId: null,
      text: "",
      stopped: false,
    }
    activeDraft.current = operation
    dispatch({ type: "draft_started" })
    const draftName = selected
      ? `Cover letter, ${selected.company}`
      : "Cover letter"
    const attribution = attached ? `From ${attached.name}` : null
    onDraftingStart?.(draftName, attribution)
    if (stopRef) stopRef.current = stop
    const { controller } = operation
    try {
      const turnText = letterDraftText(
        unread || !selected
          ? query.trim()
          : `Draft a cover letter for ${selected.title} at ${selected.company}. Reply with the letter text only; it opens as a Word page when you finish.`,
        attached
      )
      const chat = await startChat(queryClient, draftName)
      operation.chatId = chat.id
      if (activeDraft.current !== operation) {
        void stopPaperChat(queryClient, chat.id)
        return
      }
      try {
        if (controller.signal.aborted)
          throw new DOMException("Stopped", "AbortError")
        const showText = (text: string) => {
          if (activeDraft.current !== operation || controller.signal.aborted)
            return
          operation.text = text
          dispatch({ type: "draft_text_streamed", text })
          onDraftText?.(text)
        }
        const showWaiting = (waiting: boolean) => {
          if (activeDraft.current === operation)
            onDraftWaiting?.(waiting ? chat.id : null)
        }
        const end = await streamPaperTurn({
          queryClient,
          chatId: chat.id,
          text: turnText,
          context: selected ? [{ kind: "job", id: selected.id }] : undefined,
          textOnly: true,
          signal: controller.signal,
          onText: (delta) => showText(operation.text + delta),
          onWaiting: () => showWaiting(true),
        })
        if (end === "continuing" && activeDraft.current === operation) {
          onDraftContinues?.()
          showText(
            await followPaperTurn({
              queryClient,
              chatId: chat.id,
              signal: controller.signal,
              onText: showText,
              onWaiting: showWaiting,
            })
          )
        }
      } catch (err) {
        if (!operation.stopped || !controller.signal.aborted) throw err
      }
      if (activeDraft.current !== operation) return
      const lines = letterLines(operation.text, signedInEmail)
      if (lines.length > WORD_LIMITS.maxOpsPerApply)
        throw new Error(
          "This letter is too long to save. Shorten it and try again."
        )
      const created = await catalogClient.run(queryClient, "paper.canvas", {
        op: "mint",
        label: "letter",
        name: draftName,
        ...(selected ? { jobId: selected.id } : {}),
        ...(lines.length > 0 ? { lines } : {}),
      })
      if ("pending" in created)
        throw new Error("Could not start this letter. Try again.")
      if (activeDraft.current === operation) {
        if (operation.stopped && lines.length === 0) {
          rememberStoppedLetter({
            chatId: chat.id,
            docId: created.docId,
            prompt: turnText,
            jobId: selected?.id ?? null,
          })
        } else {
          clearStoppedLetter(created.docId)
        }
        onCreated(created.docId)
      }
    } catch (err) {
      if (activeDraft.current !== operation || isAbortError(err)) return
      if (err instanceof PaperLimitError) {
        dispatch({ type: "draft_limited", limit: err })
        return
      }
      dispatch({
        type: "draft_failed",
        message:
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not draft the letter. Try again.",
      })
    } finally {
      if (activeDraft.current === operation) {
        activeDraft.current = null
        if (stopRef) stopRef.current = null
        dispatch({ type: "draft_ended" })
        onDraftingEnd?.()
      }
    }
  }

  function stop() {
    const operation = activeDraft.current
    if (!operation || operation.stopped) return
    operation.stopped = true
    operation.controller.abort()
    if (operation.chatId) void stopPaperChat(queryClient, operation.chatId)
  }

  async function startBlank() {
    try {
      onCreated(await openBlankPage(queryClient, "letter"))
    } catch (err) {
      dispatch({
        type: "blank_failed",
        message:
          err instanceof ApiError
            ? err.message
            : "Could not start a letter. Try again.",
      })
    }
  }

  const draftName = limit
    ? `Coach is back at ${resetClock(limit.resetsAt)}`
    : "Draft letter"

  return (
    <div data-slot="letter-start-form" className="flex min-w-0 flex-col gap-3">
      <Input
        ref={attachmentInput}
        type="file"
        className="hidden"
        aria-label="Attach letter context"
        accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (file) void attach(file)
        }}
      />
      <div
        data-slot="letter-start-search"
        className="flex min-h-11 items-center gap-2 rounded-lg border bg-background pl-3 text-muted-foreground has-[input:focus-visible]:border-muted-foreground/50"
      >
        <Search aria-hidden="true" className="size-[15px] shrink-0" />
        <Input
          className="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-foreground shadow-none focus-visible:ring-0 md:text-[0.8125rem]"
          aria-label="Search jobs, paste a link or attach a file"
          placeholder="Search or paste a link"
          value={query}
          onChange={(event) =>
            dispatch({ type: "query_typed", query: event.target.value })
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              !drafting &&
              !attaching &&
              !needsContext &&
              !limit
            ) {
              event.preventDefault()
              void draft()
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach a file"
          className="size-11 shrink-0 rounded-lg md:[@media(pointer:fine)]:size-9"
          disabled={drafting || attaching}
          onClick={() => attachmentInput.current?.click()}
        >
          <Paperclip aria-hidden="true" className="size-[15px]" />
        </Button>
      </div>
      {unread && !attached ? (
        <Empty
          data-slot="letter-unreadable-link"
          role="status"
          id={guidanceId}
          className="gap-2 rounded-lg bg-muted/50 px-4 py-5 text-sm"
        >
          <EmptyMedia className="mb-0">
            <Link2Off
              aria-hidden="true"
              data-slot="letter-unreadable-icon"
              className="size-[18px] shrink-0"
            />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-medium tracking-normal">
            Can't read this link
          </EmptyTitle>
          <EmptyDescription
            data-slot="letter-unreadable-help"
            className="text-sm"
          >
            Paste the job text or attach a file.
          </EmptyDescription>
        </Empty>
      ) : shown.length > 0 ? (
        <div
          data-slot="letter-start-jobs"
          className="grid max-h-56 gap-0.5 overflow-auto rounded-lg bg-secondary/50 p-1"
        >
          {shown.map((job) => (
            <Button
              key={job.id}
              type="button"
              variant="ghost"
              data-slot="letter-start-job"
              className="min-h-11 w-full min-w-0 justify-start gap-2 rounded-md px-2.5 text-sm md:[@media(pointer:fine)]:min-h-10"
              aria-label={`${job.title}, ${job.company}`}
              aria-pressed={selected?.id === job.id}
              onClick={() => dispatch({ type: "picked_job", job })}
            >
              <span data-slot="letter-start-job-labels">
                <span>{job.title}</span>
                <span
                  data-slot="letter-start-company"
                  className="font-normal text-muted-foreground"
                >
                  {job.company}
                </span>
              </span>
              {selected?.id === job.id ? (
                <Check aria-hidden="true" className="ml-auto size-4 shrink-0" />
              ) : null}
            </Button>
          ))}
        </div>
      ) : null}
      {attaching ? (
        <p role="status" className="text-sm text-muted-foreground">
          Reading attachment…
        </p>
      ) : null}
      {attached ? (
        <div className="min-w-0 text-sm">
          <p className="break-words">Context: {attached.name}</p>
          <p>
            Extracted text is used for this draft, up to the first 6,000
            characters.
            {attached.truncated ? " Longer text was shortened." : ""}
          </p>
          <Button
            size="touch"
            type="button"
            variant="ghost"
            disabled={drafting}
            onClick={() => dispatch({ type: "attachment_removed" })}
          >
            Remove attachment
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          data-slot="letter-start-blank"
          className="mr-auto min-h-11 rounded-lg px-3 text-sm md:[@media(pointer:fine)]:min-h-9"
          onClick={() => void startBlank()}
        >
          <FilePlus aria-hidden="true" className="size-3.5" />
          Start blank
        </Button>
        {drafting ? (
          onDraftingStart ? null : (
            <Button size="touch" type="button" onClick={stop}>
              Stop
            </Button>
          )
        ) : (
          <Button
            type="button"
            data-slot="letter-start-draft"
            className="min-h-11 gap-2 rounded-lg px-3 text-sm md:[@media(pointer:fine)]:min-h-9"
            variant={limit ? "outline" : "primary"}
            disabled={Boolean(limit) || attaching || needsContext}
            aria-label={draftName}
            aria-describedby={needsContext ? guidanceId : undefined}
            onClick={() => void draft()}
          >
            {draftName}
            {!limit ? (
              <span
                aria-hidden="true"
                data-slot="letter-start-return"
                className="flex size-[18px] items-center justify-center rounded-[4px] text-[0.6875rem] font-normal"
              >
                ↵
              </span>
            ) : null}
          </Button>
        )}
      </div>
      {needsContext && !unread ? (
        <p id={guidanceId} className="text-xs leading-5 text-muted-foreground">
          Choose a job, paste job text or a link, or attach a file to draft a
          letter.
        </p>
      ) : null}
      {drafting && !onDraftingStart ? (
        <div>
          <p>Coach is writing…</p>
          <p>
            {text}
            <span
              aria-hidden="true"
              className="ml-px inline-block h-4 w-px bg-foreground motion-safe:animate-pulse"
            />
          </p>
        </div>
      ) : null}
      {limit ? (
        <div
          role="status"
          className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          <p>You&apos;ve reached today&apos;s Free limit.</p>
          <p>{limit.message}</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
