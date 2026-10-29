import { useEffect, useReducer, useRef } from "react"
import type { JobView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { listJobs } from "@/features/apply/apply-api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { useRunCommand } from "@/lib/contract-client.ts"
import { isAbortError } from "@/lib/sse.ts"
import { useQueryClient } from "@tanstack/react-query"

import {
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
  cvName,
  onCreated,
  onImport,
}: {
  jobs?: JobView[]
  cvName: string | null
  onCreated: (id: string) => void
  onImport: () => void
}) {
  const run = useRunCommand()
  const queryClient = useQueryClient()
  const [{ jobs, query, selected, drafting, text, limit, error }, dispatch] =
    useReducer(letterStartReducer, jobsProp ?? [], initialLetterStart)
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

  async function draft() {
    if (!selected && query.trim() === "") return
    dispatch({ type: "draft_started" })
    textRef.current = ""
    const controller = new AbortController()
    abortRef.current = controller
    try {
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
      const turnText =
        unread || !selected
          ? query.trim()
          : `Draft a cover letter for ${selected.title} at ${selected.company}.`
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
    <div className="flex flex-col gap-3">
      <Input
        aria-label="Search jobs, paste a link or attach a file"
        placeholder="Search jobs, paste a link or attach a file"
        value={query}
        onChange={(event) =>
          dispatch({ type: "query_typed", query: event.target.value })
        }
      />
      {unread ? (
        <p>Can&apos;t read this link. Paste the job text or attach a file.</p>
      ) : null}
      <div className="grid max-h-48 gap-1 overflow-auto">
        {shown.map((job) => (
          <Button
            key={job.id}
            type="button"
            variant={selected?.id === job.id ? "secondary" : "outline"}
            className="h-auto justify-start whitespace-normal"
            aria-pressed={selected?.id === job.id}
            onClick={() => dispatch({ type: "picked_job", job })}
          >
            {job.title}, {job.company}
          </Button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onImport}>
          Attach a file
        </Button>
        <Button type="button" variant="ghost" onClick={() => void startBlank()}>
          Start blank
        </Button>
        {drafting ? (
          <Button type="button" variant="glow" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            variant={limit ? "outline" : "glow"}
            disabled={Boolean(limit)}
            onClick={() => void draft()}
          >
            {draftName}
          </Button>
        )}
      </div>
      {drafting ? (
        <div>
          <p>Coach is writing…</p>
          {cvName ? <p>From {cvName}</p> : null}
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
