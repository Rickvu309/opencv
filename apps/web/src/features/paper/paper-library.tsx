import { useEffect, useReducer, useRef, type DragEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  paperDocNameSchema,
  blankBlockDocument,
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

import {
  undoActivity,
  refreshQueries,
  useRunCommand,
} from "@/lib/contract-client.ts"
import { listJobs } from "@/features/apply/apply-api.ts"

import {
  importPaperFile,
  importPaperLink,
  latestActivityId,
} from "./paper-api.ts"
import {
  CantReadDialog,
  ImportProgressDialog,
  PaperImportRow,
} from "./paper-import.tsx"
import { PaperNewDialog } from "./paper-new-dialog.tsx"
import { PAPER_GALLERY_DIALOG_CLASS } from "./paper-template-gallery.tsx"
import { PaperLetterStart } from "./paper-letter.tsx"
import { PaperImportInput } from "./paper-import-input.tsx"
import { NewPaperCard, PaperCard, SectionHead } from "./paper-parts.tsx"
import { PaperPrintSheet } from "./paper-print-sheet.tsx"
import { printPaper } from "./paper-print.ts"
import { initialLibrary, libraryReducer } from "./paper-library.reducer.ts"
import { IMPORT_ACCEPT, messageOf } from "./paper-library-support.ts"
import { paperEditedLabel } from "./paper-templates.ts"

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
  const importRequest = useRef<AbortController | null>(null)
  const [
    {
      importState,
      creatingBlank,
      query,
      mode,
      rename,
      renameError,
      jobs,
      jobsError,
      printTarget,
      printNonce,
      link,
    },
    dispatch,
  ] = useReducer(libraryReducer, initialLibrary)
  const dialogOpen = mode !== null || importState.type !== "idle"
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
  const noResults =
    needle !== "" && visible.length === 0 && visibleFiles.length === 0
  const firstRun = !loading && !error && documents.length === 0 && needle === ""

  useEffect(() => () => importRequest.current?.abort(), [])

  useEffect(() => {
    if (printNonce === 0 || !printTarget) return
    return printPaper(printTarget.name, () => {
      dispatch({ type: "print_finished" })
    })
  }, [printNonce, printTarget])

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

  async function discardImport(created: PaperView) {
    if (created.sourceFileId) {
      await run("paper.deleteFile", { fileId: created.sourceFileId }).catch(
        () => undefined
      )
    }
    await run("paper.delete", { docId: created.id }).catch(() => undefined)
  }

  async function onImport(file: File) {
    importRequest.current?.abort()
    const request = new AbortController()
    importRequest.current = request
    dispatch({ type: "import_started", name: file.name })
    try {
      // Do not pass this signal to the upload. A keep-alive cancel does not
      // abort the server request, and aborting the fetch drops the id.
      const created = await importPaperFile(file)
      if (request.signal.aborted) {
        await discardImport(created)
        return
      }
      void refreshQueries(queryClient, [
        { query: "paper.list" },
        { query: "paper.files" },
      ])
      dispatch({ type: "import_ended" })
      onOpen(created.id)
    } catch (err) {
      if (request.signal.aborted) return
      dispatch({
        type: "import_failed",
        message: messageOf(err, "Could not import that file. Try it again."),
      })
    } finally {
      if (importRequest.current === request) importRequest.current = null
    }
  }

  function cancelImport() {
    importRequest.current?.abort()
    importRequest.current = null
    dispatch({ type: "import_ended" })
  }

  async function startBlank() {
    if (creatingBlank) return
    dispatch({ type: "blank_started" })
    try {
      const created = await run("paper.create", {
        kind: "cv",
        document: blankBlockDocument(),
      })
      dispatch({ type: "import_ended" })
      onOpen(created.id)
    } catch (err) {
      dispatch({
        type: "import_failed",
        message: messageOf(err, "Could not create a CV. Try again."),
      })
    } finally {
      dispatch({ type: "blank_ended" })
    }
  }

  function chooseFile() {
    importRef.current?.click()
  }

  async function onPasteLink() {
    const value = link.trim()
    if (!value) return
    try {
      await importPaperLink(value)
    } catch (err) {
      dispatch({
        type: "import_failed",
        message: messageOf(err, "Could not import that file. Try it again."),
      })
    }
  }

  function onDropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) void onImport(file)
  }

  async function openLink(doc: PaperView) {
    dispatch({ type: "link_dialog_opened", doc })
    try {
      dispatch({ type: "jobs_loaded", jobs: await listJobs() })
    } catch (err) {
      dispatch({
        type: "jobs_failed",
        message: messageOf(err, "Could not load jobs. Refresh the page."),
      })
    }
  }

  async function confirmRename() {
    if (!mode || mode.type !== "rename") return
    const parsed = paperDocNameSchema.safeParse(rename.trim())
    if (!parsed.success) {
      dispatch({
        type: "rename_rejected",
        message: parsed.error.issues[0]?.message ?? "Name is required",
      })
      return
    }
    try {
      await run("paper.rename", { docId: mode.doc.id, name: parsed.data })
      dispatch({ type: "dialog_closed" })
    } catch (err) {
      dispatch({
        type: "rename_rejected",
        message: messageOf(err, "Could not rename. Try again."),
      })
    }
  }

  async function confirmDelete() {
    if (!mode || mode.type !== "delete") return
    const name = mode.doc.name
    try {
      await run("paper.delete", { docId: mode.doc.id })
      toast(`Deleted ${name}`)
      dispatch({ type: "dialog_closed" })
    } catch (err) {
      toast(messageOf(err, "Could not delete. Try again."))
    }
  }

  async function confirmDeleteFile() {
    if (!mode || mode.type !== "delete-file") return
    try {
      await run("paper.deleteFile", { fileId: mode.file.id })
      toast(`Deleted ${mode.file.name}`)
      dispatch({ type: "dialog_closed" })
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

  function download(doc: PaperView) {
    dispatch({ type: "print_requested", doc })
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
          dispatch({ type: "rename_requested", doc })
        }}
        onDuplicate={() => void duplicate(doc)}
        onLink={() => void openLink(doc)}
        onDownload={() => void download(doc)}
        onDelete={() => dispatch({ type: "delete_requested", doc })}
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
      {printTarget ? (
        <PaperPrintSheet
          name={printTarget.name}
          kind={printTarget.kind}
          source={printTarget.document}
          templateId={printTarget.templateId}
          docId={printTarget.id}
        />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Paper</h1>
        <Button
          type="button"
          variant={dialogOpen ? "outline" : "glow"}
          data-primary-action
          onClick={() => dispatch({ type: "new_dialog_opened", step: "kind" })}
        >
          New
        </Button>
      </div>
      <Input
        aria-label="Search Paper"
        placeholder="Search Paper"
        value={query}
        onChange={(event) =>
          dispatch({ type: "search_typed", query: event.target.value })
        }
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
              onClick={() =>
                dispatch({ type: "new_dialog_opened", step: "gallery" })
              }
            />
            <NewPaperCard
              title="Cover letter"
              body="A letter for one job."
              onClick={() => dispatch({ type: "letter_dialog_opened" })}
            />
            <NewPaperCard
              title="Proof"
              body="Show the work behind a line."
              href="/proof"
            />
          </div>
          <PaperImportRow
            link={link}
            onLinkChange={(next) =>
              dispatch({ type: "link_typed", link: next })
            }
            onSubmitLink={() => void onPasteLink()}
            onChooseFile={chooseFile}
            onDropFile={onDropFile}
          />
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
                    onClick={() =>
                      dispatch({ type: "delete_file_requested", file })
                    }
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
          if (!open) dispatch({ type: "dialog_closed" })
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
              onStepChange={(step) =>
                dispatch({ type: "new_dialog_opened", step })
              }
              onCreated={(doc) => {
                dispatch({ type: "dialog_closed" })
                void rememberUndo(doc.id, `Created ${doc.name}`)
                onOpen(doc.id)
              }}
              onChooseLetter={() => dispatch({ type: "letter_dialog_opened" })}
              onImport={chooseFile}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode?.type === "letter"}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "dialog_closed" })
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
              dispatch({ type: "dialog_closed" })
              onOpen(id)
            }}
            onImport={chooseFile}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode?.type === "rename"}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "dialog_closed" })
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
            onChange={(event) =>
              dispatch({ type: "rename_typed", value: event.target.value })
            }
          />
          {renameError ? (
            <p className="text-sm text-destructive">{renameError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => dispatch({ type: "dialog_closed" })}
            >
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
          if (!open) dispatch({ type: "dialog_closed" })
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => dispatch({ type: "dialog_closed" })}
            >
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

      <ImportProgressDialog
        open={importState.type === "importing"}
        filename={importState.type === "importing" ? importState.name : ""}
        onCancel={cancelImport}
      />
      <CantReadDialog
        open={importState.type === "error"}
        sentence={importState.type === "error" ? importState.message : ""}
        onChoose={chooseFile}
        onBlank={() => void startBlank()}
        onClose={() => dispatch({ type: "import_ended" })}
        blankPending={creatingBlank}
      />

      <Dialog
        open={mode?.type === "link"}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "dialog_closed" })
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
                      dispatch({ type: "dialog_closed" })
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
