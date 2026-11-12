import { useEffect, useReducer, useRef, type DragEvent } from "react"
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
  PaperImportDialog,
} from "./paper-import.tsx"
import { openBlankPage, PaperNewDialog } from "./paper-new-dialog.tsx"
import { PAPER_GALLERY_DIALOG_CLASS } from "./paper-template-gallery.tsx"
import { PaperLetterStartPage } from "./paper-letter-start-page.tsx"
import { PaperImportInput } from "./paper-import-input.tsx"
import { PaperLibraryStarters } from "./paper-parts.tsx"
import { PaperPrintSheet } from "./paper-print-sheet.tsx"
import { printPaper } from "./paper-print.ts"
import { initialLibrary, libraryReducer } from "./paper-library.reducer.ts"
import {
  IMPORT_ACCEPT,
  discardImport,
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
  type LibraryEntryHandlers,
} from "./paper-library-sections.tsx"
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
      const created = await importPaperFile(file)
      if ("generation" in created) {
        if (request.signal.aborted) return
        dispatch({ type: "import_ended" })
        onOpen(created.docId)
        return
      }
      if (request.signal.aborted) {
        await discardImport(run, created)
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
    letter: null,
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
          className="h-11 gap-1.5 md:h-8 md:px-3 md:text-[13px] md:font-semibold"
          type="button"
          variant={dialogOpen ? "outline" : "glow"}
          data-primary-action
          ref={newButtonRef}
          onClick={() => dispatch({ type: "new_dialog_opened", step: "kind" })}
        >
          <Plus className="size-[13px]" aria-hidden="true" />
          New
        </Button>
      </div>
      {loading ? <p>Loading documents</p> : null}
      {error ? (
        <div className="flex flex-col items-start gap-3">
          <p>{error}</p>
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
        <div>
          <p>No results for &quot;{query.trim()}&quot;</p>
          <p className="text-sm text-muted-foreground">
            Try another word, or clear the search.
          </p>
        </div>
      ) : null}
      {ready
        ? LIBRARY_SECTIONS.map(({ id, title }) => {
            const items = sections[id]
            const tile = searching ? null : tiles[id]
            if (items.length === 0 && (searching || id !== "files")) return null
            return (
              <PaperLibrarySection key={id} title={title}>
                {items.map((entry) => (
                  <LibraryEntryCard
                    key={entry.key}
                    entry={entry}
                    on={handlers}
                  />
                ))}
                {tile}
              </PaperLibrarySection>
            )
          })
        : null}

      <PaperPackageLibrary library={wordLibrary} />

      <PaperImportDialog
        open={mode?.type === "import"}
        onClose={closeDialog}
        link={link}
        onLinkChange={(next) => dispatch({ type: "link_typed", link: next })}
        onSubmitLink={() => void onPasteLink()}
        onChooseFile={chooseFile}
        onDropFile={onDropFile}
      />

      <Dialog
        open={mode?.type === "new"}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent
          className={newGallery ? PAPER_GALLERY_DIALOG_CLASS : undefined}
        >
          <DialogHeader>
            <DialogTitle>{newGallery ? "New CV" : "New"}</DialogTitle>
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
              onMinted={(id) => {
                closeDialog()
                onOpen(id)
              }}
              onChooseLetter={() => dispatch({ type: "letter_dialog_opened" })}
              onImport={chooseFile}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode?.type === "rename"}
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
                className="h-11 md:h-8"
                type="button"
                variant="ghost"
                onClick={closeDialog}
              >
                Cancel
              </Button>
              <Button className="h-11 md:h-8" type="submit" variant="glow">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode?.type === "delete" || mode?.type === "delete-file"}
        onOpenChange={(open) => {
          if (!open) closeDialog()
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
            <DialogDescription>
              {deletingWordPage
                ? "You can undo this from the message that follows."
                : "This can't be undone."}
            </DialogDescription>
          </DialogHeader>
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
              className="h-11 md:h-8"
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
          if (!open) closeDialog()
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
                className="h-auto min-h-11 justify-start whitespace-normal md:min-h-0"
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
                      closeDialog()
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
