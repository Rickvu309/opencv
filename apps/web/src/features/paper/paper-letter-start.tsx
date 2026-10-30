import { Check, FilePlus, Paperclip, Search } from "lucide-react"
import { useEffect, useId, useReducer, useRef } from "react"
import type { JobView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { listJobs } from "@/features/apply/apply-api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { useRunCommand } from "@/lib/contract-client.ts"
import { isAbortError } from "@/lib/sse.ts"
import { useQueryClient } from "@tanstack/react-query"

import {
  extractLetterAttachment,
  getPaper,
  paperGetKey,
  PaperLimitError,
  stopPaperChat,
  streamPaperTurn,
} from "./paper-api.ts"
import {
  initialLetterStart,
  letterStartReducer,
} from "./paper-letter-start.reducer.ts"

import { letterDraftText } from "./paper-letter-context.ts"

function unreadableLink(value: string) {
  return /docs\.google\.com|linkedin\.com/i.test(value)
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
}: {
  jobs?: JobView[]
  onCreated: (id: string) => void
}) {
  const run = useRunCommand()
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
  const needsContext = !selected && !query.trim() && !attached

  const abortRef = useRef<AbortController | null>(null)
  const chatRef = useRef<string | null>(null)
  const textRef = useRef("")
  const unread = unreadableLink(query)
  const shown = unread
    ? jobs
    : jobs.filter((job) => {
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

  useEffect(() => () => attachmentAbort.current?.abort(), [])

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
    if (attaching || needsContext) return
    dispatch({ type: "draft_started" })
    textRef.current = ""
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const turnText = letterDraftText(
        unread || !selected
          ? query.trim()
          : `Draft a cover letter for ${selected.title} at ${selected.company}.`,
        attached
      )
      const created = await run("paper.create", {
        kind: "letter",
        ...(selected
          ? { jobId: selected.id, name: `Cover letter, ${selected.company}` }
          : { name: "Cover letter" }),
      })
      const chat = await run("chat.create", {
        title: selected ? `Cover letter, ${selected.company}` : "Cover letter",
      })
      chatRef.current = chat.id
      let replaced = false
      await streamPaperTurn({
        queryClient,
        chatId: chat.id,
        text: turnText,
        focusDocId: created.id,
        context: selected ? [{ kind: "job", id: selected.id }] : undefined,
        signal: controller.signal,
        onText: (delta) => {
          textRef.current += delta
          dispatch({ type: "draft_text_streamed", text: textRef.current })
        },
        onToolResult: (tool) => {
          if (tool === "paper.replace") {
            replaced = true
            void queryClient.fetchQuery({
              queryKey: paperGetKey(created.id),
              queryFn: () => getPaper(created.id),
              staleTime: 0,
            })
          }
        },
      })
      if (!replaced && textRef.current) {
        await run("paper.replace", {
          docId: created.id,
          contentVersion: created.contentVersion,
          document: { markdown: textRef.current },
        })
      }
      onCreated(created.id)
    } catch (err) {
      if (isAbortError(err)) return
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
      dispatch({ type: "draft_ended" })
    }
  }

  function stop() {
    abortRef.current?.abort()
    if (chatRef.current) void stopPaperChat(chatRef.current)
    dispatch({ type: "draft_ended" })
  }

  async function startBlank() {
    try {
      const created = await run("paper.create", {
        kind: "letter",
        name: "Cover letter",
      })
      onCreated(created.id)
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
    <div data-slot="letter-start-form" className="relative flex flex-col gap-5">
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
        className="flex h-11 items-center gap-2.5 rounded-[12px] border pr-2 pl-3.5 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50"
      >
        <Search aria-hidden="true" className="size-[15px] shrink-0" />
        <Input
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0 md:text-[13px]"
          aria-label="Search jobs, paste a link or attach a file"
          placeholder="Search jobs, paste a link or attach a file"
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
          className="size-7 shrink-0 rounded-[7px]"
          disabled={drafting || attaching}
          onClick={() => attachmentInput.current?.click()}
        >
          <Paperclip aria-hidden="true" className="size-[15px]" />
        </Button>
      </div>
      {unread ? (
        <p>Can&apos;t read this link. Paste the job text or attach a file.</p>
      ) : null}
      <div data-slot="letter-start-jobs-wrap" className="relative -mt-3">
        <div
          data-slot="letter-start-jobs"
          className="grid h-[228px] auto-rows-[40px] content-start gap-0.5 overflow-auto"
        >
          {shown.map((job) => (
            <Button
              key={job.id}
              type="button"
              variant={selected?.id === job.id ? "secondary" : "outline"}
              data-slot="letter-start-job"
              className="h-10 min-w-0 justify-start gap-[5px] rounded-[8px] border-transparent px-3.5 text-[13px] leading-[15.5px] font-medium"
              aria-label={`${job.title}, ${job.company}`}
              aria-pressed={selected?.id === job.id}
              onClick={() => dispatch({ type: "picked_job", job })}
            >
              <span className="truncate">{job.title}</span>
              <span
                data-slot="letter-start-company"
                className="truncate font-normal"
              >
                @{job.company}
              </span>
              {selected?.id === job.id ? (
                <Check
                  aria-hidden="true"
                  className="ml-auto size-3.5 shrink-0"
                />
              ) : null}
            </Button>
          ))}
        </div>
        {shown.length > 5 ? (
          <div
            aria-hidden="true"
            data-slot="letter-start-fade"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
          />
        ) : null}
      </div>
      {attaching ? <p role="status">Reading attachment…</p> : null}
      {attached ? (
        <div className="min-w-0 text-sm">
          <p className="break-words">Context: {attached.name}</p>
          <p>
            Extracted text is used for this draft, up to the first 6,000
            characters.
            {attached.truncated ? " Longer text was shortened." : ""}
          </p>
          <Button
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
          className="mr-auto h-[34px] rounded-[8px] px-3 text-xs font-medium"
          onClick={() => void startBlank()}
        >
          <FilePlus aria-hidden="true" className="size-3.5" />
          Start blank
        </Button>
        {drafting ? (
          <Button type="button" variant="glow" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            className="h-[34px] gap-2 rounded-[8px] px-3.5 text-[13px] font-semibold"
            variant={limit ? "outline" : "glow"}
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
                className="flex size-[18px] items-center justify-center rounded-[4px] text-[11px] font-normal"
              >
                ↵
              </span>
            ) : null}
          </Button>
        )}
      </div>
      {needsContext ? (
        <p
          id={guidanceId}
          className="absolute top-full mt-2 text-xs text-muted-foreground"
        >
          Choose a job, paste job text or a link, or attach a file to draft a
          letter.
        </p>
      ) : null}
      {drafting ? (
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
        <div>
          <p>You&apos;ve reached today&apos;s Free limit.</p>
          <p>{limit.message}</p>
          <a href="/settings">Upgrade</a>
        </div>
      ) : null}
      {error ? <p>{error}</p> : null}
    </div>
  )
}
