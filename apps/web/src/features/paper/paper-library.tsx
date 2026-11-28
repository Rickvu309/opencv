import { useEffect, useReducer, useRef, type DragEvent } from "react"
import { Plus } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  paperDocNameSchema,
  type PaperFile,
  type PaperView,
} from "@workspace/domain/paper-doc"
import { toast, toastWithUndo } from "@workspace/ui/components/sonner"

import { reportRejected } from "@/lib/command-failure.ts"
import { Button } from "@workspace/ui/components/button"
import { SidebarExpandButton } from "@workspace/ui/components/page-header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { catalogClient, undoActivity } from "@/lib/contract-client.ts"
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
  type PickerChoice,
} from "./paper-template-gallery.tsx"
import { PaperLetterStartPage } from "./paper-letter-start-page.tsx"
import { PaperImportInput } from "./paper-import-input.tsx"
import { PaperPrintSheet } from "./paper-print-sheet.tsx"
import { printPaper } from "./paper-print.ts"
import { initialLibrary, libraryReducer } from "./paper-library.reducer.ts"
import {
  IMPORT_ACCEPT,
  discardCancelledImport,
  importRefusal,
  messageOf,
} from "./paper-library-support.ts"
import { libraryEntries } from "./paper-library-entries.ts"
import { PaperCommandBar } from "./paper-hand-controls.tsx"
import { handCounts } from "./paper-hand-layout.ts"
import { PaperHand } from "./paper-hand.tsx"
import { PaperHandError, PaperHandLoading } from "./paper-hand-empty.tsx"
import { type LibraryEntryHandlers } from "./paper-library-sections.tsx"
import { PaperLinkDialog } from "./paper-library-link.tsx"
import { useShownWhileClosing } from "./paper-library-closing.ts"
import {
  PaperDeleteDialog,
  PaperRenameDialog,
} from "./paper-library-dialogs.tsx"
import "./design/paper-library.css"
import "./design/paper-library-header.css"

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
      view,
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
  const newMode = useShownWhileClosing(mode?.type === "new" ? mode : null)
  const newStep = newMode?.step
  const newGallery = newStep === "gallery"
  const deleting = useShownWhileClosing(
    mode?.type === "delete" || mode?.type === "delete-file" ? mode : null
  )
  const importingName = useShownWhileClosing(
    importState.type === "importing" ? importState.name : null
  )
  const importError = useShownWhileClosing(
    importState.type === "error" ? importState : null
  )
  const linkDoc = useShownWhileClosing(mode?.type === "link" ? mode.doc : null)
  const retryFile = importError?.retry ?? null
  const entries = libraryEntries({ docs, files })
  const ready = !loading && !error

  function openPicker(kind: "cv" | "letter", initial?: PickerChoice) {
    dispatch({ type: "new_dialog_opened", step: "gallery", kind, initial })
  }

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
        await discardCancelledImport(queryClient, created.docId)
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

  async function onImportMany(dropped: File[]) {
    importRequest.current?.abort()
    const request = new AbortController()
    importRequest.current = request
    let added = 0
    let refused: string | null = null
    for (const file of dropped) {
      dispatch({ type: "import_started", name: file.name })
      try {
        const created = await importPaperFile(file, request.signal)
        if (request.signal.aborted) {
          await discardCancelledImport(queryClient, created.docId)
          return
        }
        added += 1
      } catch (err) {
        if (request.signal.aborted) return
        refused ??= `${file.name}: ${importRefusal(err).message}`
      }
    }
    if (importRequest.current === request) importRequest.current = null
    dispatch({ type: "import_ended" })
    onRetry()
    if (added > 0) toast(added === 1 ? "Added 1 file" : `Added ${added} files`)
    if (refused) dispatch({ type: "import_failed", message: refused })
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
      const id = await openBlankPage(queryClient, "cv")
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
      await catalogClient.run(queryClient, "paper.update", {
        docId: mode.doc.id,
        patch: { name: parsed.data },
      })
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
      const deleted = await catalogClient.run(queryClient, "paper.delete", {
        docId: mode.doc.id,
      })
      closeDialog()
      if (!("pending" in deleted)) toast(`Deleted ${name}`)
    } catch (err) {
      toast(messageOf(err, "Could not delete. Try again."))
    }
  }

  async function confirmDeleteFile() {
    if (!mode || mode.type !== "delete-file") return
    try {
      await catalogClient.run(queryClient, "paper.deleteFile", {
        fileId: mode.file.id,
      })
      toast(`Deleted ${mode.file.name}`)
      closeDialog()
    } catch (err) {
      toast(messageOf(err, "Could not delete that file. Try again."))
    }
  }

  async function duplicate(doc: PaperView) {
    try {
      const copy = await catalogClient.run(queryClient, "paper.duplicate", {
        docId: doc.id,
      })
      if (!("pending" in copy))
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
    onRename: (doc) => dispatch({ type: "rename_requested", doc }),
    onDuplicate: (doc) => void duplicate(doc),
    onLink: (doc) => void openLink(doc),
    onDownload: download,
    onDelete: (doc) => dispatch({ type: "delete_requested", doc }),
    onDeleteFile: (file) => dispatch({ type: "delete_file_requested", file }),
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
      data-surface="paper"
      data-slot="paper-library"
      className="paper-library min-w-0"
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
        className="paper-library-header sticky top-0 z-20 bg-background"
      >
        <SidebarExpandButton />
        <h1 className="text-lg font-medium">Paper</h1>
        {ready && entries.length > 0 ? (
          <PaperCommandBar
            view={view ?? "all"}
            counts={handCounts(entries)}
            query={query}
            onViewChange={(next) =>
              dispatch({ type: "view_changed", view: next })
            }
            onQueryChange={onQueryChange}
          />
        ) : null}
        <Button
          className="paper-library-new gap-1.5 text-[0.8125rem]"
          type="button"
          size="touch"
          variant="primary"
          aria-label="New"
          data-primary-action
          ref={newButtonRef}
          onClick={() => dispatch({ type: "new_dialog_opened", step: "kind" })}
        >
          <Plus className="size-[14px]" aria-hidden="true" />
          <span className="max-md:hidden">New</span>
        </Button>
      </div>
      {loading ? <PaperHandLoading /> : null}
      {error ? <PaperHandError message={error} onRetry={onRetry} /> : null}
      {ready ? (
        <PaperHand
          entries={entries}
          view={view ?? "all"}
          query={query}
          importName={
            importState.type === "importing" ? importState.name : null
          }
          handlers={handlers}
          onNewCV={() => openPicker("cv")}
          onNewLetter={() => openPicker("letter", "blank")}
          onImport={(dropped) =>
            void (dropped.length === 1
              ? onImport(dropped[0])
              : onImportMany(dropped))
          }
          onOpenImport={() => dispatch({ type: "import_dialog_opened" })}
          onClearSearch={() => onQueryChange("")}
          onSearchAll={() => dispatch({ type: "view_changed", view: "all" })}
        />
      ) : null}

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
        {newStep ? (
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
              step={newStep}
              initial={newMode?.initial}
              kind={newMode?.kind}
              onCoach={
                newMode?.kind === "letter"
                  ? () => dispatch({ type: "letter_dialog_opened" })
                  : undefined
              }
              onStepChange={(step) =>
                dispatch({ type: "new_dialog_opened", step })
              }
              onMinted={(id) => {
                closeDialog()
                onOpen(id)
              }}
              onChooseLetter={() => openPicker("letter")}
              onImport={chooseFile}
            />
          </DialogContent>
        ) : null}
      </Dialog>

      <PaperRenameDialog
        open={mode?.type === "rename"}
        name={rename}
        error={renameError}
        onNameChange={(value) => dispatch({ type: "rename_typed", value })}
        onSave={() => void confirmRename()}
        onClose={closeDialog}
      />

      <PaperDeleteDialog
        open={mode?.type === "delete" || mode?.type === "delete-file"}
        name={
          deleting?.type === "delete-file"
            ? deleting.file.name
            : deleting
              ? deleting.doc.name
              : null
        }
        undoable={false}
        onDelete={() =>
          void (deleting?.type === "delete-file"
            ? confirmDeleteFile()
            : confirmDelete())
        }
        onClose={closeDialog}
      />

      <ImportProgressDialog
        open={importState.type === "importing"}
        filename={importingName}
        onCancel={cancelImport}
      />
      <CantReadDialog
        open={importState.type === "error"}
        sentence={importError?.message ?? null}
        onChoose={chooseFile}
        onBlank={() => void startBlank()}
        onClose={() => dispatch({ type: "import_ended" })}
        onRetry={retryFile ? () => void onImport(retryFile) : undefined}
        blankPending={creatingBlank}
      />

      <PaperLinkDialog
        open={mode?.type === "link"}
        doc={linkDoc}
        jobs={jobs}
        jobsLoading={jobsLoading}
        jobsError={jobsError}
        onClose={closeDialog}
        onLink={(job) => {
          if (mode?.type !== "link") return
          const kind = mode.doc.kind === "letter" ? "letter" : "cv"
          void catalogClient
            .run(queryClient, "job.linkPaper", {
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
