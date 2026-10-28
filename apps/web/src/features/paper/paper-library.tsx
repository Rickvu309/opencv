import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  paperDocNameSchema,
  type JobView,
  type PaperFile,
  type PaperView,
} from "@workspace/domain"
import { toast, toastWithUndo } from "@workspace/ui/components/sonner"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"

import { ApiError } from "@/lib/api-error.ts"
import {
  undoActivity,
  refreshQueries,
  useRunCommand,
} from "@/lib/contract-client.ts"
import { listJobs } from "@/features/apply/apply-api.ts"

import { importPaperFile, latestActivityId } from "./paper-api.ts"
import { PaperNewDialog } from "./paper-new-dialog.tsx"
import { PAPER_GALLERY_DIALOG_CLASS } from "./paper-template-gallery.tsx"
import { PaperLetterStart } from "./paper-letter.tsx"
import { PaperImportInput } from "./paper-cv-surface.tsx"
import { NewPaperCard, PaperCard, SectionHead } from "./paper-parts.tsx"
import { paperEditedLabel } from "./paper-templates.ts"
import { endpoints, fetchBinary } from "@/lib/requests.ts"

const IMPORT_ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"

type Mode =
  | { type: "new"; step: "kind" | "gallery" }
  | { type: "letter" }
  | { type: "rename"; doc: PaperView }
  | { type: "delete"; doc: PaperView }
  | { type: "link"; doc: PaperView }
  | { type: "delete-file"; file: PaperFile }
  | null

function messageOf(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function PaperLibrary({
  docs,
  files,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  docs: PaperView[]
  files: PaperFile[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onOpen: (id: string) => void
}) {
  const run = useRunCommand()
  const queryClient = useQueryClient()
  const importRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<Mode>(null)
  const [rename, setRename] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobView[]>([])
  const [jobsError, setJobsError] = useState<string | null>(null)
  const dialogOpen = mode !== null
  const needle = query.trim().toLowerCase()
  const documents = docs.filter(
    (doc) => doc.kind === "cv" || doc.kind === "letter"
  )
  const visible = documents.filter(
    (doc) => needle === "" || doc.name.toLowerCase().includes(needle)
  )
  const cvs = visible.filter((doc) => doc.kind === "cv")
  const letters = visible.filter((doc) => doc.kind === "letter")
  const visibleFiles = files.filter(
    (file) => needle === "" || file.name.toLowerCase().includes(needle)
  )
  const noResults = needle !== "" && visible.length === 0
  const firstRun = !loading && !error && documents.length === 0 && needle === ""

  async function rememberUndo(subjectId: string, label: string) {
    try {
      const activityId = await latestActivityId(subjectId)
      if (!activityId) {
        toast(label)
        return
      }
      toastWithUndo(label, () => void undoActivity(queryClient, activityId))
    } catch {
      toast(label)
    }
  }

  async function onImport(file: File) {
    try {
      const created = await importPaperFile(file)
      void refreshQueries(queryClient, [
        { query: "paper.list" },
        { query: "paper.files" },
      ])
      setMode(null)
      onOpen(created.id)
    } catch (err) {
      toast(
        messageOf(
          err,
          "Could not import that file. Try a PDF, DOCX, or plain text file."
        )
      )
    }
  }

  function chooseFile() {
    importRef.current?.click()
  }

  async function openLink(doc: PaperView) {
    setMode({ type: "link", doc })
    setJobsError(null)
    try {
      setJobs(await listJobs())
    } catch (err) {
      setJobsError(messageOf(err, "Could not load jobs. Refresh the page."))
    }
  }

  async function confirmRename() {
    if (!mode || mode.type !== "rename") return
    const parsed = paperDocNameSchema.safeParse(rename.trim())
    if (!parsed.success) {
      setRenameError(parsed.error.issues[0]?.message ?? "Name is required")
      return
    }
    try {
      await run("paper.rename", { docId: mode.doc.id, name: parsed.data })
      setMode(null)
    } catch (err) {
      setRenameError(messageOf(err, "Could not rename. Try again."))
    }
  }

  async function confirmDelete() {
    if (!mode || mode.type !== "delete") return
    const name = mode.doc.name
    try {
      await run("paper.delete", { docId: mode.doc.id })
      toast(`Deleted ${name}`)
      setMode(null)
    } catch (err) {
      toast(messageOf(err, "Could not delete. Try again."))
    }
  }

  async function confirmDeleteFile() {
    if (!mode || mode.type !== "delete-file") return
    try {
      await run("paper.deleteFile", { fileId: mode.file.id })
      toast(`Deleted ${mode.file.name}`)
      setMode(null)
    } catch (err) {
      toast(messageOf(err, "Could not delete that file. Try again."))
    }
  }

  async function duplicate(doc: PaperView) {
    try {
      const copy = await run("paper.duplicate", { docId: doc.id })
      await rememberUndo(copy.id, `Duplicated ${doc.name}`)
    } catch (err) {
      toast(messageOf(err, "Could not duplicate. Try again."))
    }
  }

  async function download(doc: PaperView) {
    try {
      const res = await fetchBinary(endpoints.paperPdf(doc.id), {
        credentials: "include",
      })
      if (!res.ok) {
        toast("Could not download the PDF. Try again.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${doc.name}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      toast("Could not download the PDF. Try again.")
    }
  }

  function renderCard(doc: PaperView) {
    return (
      <PaperCard
        key={doc.id}
        name={doc.name}
        edited={paperEditedLabel(doc.updatedAt)}
        templateId={doc.templateId ?? "simple"}
        onOpen={() => onOpen(doc.id)}
        onRename={() => {
          setRename(doc.name)
          setRenameError(null)
          setMode({ type: "rename", doc })
        }}
        onDuplicate={() => void duplicate(doc)}
        onLink={() => void openLink(doc)}
        onDownload={() => void download(doc)}
        onDelete={() => setMode({ type: "delete", doc })}
      />
    )
  }

  return (
    <section
      aria-label="Paper"
      className="flex min-w-0 flex-col gap-6 p-4 sm:p-6"
    >
      <PaperImportInput
        inputRef={importRef}
        accept={IMPORT_ACCEPT}
        onFile={(file) => void onImport(file)}
      />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Paper</h1>
        <Button
          type="button"
          variant={dialogOpen ? "outline" : "glow"}
          onClick={() => setMode({ type: "new", step: "kind" })}
        >
          New
        </Button>
      </div>
      <Input
        aria-label="Search Paper"
        placeholder="Search Paper"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {loading ? <p>Loading documents</p> : null}
      {error ? (
        <div className="flex flex-col items-start gap-3">
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={onRetry}>
            Refresh
          </Button>
        </div>
      ) : null}
      {firstRun ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-medium">Start a document</h2>
            <p className="text-sm text-muted-foreground">
              Pick a page, or bring a file you already have.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NewPaperCard
              title="CV"
              body="A page you can send."
              onClick={() => setMode({ type: "new", step: "gallery" })}
            />
            <NewPaperCard
              title="Cover letter"
              body="A letter for one job."
              onClick={() => setMode({ type: "letter" })}
            />
            <NewPaperCard
              title="Proof"
              body="Show the work behind a line."
              href="/proof"
            />
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Import a file</p>
            <p className="text-sm text-muted-foreground">
              Drop a PDF, Word or Google Doc, or paste a LinkedIn link.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={chooseFile}
            >
              Choose file
            </Button>
          </div>
        </div>
      ) : null}
      {!loading && !error && noResults ? (
        <div>
          <p>No results for &quot;{query.trim()}&quot;</p>
          <p className="text-sm text-muted-foreground">
            Try another word, or clear the search.
          </p>
        </div>
      ) : null}
      {!loading && !error && !firstRun && !noResults ? (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <SectionHead>CVs</SectionHead>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cvs.map(renderCard)}
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <SectionHead>Cover letters</SectionHead>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {letters.map(renderCard)}
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <SectionHead>Proofs</SectionHead>
          </section>
          <section className="flex flex-col gap-3">
            <SectionHead>Files</SectionHead>
            <ul className="flex flex-col gap-2">
              {visibleFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="truncate text-sm">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode({ type: "delete-file", file })}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      <Dialog
        open={mode?.type === "new"}
        onOpenChange={(open) => {
          if (!open) setMode(null)
        }}
      >
        <DialogContent
          className={
            mode?.type === "new" && mode.step === "gallery"
              ? PAPER_GALLERY_DIALOG_CLASS
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle>
              {mode?.type === "new" && mode.step === "gallery"
                ? "New CV"
                : "New"}
            </DialogTitle>
            <DialogDescription>
              Pick a page, or bring a file you already have.
            </DialogDescription>
          </DialogHeader>
          {mode?.type === "new" ? (
            <PaperNewDialog
              step={mode.step}
              onStepChange={(step) => setMode({ type: "new", step })}
              onCreated={(doc) => {
                setMode(null)
                void rememberUndo(doc.id, `Created ${doc.name}`)
                onOpen(doc.id)
              }}
              onChooseLetter={() => setMode({ type: "letter" })}
              onImport={chooseFile}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode?.type === "letter"}
        onOpenChange={(open) => {
          if (!open) setMode(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Start a cover letter</DialogTitle>
            <DialogDescription>
              Search jobs, paste a link or attach a file.
            </DialogDescription>
          </DialogHeader>
          <PaperLetterStart
            cvName={
              [...docs]
                .filter((doc) => doc.kind === "cv")
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
                ?.name ?? null
            }
            onCreated={(id) => {
              setMode(null)
              onOpen(id)
            }}
            onImport={chooseFile}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode?.type === "rename"}
        onOpenChange={(open) => {
          if (!open) setMode(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>Name is required.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Name"
            value={rename}
            onChange={(event) => setRename(event.target.value)}
          />
          {renameError ? (
            <p className="text-sm text-destructive">{renameError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="glow"
              onClick={() => void confirmRename()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode?.type === "delete" || mode?.type === "delete-file"}
        onOpenChange={(open) => {
          if (!open) setMode(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode?.type === "delete-file"
                ? "Delete this file?"
                : mode?.type === "delete" && mode.doc.kind === "letter"
                  ? "Delete this cover letter?"
                  : "Delete this CV?"}
            </DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="glow"
              onClick={() =>
                void (mode?.type === "delete-file"
                  ? confirmDeleteFile()
                  : confirmDelete())
              }
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode?.type === "link"}
        onOpenChange={(open) => {
          if (!open) setMode(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to application</DialogTitle>
            <DialogDescription>
              Choose the job this page belongs to.
            </DialogDescription>
          </DialogHeader>
          {jobsError ? <p>{jobsError}</p> : null}
          <div className="grid gap-2">
            {jobs.map((job) => (
              <Button
                key={job.id}
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal"
                onClick={() => {
                  if (!mode || mode.type !== "link") return
                  const kind = mode.doc.kind === "letter" ? "letter" : "cv"
                  void run("job.linkPaper", {
                    jobId: job.id,
                    docId: mode.doc.id,
                    kind,
                  })
                    .then(() => {
                      toast(`Linked to ${job.title}`)
                      setMode(null)
                    })
                    .catch((err: unknown) => {
                      toast(messageOf(err, "Could not link. Try again."))
                    })
                }}
              >
                {job.title}, {job.company}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
