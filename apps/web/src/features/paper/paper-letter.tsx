import { useEffect, useRef, useState } from "react"
import { keywordGap, type JobView, type PaperView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { ApiError } from "@/lib/api-error.ts"
import { listJobs } from "@/features/apply/apply-api.ts"
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
import { usePaperAutosave } from "./paper-autosave.ts"
import { PaperEditorConflictBanner } from "./paper-editor-conflict-banner.tsx"
import { PaperLetterArticle } from "./paper-letter-article.tsx"
import { editorEditedLabel } from "./paper-templates.ts"

function unreadableLink(value: string) {
  return /docs\.google\.com|linkedin\.com/i.test(value)
}

function markdownOf(document: unknown) {
  if (!document || typeof document !== "object" || !("markdown" in document))
    return ""
  const markdown = (document as { markdown: unknown }).markdown
  return typeof markdown === "string" ? markdown : ""
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
  const [jobs, setJobs] = useState<JobView[]>(jobsProp ?? [])
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<JobView | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [text, setText] = useState("")
  const [limit, setLimit] = useState<PaperLimitError | null>(null)
  const [error, setError] = useState<string | null>(null)
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
      setJobs(jobsProp)
      return
    }
    void listJobs()
      .then(setJobs)
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load jobs. Refresh the page."
        )
      })
  }, [jobsProp])

  async function draft() {
    if (!selected && query.trim() === "") return
    setLimit(null)
    setError(null)
    setDrafting(true)
    textRef.current = ""
    setText("")
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
          setText(textRef.current)
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
        setLimit(err)
        return
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not draft the letter. Try again."
      )
    } finally {
      setDrafting(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
    if (chatRef.current) void stopPaperChat(chatRef.current)
    setDrafting(false)
  }

  async function startBlank() {
    try {
      const created = await run("paper.create", {
        kind: "letter",
        name: "Cover letter",
      })
      onCreated(created.id)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not start a letter. Try again."
      )
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
        onChange={(event) => setQuery(event.target.value)}
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
            onClick={() => setSelected(job)}
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
          <a href="/app/settings">Upgrade</a>
        </div>
      ) : null}
      {error ? <p>{error}</p> : null}
    </div>
  )
}

export function PaperLetterEditor({
  doc,
  job,
  cvName,
  onBack,
}: {
  doc: PaperView
  job: JobView | null
  cvName: string | null
  onBack: () => void
}) {
  const run = useRunCommand()
  const editorRef = useRef<HTMLDivElement>(null)
  const [markdown, setMarkdown] = useState(markdownOf(doc.document))
  const [updatedAt, setUpdatedAt] = useState(doc.updatedAt)
  const [hiddenGap, setHiddenGap] = useState(false)
  const [conflict, setConflict] = useState(false)
  const { schedule, adopt, versionRef } = usePaperAutosave<string>({
    docId: doc.id,
    initialVersion: doc.contentVersion,
    toDocument: (next) => ({ markdown: next }),
    onSaved: () => {
      setUpdatedAt(new Date().toISOString())
      setConflict(false)
    },
    onConflict: () => setConflict(true),
    onError: (error) => {
      toast(
        error instanceof Error ? error.message : "Could not save. Try again."
      )
    },
  })
  const gap = hiddenGap
    ? null
    : keywordGap(markdown, job?.posting?.requirements ?? "")

  useEffect(() => {
    const node = editorRef.current
    if (!node || document.activeElement === node) return
    if (node.textContent !== markdown) node.textContent = markdown
  }, [markdown])

  async function reloadLetter() {
    try {
      const next = await getPaper(doc.id)
      const text = markdownOf(next.document)
      adopt(next.contentVersion)
      setMarkdown(text)
      const node = editorRef.current
      if (node) node.textContent = text
      setUpdatedAt(next.updatedAt)
      setConflict(false)
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not reload. Refresh the page."
      )
    }
  }

  async function addKeyword() {
    if (!gap) return
    const next = markdown.includes(gap.keyword)
      ? markdown
      : `${markdown}\n${gap.keyword}`
    setMarkdown(next)
    const node = editorRef.current
    if (node) node.textContent = next
    try {
      const saved = await run("paper.replace", {
        docId: doc.id,
        contentVersion: versionRef.current,
        document: { markdown: next },
      })
      versionRef.current = saved.contentVersion
      setUpdatedAt(new Date().toISOString())
      setHiddenGap(true)
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not add that word. Try again."
      )
    }
  }

  return (
    <section
      aria-label={`Editing ${doc.name}`}
      className="flex min-w-0 flex-col gap-4 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="link" onClick={onBack}>
          Paper
        </Button>
        <span className="text-sm text-muted-foreground">Cover letters</span>
        <p className="text-sm text-muted-foreground">
          {editorEditedLabel(updatedAt)}
        </p>
      </div>
      {conflict ? (
        <PaperEditorConflictBanner onReload={() => void reloadLetter()} />
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {cvName ? (
            <p className="mb-2 text-sm text-muted-foreground">From {cvName}</p>
          ) : null}
          <PaperLetterArticle
            doc={doc}
            editorRef={editorRef}
            onInput={() => {
              const next = editorRef.current?.textContent ?? ""
              setMarkdown(next)
              schedule(next)
            }}
          />
        </div>
        {gap ? (
          <aside className="flex w-full flex-col gap-2 rounded-lg border border-border p-4 lg:w-72">
            <p className="text-sm font-medium">Missing keyword</p>
            <p className="text-sm">{gap.sentence}</p>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button
                type="button"
                variant="glow"
                onClick={() => void addKeyword()}
              >
                Add to letter
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setHiddenGap(true)}
              >
                Skip
              </Button>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  )
}
