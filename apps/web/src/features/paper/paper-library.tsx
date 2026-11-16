import { Fragment, useEffect, useReducer, useRef, type DragEvent } from "react"
import { FileUp, Plus } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  paperDocNameSchema,
  type PaperFile,
  type PaperView,
} from "@workspace/domain"
import { toast, toastWithUndo } from "@workspace/ui/components/sonner"

import { reportRejected } from "@/lib/command-failure.ts"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"

import { undoActivity, useRunCommand } from "@/lib/contract-client.ts"
import { listJobs } from "@/features/apply/apply-api.ts"

import {
  importPaperFile,
  importPaperLink,
  latestActivityId,
} from "./paper-api.ts"
import {
  CantReadDialog,
  ImportProgressDialog,
  PaperImportDialog,
} from "./paper-import.tsx"
import { openBlankPage, PaperNewDialog } from "./paper-new-dialog.tsx"
import {
  PAPER_GALLERY_DIALOG_CLASS,
  focusChosenTemplate,
} from "./paper-template-gallery.tsx"
import { PaperLetterStartPage } from "./paper-letter-start-page.tsx"
import { PaperImportInput } from "./paper-import-input.tsx"
import { PaperLibraryStarters } from "./paper-parts.tsx"
import { PaperPrintSheet } from "./paper-print-sheet.tsx"
import { printPaper } from "./paper-print.ts"
import { initialLibrary, libraryReducer } from "./paper-library.reducer.ts"
import {
  IMPORT_ACCEPT,
  discardCancelledImport,
  importRefusal,
  messageOf,
} from "./paper-library-support.ts"
import {
  PaperPackageLibrary,
  useWordLibrary,
} from "./paper-package-library.tsx"
import { PaperLibrarySearch } from "./paper-library-search.tsx"
import { PaperLibraryTile } from "./paper-library-card.tsx"
import {
  LIBRARY_SECTIONS,
  libraryEntries,
  librarySections,
} from "./paper-library-entries.ts"
import {
  LibraryEntryCard,
  PaperLibrarySection,
  PaperProofsLink,
  type LibraryEntryHandlers,
} from "./paper-library-sections.tsx"
import { PaperLinkDialog } from "./paper-library-link.tsx"
import "./design/paper-library.pen.css"

export function PaperLibrary({
  docs,
  files,
  loading,
  error,
  onRetry,
  onOpen,
  query,
  onQueryChange,
}: {
  docs: PaperView[]
  files: PaperFile[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onOpen: (id: string) => void
  query: string
  onQueryChange: (query: string) => void
}) {
  const run = useRunCommand()
  const queryClient = useQueryClient()
  const importRef = useRef<HTMLInputElement>(null)
  const newButtonRef = useRef<HTMLButtonElement>(null)
  const returnFromLetter = useRef(false)
  const importRequest = useRef<AbortController | null>(null)
  const [
    {
      importState,
      creatingBlank,
      mode,
      rename,
      renameError,
      jobs,
      jobsError,
      jobsLoading,
      printTarget,
      printNonce,
      link,
    },
    dispatch,
  ] = useReducer(libraryReducer, initialLibrary)
  useEffect(() => {
    if (mode === null && returnFromLetter.current) {
      returnFromLetter.current = false
      newButtonRef.current?.focus()
    }
  }, [mode])
  const closeDialog = () => dispatch({ type: "dialog_closed" })
  const newGallery = mode?.type === "new" && mode.step === "gallery"
  const dialogOpen = mode !== null || importState.type !== "idle"
  const retryFile = importState.type === "error" ? importState.retry : null
  const needle = query.trim().toLowerCase()
  const wordLibrary = useWordLibrary()
  const entries = libraryEntries({ docs, files, words: wordLibrary.items })
  const deletingWordPage = mode?.type === "delete" && mode.doc.format === "word"
  const sections = librarySections(entries, needle)
  const searching = needle !== ""
  const noResults = LIBRARY_SECTIONS.every(
    ({ id }) => sections[id].length === 0
  )
  const firstRun = !loading && !error && entries.length === 0 && !searching
  const ready = !loading && !error && !firstRun

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
      toastWithUndo(
        label,
        () =>
          void undoActivity(queryClient, activityId).catch(
            reportRejected("undo this")
          )
      )
    } catch {
      toast(label)
    }
  }

  async function onImport(file: File) {
    importRequest.current?.abort()
    const request = new AbortController()
    importRequest.current = request
    dispatch({ type: "import_started", name: file.name })
    try {
      const created = await importPaperFile(file, request.signal)
      if (request.signal.aborted) {
        await discardCancelledImport(run, created.docId)
        return
      }
      dispatch({ type: "import_ended" })
      if (created.notice) toast(created.notice)
      onOpen(created.docId)
    } catch (err) {
      if (request.signal.aborted) return
      const refusal = importRefusal(err)
      dispatch({
        type: "import_failed",
        message: refusal.message,
        ...(refusal.waitAndRetry ? { retry: file } : {}),
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
      const id = await openBlankPage(run, "cv")
      dispatch({ type: "import_ended" })
      onOpen(id)
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
      closeDialog()
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
      const deleted = await run("paper.delete", { docId: mode.doc.id })
      closeDialog()
      if (deleted.format === "word")
        await rememberUndo(deleted.id, `Deleted ${name}`)
      else toast(`Deleted ${name}`)
    } catch (err) {
      toast(messageOf(err, "Could not delete. Try again."))
    }
  }

  async function confirmDeleteFile() {
    if (!mode || mode.type !== "delete-file") return
    try {
      await run("paper.deleteFile", { fileId: mode.file.id })
      toast(`Deleted ${mode.file.name}`)
      closeDialog()
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

  const handlers: LibraryEntryHandlers = {
    onOpen,
    onPreview: wordLibrary.onSelect,
    onRename: (doc) => dispatch({ type: "rename_requested", doc }),
    onDuplicate: (doc) => void duplicate(doc),
    onLink: (doc) => void openLink(doc),
    onDownload: download,
    onDelete: (doc) => dispatch({ type: "delete_requested", doc }),
    onDeleteFile: (file) => dispatch({ type: "delete_file_requested", file }),
  }

  const tiles = {
    cv: (
      <PaperLibraryTile
        key="new-cv"
        label="New CV"
        icon={Plus}
        slot="paper-library-new-cv"
        onClick={() => dispatch({ type: "new_dialog_opened", step: "gallery" })}
      />
    ),
    letter: (
      <PaperLibraryTile
        key="letter"
        label="New letter"
        icon={Plus}
        slot="paper-library-new-letter"
        onClick={() => dispatch({ type: "letter_dialog_opened" })}
      />
    ),
    files: (
      <PaperLibraryTile
        key="import"
        label="Import a file"
        icon={FileUp}
        slot="paper-library-import"
        onClick={() => dispatch({ type: "import_dialog_opened" })}
      />
    ),
  }

  if (mode?.type === "letter") {
    return (
      <PaperLetterStartPage
        onBack={() => {
          returnFromLetter.current = true
          closeDialog()
        }}
        onCreated={(id) => {
          closeDialog()
          onOpen(id)
        }}
      />
    )
  }

  return (
    <section
      aria-label="Paper"
      data-pen-surface="paper"
      data-slot="paper-library"
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
          source={printTarget.paper}
          templateId={printTarget.templateId}
          docId={printTarget.id}
        />
      ) : null}
      <div
        data-slot="paper-library-header"
        className="flex flex-wrap items-center gap-2"
      >
        <h1 className="text-lg font-medium">Paper</h1>
        <div data-slot="paper-library-spacer" className="flex-1" />
        {ready ? (
          <PaperLibrarySearch query={query} onQueryChange={onQueryChange} />
        ) : null}
        <Button
          className="h-11 gap-1.5 md:h-7"
          type="button"
          size="sm"
          variant={dialogOpen ? "outline" : "primary"}
          data-primary-action
          ref={newButtonRef}
          onClick={() => dispatch({ type: "new_dialog_opened", step: "kind" })}
        >
          <Plus className="size-[13px]" aria-hidden="true" />
          New
        </Button>
      </div>
      {loading ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          Loading documents…
        </p>
      ) : null}
      {error ? (
        <div className="flex flex-col items-start gap-3 py-6">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button
            className="h-11 md:h-8"
            type="button"
            variant="outline"
            onClick={onRetry}
          >
            Refresh
          </Button>
        </div>
      ) : null}
      {firstRun ? (
        <PaperLibraryStarters
          onCv={() => dispatch({ type: "new_dialog_opened", step: "gallery" })}
          onLetter={() => dispatch({ type: "letter_dialog_opened" })}
          onImport={() => dispatch({ type: "import_dialog_opened" })}
        />
      ) : null}
      {ready && searching && noResults ? (
        <div role="status" className="flex flex-col items-start gap-2">
          <p>No results for &quot;{query.trim()}&quot;</p>
          <p className="text-sm text-muted-foreground">
            Try another word, or clear the search.
          </p>
          <Button
            type="button"
            variant="link"
            className="h-11 px-0 text-sm md:h-8"
            onClick={() => onQueryChange("")}
          >
            Clear search
          </Button>
        </div>
      ) : null}
      {ready
        ? LIBRARY_SECTIONS.map(({ id, title }) => {
            const items = sections[id]
            const tile = searching ? null : tiles[id]
            if (items.length === 0 && searching) return null
            return (
              <Fragment key={id}>
                {id === "files" && !searching ? <PaperProofsLink /> : null}
                <PaperLibrarySection title={title}>
                  {items.map((entry) => (
                    <LibraryEntryCard
                      key={entry.key}
                      entry={entry}
                      on={handlers}
                    />
                  ))}
                  {tile}
                </PaperLibrarySection>
              </Fragment>
            )
          })
        : null}

      <PaperPackageLibrary library={wordLibrary} />

      {mode?.type === "import" ? (
        <PaperImportDialog
          open
          onClose={closeDialog}
          link={link}
          onLinkChange={(next) => dispatch({ type: "link_typed", link: next })}
          onSubmitLink={() => void onPasteLink()}
          onChooseFile={chooseFile}
          onDropFile={onDropFile}
        />
      ) : null}

      {mode?.type === "new" ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeDialog()
          }}
        >
          <DialogContent
            className={newGallery ? PAPER_GALLERY_DIALOG_CLASS : undefined}
            initialFocus={newGallery ? focusChosenTemplate : undefined}
          >
            {newGallery ? null : (
              <DialogHeader>
                <DialogTitle>New</DialogTitle>
                <DialogDescription>
                  Pick a page, or bring a file you already have.
                </DialogDescription>
              </DialogHeader>
            )}
            <PaperNewDialog
              step={mode.step}
              onStepChange={(step) =>
                dispatch({ type: "new_dialog_opened", step })
              }
              onMinted={(id) => {
                closeDialog()
                onOpen(id)
              }}
              onChooseLetter={() => dispatch({ type: "letter_dialog_opened" })}
              onImport={chooseFile}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {mode?.type === "rename" ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeDialog()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename</DialogTitle>
              <DialogDescription>Name is required.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void confirmRename()
              }}
            >
              <Input
                aria-label="Name"
                className="h-11 text-base md:h-8 md:text-sm"
                aria-invalid={renameError ? true : undefined}
                aria-describedby={
                  renameError ? "paper-rename-error" : undefined
                }
                value={rename}
                onChange={(event) =>
                  dispatch({ type: "rename_typed", value: event.target.value })
                }
              />
              {renameError ? (
                <p
                  id="paper-rename-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {renameError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  className="h-11 md:h-8"
                  type="button"
                  variant="ghost"
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 md:h-7"
                  type="submit"
                  size="sm"
                  variant="primary"
                >
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {mode && (mode.type === "delete" || mode.type === "delete-file") ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeDialog()
          }}
        >
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>
                {mode.type === "delete-file"
                  ? `Delete "${mode.file.name}"?`
                  : `Delete "${mode.doc.name}"?`}
              </DialogTitle>
              <DialogDescription>
                {deletingWordPage
                  ? "You can undo this from the message that follows."
                  : "This can't be undone."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                className="h-11 md:h-7"
                type="button"
                size="sm"
                variant="ghost"
                onClick={closeDialog}
              >
                Cancel
              </Button>
              <Button
                className="h-11 md:h-7"
                type="button"
                size="sm"
                variant="destructive"
                onClick={() =>
                  void (mode.type === "delete-file"
                    ? confirmDeleteFile()
                    : confirmDelete())
                }
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {importState.type === "importing" ? (
        <ImportProgressDialog
          filename={importState.name}
          onCancel={cancelImport}
        />
      ) : null}
      {importState.type === "error" ? (
        <CantReadDialog
          sentence={importState.message}
          onChoose={chooseFile}
          onBlank={() => void startBlank()}
          onClose={() => dispatch({ type: "import_ended" })}
          onRetry={retryFile ? () => void onImport(retryFile) : undefined}
          blankPending={creatingBlank}
        />
      ) : null}

      <PaperLinkDialog
        doc={mode?.type === "link" ? mode.doc : null}
        jobs={jobs}
        jobsLoading={jobsLoading}
        jobsError={jobsError}
        onClose={closeDialog}
        onLink={(job) => {
          if (mode?.type !== "link") return
          const kind = mode.doc.kind === "letter" ? "letter" : "cv"
          void run("job.linkPaper", {
            jobId: job.id,
            docId: mode.doc.id,
            kind,
          })
            .then(() => {
              toast(`Linked to ${job.title}`)
              closeDialog()
            })
            .catch((err: unknown) => {
              toast(messageOf(err, "Could not link. Try again."))
            })
        }}
      />
    </section>
  )
}
