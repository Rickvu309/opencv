import { useRef, useState } from "react"
import { Paperclip } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"

import { coachCopy } from "./coach-copy.ts"
import { importPaperFile, listJobs, listPaperDocs } from "./coach-api.ts"
import type { CoachAttachment } from "./coach-model.ts"
import { isFullLink } from "./coach-model.ts"

type Doc = { id: string; name: string; updatedAt?: string }
type Job = { id: string; title: string; company: string }

type Props = {
  disabled?: boolean
  onAttach: (attachment: CoachAttachment) => void
  onError: (message: string) => void
}

export function CoachAttachMenu({ disabled, onAttach, onError }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [pasting, setPasting] = useState(false)
  const [link, setLink] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadLists() {
    const [paper, apply] = await Promise.all([
      listPaperDocs().catch(() => []),
      listJobs().catch(() => []),
    ])
    setDocs(paper)
    setJobs(apply)
  }

  const recent = [...docs]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 2)

  function addLink() {
    const value = link.trim()
    if (!isFullLink(value)) {
      onError(coachCopy.pasteFullLink)
      return
    }
    onAttach({ kind: "link", id: value, label: value })
    setLink("")
    setPasting(false)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      await importPaperFile(file)
      onAttach({ kind: "file", id: file.name, label: file.name })
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 404 || status == null) onError(coachCopy.importUnavailable)
      else onError(coachCopy.importUnavailable)
    }
  }

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            setPasting(false)
            void loadLists()
          }
        }}
      >
        <DropdownMenuTrigger
          render={<Button type="button" variant="outline" size="sm" />}
          disabled={disabled}
          aria-label={coachCopy.addContext}
        >
          <Paperclip />
          {coachCopy.addContext}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="max-h-80 w-72 overflow-auto"
        >
          {recent.length > 0 ? (
            <>
              <div className="px-2 py-1 text-xs text-muted-foreground">
                {coachCopy.recent}
              </div>
              {recent.map((doc) => (
                <DropdownMenuItem
                  key={`recent-${doc.id}`}
                  onClick={() =>
                    onAttach({ kind: "paper", id: doc.id, label: doc.name })
                  }
                >
                  {doc.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <div className="px-2 py-1 text-xs text-muted-foreground">
            {coachCopy.addFromPaper}
          </div>
          {docs.map((doc) => (
            <DropdownMenuItem
              key={doc.id}
              onClick={() =>
                onAttach({ kind: "paper", id: doc.id, label: doc.name })
              }
            >
              {doc.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-xs text-muted-foreground">
            {coachCopy.addJob}
          </div>
          {jobs.map((job) => (
            <DropdownMenuItem
              key={job.id}
              aria-label={`${job.title} ${job.company}`}
              onClick={() =>
                onAttach({
                  kind: "job",
                  id: job.id,
                  label: `${job.title} ${job.company}`,
                })
              }
            >
              <span className="flex flex-col">
                <span>{job.title}</span>
                <span className="text-muted-foreground">{` ${job.company}`}</span>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPasting(true)}>
            {coachCopy.pasteLink}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            {coachCopy.upload}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {pasting ? (
        <div className="flex gap-2">
          <Input
            aria-label={coachCopy.pasteLink}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addLink()
              }
            }}
          />
        </div>
      ) : null}
      {/* Documented exception: native file input. Kit Input cannot host a hidden file picker. */}
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        aria-label={coachCopy.upload}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          void onFile(file)
        }}
      />
    </>
  )
}
