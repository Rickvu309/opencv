import { Bell, Ellipsis, LayoutTemplate, Link2, Star } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useReducer, useRef } from "react"
import {
  paperDocNameSchema,
  type CvBlockDocument,
  type PaperPages,
  type PaperTemplateId,
  type PaperView,
} from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { CopyButton } from "@workspace/ui/components/copy-button"
import { toast } from "@workspace/ui/components/sonner"

import { createChat } from "@/features/coach/chat-api.ts"
import { useChatStore } from "@/features/coach/use-chat-store.ts"
import { ApiError } from "@/lib/api-error.ts"
import { publishCoachDraft } from "@/lib/coach-draft.ts"
import { useRunCommand } from "@/lib/contract-client.ts"

import { CvPhoto, CvPhotoFrame } from "./cv-templates/cv-parts.tsx"
import { usePaperAutosave } from "./paper-autosave.ts"
import {
  PaperCheckBar,
  focusDatesField,
  focusPhoneField,
  useImportCheckBar,
} from "./paper-check-bar.tsx"
import { editorReducer, initialEditor } from "./paper-editor.reducer.ts"
import { PaperBlocks, type BlockCommit } from "./paper-blocks.tsx"
import { readEditorDocument } from "./paper-block-ops.ts"
import { PaperEditorConflictBanner } from "./paper-editor-conflict-banner.tsx"
import {
  PAPER_GALLERY_DIALOG_CLASS,
  PaperTemplateGallery,
} from "./paper-template-gallery.tsx"
import { getPaper, streamPaperTurn } from "./paper-api.ts"
import { PaperPrintMeasure, PaperPrintSheet } from "./paper-print-sheet.tsx"
import {
  bindPrintPageCount,
  printPaper,
  readPreviewPageCount,
} from "./paper-print.ts"
import { editorEditedLabel, previewTemplate } from "./paper-templates.ts"
import { useShareLink } from "./paper-share-link.ts"

function toastError(error: unknown, fallback: string) {
  toast(error instanceof Error ? error.message : fallback)
}

function applyPhoto(
  current: CvBlockDocument,
  ref: string | undefined
): CvBlockDocument {
  const header = { ...current.header }
  if (ref) header.photo = ref
  else delete header.photo
  return { ...current, header }
}

export function PaperCvEditor({
  initial,
  pages,
  onBack,
}: {
  initial: PaperView
  pages: PaperPages
  onBack: () => void
}) {
  const run = useRunCommand()
  const shareLink = useShareLink(initial.id)
  const { openChat } = useChatStore()
  const queryClient = useQueryClient()
  const dirtyRef = useRef(false)
  const inputCountRef = useRef(0)
  const [
    {
      doc,
      history,
      name,
      nameError,
      updatedAt,
      pageState,
      conflict,
      favoritePending,
      templateId,
      galleryOpen,
      previewPages,
      printJob,
    },
    dispatch,
  ] = useReducer(editorReducer, undefined, () =>
    initialEditor(initial, pages, readEditorDocument(initial.document))
  )
  const docRef = useRef(doc)
  const importBar = useImportCheckBar({
    docId: initial.id,
    initial,
    readDocument: () => docRef.current,
    dirtyRef,
  })
  const { schedule, commitNow, adopt, versionRef } =
    usePaperAutosave<CvBlockDocument>({
      docId: initial.id,
      initialVersion: initial.contentVersion,
      toDocument: (next) => next,
      readInputEpoch: () => inputCountRef.current,
      onSaved: (saved, inputEpoch) => {
        if (inputEpoch === inputCountRef.current) dirtyRef.current = false
        adopt(saved.contentVersion)
        dispatch({ type: "saved", at: new Date().toISOString() })
        void importBar.settle()
      },
      onConflict: () => dispatch({ type: "conflict_detected" }),
      onError: (error) => {
        toastError(error, "Could not save. Try again.")
      },
    })
  const measureRef = useRef<HTMLDivElement>(null)
  const showBanner = previewPages > 1 && pageState.pageChoice === "unset"

  useLayoutEffect(() => {
    return bindPrintPageCount(() => {
      const next = readPreviewPageCount(measureRef.current)
      dispatch({ type: "preview_measured", pages: next })
    })
  }, [doc, templateId])

  useEffect(() => {
    if (!printJob) return
    return printPaper(printJob.title, () =>
      dispatch({ type: "print_finished" })
    )
  }, [printJob])

  useEffect(() => {
    dispatch({ type: "pages_loaded", pages })
  }, [pages])

  useEffect(() => {
    if (dirtyRef.current) return
    const next = readEditorDocument(initial.document)
    if (initial.contentVersion < versionRef.current) return
    if (
      initial.contentVersion === versionRef.current &&
      JSON.stringify(next) === JSON.stringify(doc)
    ) {
      return
    }
    adopt(initial.contentVersion)
    docRef.current = next
    dispatch({ type: "document_synced", doc: next })
  }, [initial, doc, adopt, versionRef])

  function edit(next: CvBlockDocument) {
    inputCountRef.current += 1
    dirtyRef.current = true
    docRef.current = next
    dispatch({ type: "document_edited", doc: next })
    schedule(next)
  }

  async function flushBeforePhoto() {
    if (!dirtyRef.current) return
    const snapshot = docRef.current
    adopt(versionRef.current)
    dirtyRef.current = false
    try {
      const saved = await run(
        "paper.replace",
        {
          docId: initial.id,
          contentVersion: versionRef.current,
          document: snapshot,
        },
        { refresh: false }
      )
      if (dirtyRef.current) versionRef.current = saved.contentVersion
      else adopt(saved.contentVersion)
      dispatch({ type: "saved", at: new Date().toISOString() })
    } catch (error) {
      if (error instanceof ApiError && error.code === "CONFLICT") {
        dispatch({ type: "conflict_detected" })
      } else {
        dirtyRef.current = true
        schedule(snapshot)
      }
      throw error
    }
  }

  function notePhoto(ref: string | undefined, version: number) {
    versionRef.current = version
    const next = applyPhoto(docRef.current, ref)
    docRef.current = next
    if (dirtyRef.current) schedule(next)
    dispatch({ type: "photo_changed", doc: next })
  }

  function commit(next: CvBlockDocument, kind: BlockCommit) {
    void kind
    if (JSON.stringify(next) === JSON.stringify(doc)) return
    inputCountRef.current += 1
    dirtyRef.current = true
    docRef.current = next
    dispatch({ type: "document_committed", doc: next })
    commitNow(next)
  }

  function undo() {
    const next = history.at(-1)
    if (conflict || !next) return
    inputCountRef.current += 1
    dirtyRef.current = true
    docRef.current = next
    dispatch({ type: "edit_undone" })
    commitNow(next)
  }

  async function commitName() {
    const parsed = paperDocNameSchema.safeParse(name.trim())
    if (!parsed.success) {
      dispatch({
        type: "name_rejected",
        message: parsed.error.issues[0]?.message ?? "Name is required",
      })
      return
    }
    dispatch({ type: "name_accepted" })
    if (parsed.data === initial.name) return
    try {
      await run("paper.rename", { docId: initial.id, name: parsed.data })
    } catch (error) {
      dispatch({
        type: "name_rejected",
        message:
          error instanceof Error
            ? error.message
            : "Could not rename. Try again.",
      })
    }
  }

  async function keepPages() {
    try {
      await run("paper.keepTwoPages", { docId: initial.id })
      dispatch({ type: "two_pages_kept" })
    } catch (error) {
      toastError(error, "Could not keep two pages. Try again.")
    }
  }

  function adoptDocument(next: PaperView) {
    dirtyRef.current = false
    adopt(next.contentVersion)
    const read = readEditorDocument(next.document)
    docRef.current = read
    dispatch({ type: "document_adopted", doc: read, updatedAt: next.updatedAt })
  }

  async function toggleFavorite() {
    if (favoritePending) return
    dispatch({ type: "favorite_started" })
    try {
      await run("paper.setFavorite", {
        docId: initial.id,
        isFavorite: !initial.isFavorite,
      })
    } catch (error) {
      toastError(error, "Could not update favorite. Try again.")
    } finally {
      dispatch({ type: "favorite_finished" })
    }
  }

  async function fitOnePage() {
    try {
      const chat = await run("chat.create", { title: "Fit to one page" })
      await streamPaperTurn({
        queryClient,
        chatId: chat.id,
        text: "Tighten this CV so it fits on one page.",
        focusDocId: initial.id,
        onText: () => undefined,
        onToolResult: (tool) => {
          if (tool === "paper.replace") {
            void getPaper(initial.id).then((next) => adoptDocument(next))
          }
        },
      })
    } catch (error) {
      toastError(error, "Could not ask Coach. Try again.")
    }
  }

  function askCoach(text: string) {
    const paperName = (name || initial.name || "").trim()
    const title = paperName ? `About ${paperName}` : undefined
    void createChat(queryClient, {
      title,
      focusDocId: initial.id,
    })
      .then((chat) => {
        openChat(chat.id)
        if (text) publishCoachDraft(text)
        document.querySelector<HTMLButtonElement>("[data-dock-coach]")?.click()
      })
      .catch((error: unknown) => {
        toastError(error, "Could not open Coach. Use the dock Coach button.")
      })
  }

  function download() {
    dispatch({ type: "print_requested", title: name })
  }

  async function reload() {
    try {
      const next = await getPaper(initial.id)
      dispatch({ type: "template_changed", templateId: next.templateId })
      adoptDocument(next)
    } catch (error) {
      toastError(error, "Could not reload. Refresh the page.")
    }
  }

  async function applyTemplate(nextTemplateId: PaperTemplateId) {
    try {
      const saved = await run("paper.setTemplate", {
        docId: initial.id,
        templateId: nextTemplateId,
      })
      dispatch({ type: "template_applied", templateId: saved.templateId })
    } catch (error) {
      toastError(error, "Could not change the template. Try again.")
    }
  }

  return (
    <section
      aria-label={`Editing ${initial.name}`}
      data-paper-editor=""
      className="flex min-w-0 flex-col gap-3 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-1 basis-72 items-center gap-2"
        >
          <Button type="button" variant="link" onClick={onBack}>
            Paper
          </Button>
          <span className="text-sm text-muted-foreground">CVs</span>
          <Input
            aria-label="Name"
            value={name}
            onChange={(event) =>
              dispatch({ type: "name_typed", name: event.target.value })
            }
            onBlur={() => void commitName()}
            className="h-8 max-w-48 border-transparent bg-transparent shadow-none"
          />
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {editorEditedLabel(updatedAt)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Favorite"
            aria-pressed={initial.isFavorite}
            disabled={favoritePending}
            onClick={() => void toggleFavorite()}
          >
            <Star
              className={initial.isFavorite ? "size-4 fill-current" : "size-4"}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="More"
            onClick={() => void download()}
          >
            <Ellipsis className="size-4" />
          </Button>
          <CopyButton
            value={shareLink}
            copiedMessage="Link copied"
            errorMessage={(error) =>
              error instanceof Error
                ? error.message
                : "Could not copy the link. Try again."
            }
            aria-label="Copy link"
          >
            <Link2 className="size-4" />
          </CopyButton>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Change template"
            onClick={() => dispatch({ type: "gallery_opened" })}
          >
            <LayoutTemplate className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Notifications"
            onClick={() => toast("Notifications are not on yet.")}
          >
            <Bell className="size-4" />
          </Button>
        </div>
      </div>
      <div
        className="flex flex-wrap gap-1"
        role="toolbar"
        aria-label="Selection"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => askCoach("")}
        >
          Coach
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={conflict || history.length === 0}
        >
          Undo
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={download}>
          Download PDF
        </Button>
      </div>
      {conflict ? (
        <PaperEditorConflictBanner onReload={() => void reload()} />
      ) : null}
      {showBanner ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Over one page</p>
            <p className="text-sm text-muted-foreground">
              Most hiring teams read one page. Coach can tighten it for you.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="glow"
              onClick={() => void fitOnePage()}
            >
              Fit to one page
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void keepPages()}
            >
              Keep 2 pages
            </Button>
          </div>
        </div>
      ) : null}
      <PaperCheckBar
        checks={importBar.checks}
        hidden={importBar.hidden}
        onAddPhone={focusPhoneField}
        onAddDates={focusDatesField}
        onSkip={importBar.skip}
        onDone={importBar.done}
      />
      <div
        data-template={previewTemplate(templateId)}
        className="min-w-0"
        onBlurCapture={() => dispatch({ type: "text_edit_finished" })}
      >
        <CvPhotoFrame
          value={{
            docId: initial.id,
            beforePhoto: flushBeforePhoto,
            notePhoto,
          }}
        >
          {templateId === "with-photo" ? (
            <CvPhoto
              url={doc.header.photo}
              name={doc.header.name}
              onChange={(ref) => {
                const next = applyPhoto(docRef.current, ref)
                docRef.current = next
                dirtyRef.current = true
                dispatch({ type: "photo_changed", doc: next })
                schedule(next)
              }}
            />
          ) : null}
          <PaperBlocks
            document={doc}
            onChange={edit}
            onCommit={commit}
            onAskCoach={askCoach}
          />
        </CvPhotoFrame>
        {previewPages > 1 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Page {previewPages}
          </p>
        ) : null}
      </div>
      {nameError ? (
        <p className="text-sm text-destructive">{nameError}</p>
      ) : null}
      <PaperPrintMeasure
        source={doc}
        templateId={templateId}
        docId={initial.id}
        measureRef={measureRef}
      />
      {printJob ? (
        <PaperPrintSheet
          name={name}
          kind="cv"
          source={doc}
          templateId={templateId}
          docId={initial.id}
        />
      ) : null}
      <Dialog
        open={galleryOpen}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "gallery_closed" })
        }}
      >
        <DialogContent className={PAPER_GALLERY_DIALOG_CLASS}>
          <DialogHeader>
            <DialogTitle>Choose a template</DialogTitle>
            <DialogDescription>
              The open CV keeps its text and uses this layout.
            </DialogDescription>
          </DialogHeader>
          <PaperTemplateGallery
            onUse={(nextTemplateId) => void applyTemplate(nextTemplateId)}
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
