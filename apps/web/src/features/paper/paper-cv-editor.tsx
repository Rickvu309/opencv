import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  paperDocNameSchema,
  type CvPaper,
  type PaperDocument,
  type PaperPages,
  type PaperTemplateId,
  type PaperView,
} from "@workspace/domain"
import type { ClientChange } from "@workspace/paper-crdt"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { toast } from "@workspace/ui/components/sonner"

import { createChat } from "@/features/coach/chat-api.ts"
import { useChatStore } from "@/features/coach/use-chat-store.ts"
import { reportRejected } from "@/lib/command-failure.ts"
import { publishCoachDraft } from "@/lib/coach-draft.ts"
import { useRunCommand } from "@/lib/contract-client.ts"
import { setPaperSelection } from "@/lib/paper-selection.ts"
import { SYNC_LABEL, usePaperSync } from "@/lib/paper-sync.ts"

import { bindCvCoach, CvChromeContext } from "./cv-blocks.tsx"
import { CvEditorBar, cvEditorStatus } from "./paper-cv-bar.tsx"
import { CvPhotoFrame } from "./cv-templates/cv-parts.tsx"
import { streamPaperTurn } from "./paper-api.ts"
import {
  PaperCheckBar,
  bindPaperFocus,
  focusDatesField,
  focusPhoneField,
} from "./paper-check-bar.tsx"
import {
  PaperEditorEngine,
  type PaperEditorHandle,
} from "./paper-editor-engine.tsx"
import { PaperPrintMeasure, PaperPrintSheet } from "./paper-print-sheet.tsx"
import {
  bindPrintPageCount,
  printPaper,
  readPreviewPageCount,
} from "./paper-print.ts"
import { useShareLink } from "./paper-share-link.ts"
import {
  PAPER_GALLERY_DIALOG_CLASS,
  PaperTemplateGallery,
} from "./paper-template-gallery.tsx"
import { previewTemplate } from "./paper-templates.ts"

type State = {
  name: string
  nameError: string
  editedAt: string
  templateId: PaperView["templateId"]
  galleryOpen: boolean
  printing: boolean
  pageChoice: PaperPages["pageChoice"]
  previewPages: number
  checks: PaperView["checks"]
  checksHidden: boolean
  favoritePending: boolean
  deferring: boolean
  cv: CvPaper | null
}

type Action =
  | { type: "document"; cv: CvPaper; local: boolean }
  | { type: "name"; name: string }
  | { type: "name_error"; message: string }
  | { type: "name_ok" }
  | { type: "gallery"; open: boolean }
  | { type: "template"; templateId: PaperView["templateId"] }
  | { type: "print"; on: boolean }
  | { type: "pages"; pageChoice: PaperPages["pageChoice"] }
  | { type: "measured"; pages: number }
  | { type: "checks"; checks: PaperView["checks"] }
  | { type: "hide_checks" }
  | { type: "favorite"; pending: boolean }
  | { type: "defer"; on: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "document":
      return {
        ...state,
        cv: action.cv,
        editedAt: action.local ? new Date().toISOString() : state.editedAt,
      }
    case "name":
      return { ...state, name: action.name, nameError: "" }
    case "name_error":
      return { ...state, nameError: action.message }
    case "name_ok":
      return { ...state, nameError: "" }
    case "gallery":
      return { ...state, galleryOpen: action.open }
    case "template":
      return { ...state, templateId: action.templateId, galleryOpen: false }
    case "print":
      return { ...state, printing: action.on }
    case "pages":
      return { ...state, pageChoice: action.pageChoice }
    case "measured":
      return { ...state, previewPages: action.pages }
    case "checks":
      return { ...state, checks: action.checks }
    case "hide_checks":
      return { ...state, checksHidden: true }
    case "favorite":
      return { ...state, favoritePending: action.pending }
    case "defer":
      return state.deferring === action.on
        ? state
        : { ...state, deferring: action.on }
  }
}

function toastError(error: unknown, fallback: string) {
  toast(error instanceof Error ? error.message : fallback)
}

function datesFilled(cv: CvPaper, blockId: string | undefined) {
  if (!blockId) return false
  const block = cv.blocks.find((item) => item.id === blockId)
  return block?.type === "experience" && block.period.includes("20")
}

export function PaperCvEditor({
  initial,
  pages,
  onBack,
  seedName = "",
}: {
  initial: PaperView
  pages: PaperPages
  onBack: () => void
  seedName?: string
}) {
  const run = useRunCommand()
  const shareLink = useShareLink(initial.id)
  const { openChat } = useChatStore()
  const queryClient = useQueryClient()
  const { sync, status, generation, client } = usePaperSync(initial.id)
  const editorRef = useRef<PaperEditorHandle>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const syncRef = useRef(sync)
  const dismissed = useRef(new Set<string>())
  const deferTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, dispatch] = useReducer(reducer, {
    name: initial.name,
    nameError: "",
    editedAt: initial.updatedAt,
    templateId: initial.templateId,
    galleryOpen: false,
    printing: false,
    pageChoice: pages.pageChoice,
    previewPages: pages.pages,
    checks: initial.checks,
    checksHidden: false,
    favoritePending: false,
    deferring: false,
    cv: null,
  })
  useEffect(() => {
    syncRef.current = sync
  }, [sync])
  useEffect(
    () => () => {
      if (deferTimer.current) clearTimeout(deferTimer.current)
    },
    []
  )
  const noteTyping = () => {
    dispatch({ type: "defer", on: true })
    if (deferTimer.current) clearTimeout(deferTimer.current)
    deferTimer.current = setTimeout(
      () => dispatch({ type: "defer", on: false }),
      1000
    )
  }
  const onDocument = useCallback(
    (next: PaperDocument | null, change: ClientChange) => {
      if (next?.kind !== "cv") return
      dispatch({ type: "document", cv: next, local: change === "local" })
    },
    []
  )
  const onSelectedBlocks = useCallback(
    (ids: string[]) => setPaperSelection(initial.id, ids),
    [initial.id]
  )
  useEffect(() => () => setPaperSelection(initial.id, []), [initial.id])
  useEffect(() => {
    bindPaperFocus({
      focusField(name, blockId) {
        editorRef.current?.focusField(name, blockId)
      },
    })
    return () => bindPaperFocus(null)
  }, [])
  useEffect(() => {
    dispatch({ type: "pages", pageChoice: pages.pageChoice })
  }, [pages])
  useEffect(() => {
    if (!state.printing) return
    return printPaper(state.name, () => dispatch({ type: "print", on: false }))
  }, [state.printing, state.name])
  useLayoutEffect(() => {
    if (!state.cv) return
    return bindPrintPageCount(() => {
      dispatch({
        type: "measured",
        pages: readPreviewPageCount(measureRef.current),
      })
    })
  }, [state.cv, state.templateId])
  useEffect(() => {
    const cv = state.cv
    if (!cv) return
    for (const check of state.checks) {
      if (check.resolved === true || dismissed.current.has(check.id)) continue
      const phone = check.kind === "phone" && cv.header.phone.trim() !== ""
      const dates = check.kind === "dates" && datesFilled(cv, check.blockId)
      if (!phone && !dates) continue
      dismissed.current.add(check.id)
      void run("paper.dismissCheck", { docId: initial.id, checkId: check.id })
        .then((saved) => dispatch({ type: "checks", checks: saved.checks }))
        .catch(reportRejected("dismiss this check"))
    }
  }, [state.cv, state.checks, initial.id, run])

  async function commitName() {
    const parsed = paperDocNameSchema.safeParse(state.name.trim())
    if (!parsed.success) {
      dispatch({
        type: "name_error",
        message: parsed.error.issues[0]?.message ?? "Name is required",
      })
      return
    }
    dispatch({ type: "name_ok" })
    if (parsed.data === initial.name) return
    try {
      await run("paper.rename", { docId: initial.id, name: parsed.data })
    } catch (error) {
      dispatch({
        type: "name_error",
        message:
          error instanceof Error
            ? error.message
            : "Could not rename. Try again.",
      })
    }
  }

  async function toggleFavorite() {
    if (state.favoritePending) return
    dispatch({ type: "favorite", pending: true })
    try {
      await run("paper.setFavorite", {
        docId: initial.id,
        isFavorite: !initial.isFavorite,
      })
    } catch (error) {
      toastError(error, "Could not update favorite. Try again.")
    } finally {
      dispatch({ type: "favorite", pending: false })
    }
  }

  async function keepPages() {
    try {
      await run("paper.keepTwoPages", { docId: initial.id })
      dispatch({ type: "pages", pageChoice: "keep" })
    } catch (error) {
      toastError(error, "Could not keep two pages. Try again.")
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
          if (tool === "paper.edit") syncRef.current?.poke()
        },
      })
    } catch (error) {
      toastError(error, "Could not ask Coach. Try again.")
    }
  }

  useEffect(() => {
    bindCvCoach(askCoach)
    return () => bindCvCoach(() => undefined)
  })

  function askCoach(text: string) {
    const paperName = (state.name || initial.name || "").trim()
    void createChat(queryClient, {
      title: paperName ? `About ${paperName}` : undefined,
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

  async function applyTemplate(templateId: PaperTemplateId) {
    try {
      const saved = await run("paper.setTemplate", {
        docId: initial.id,
        templateId,
      })
      dispatch({ type: "template", templateId: saved.templateId })
    } catch (error) {
      toastError(error, "Could not change the template. Try again.")
    }
  }

  async function skipCheck(checkId: string) {
    try {
      const saved = await run("paper.dismissCheck", {
        docId: initial.id,
        checkId,
      })
      dispatch({ type: "checks", checks: saved.checks })
    } catch (error) {
      reportRejected("dismiss this check")(error)
    }
  }

  const showBanner = state.previewPages > 1 && state.pageChoice === "unset"
  const source = state.cv
  const statusLabel = cvEditorStatus(status, state.editedAt, state.deferring)

  return (
    <section
      aria-label={`Editing ${initial.name}`}
      data-paper-editor=""
      data-pen-surface="paper"
      data-slot="cv-editor-page"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
      onKeyDownCapture={noteTyping}
    >
      <CvEditorBar
        name={state.name}
        favorite={initial.isFavorite}
        favoritePending={state.favoritePending}
        shareLink={shareLink}
        statusLabel={statusLabel}
        onBack={onBack}
        onName={(name) => dispatch({ type: "name", name })}
        onCommitName={() => void commitName()}
        onFavorite={() => void toggleFavorite()}
        onGallery={() => dispatch({ type: "gallery", open: true })}
        onPrint={() => dispatch({ type: "print", on: true })}
        onCoach={() => askCoach("")}
        onUndo={() => editorRef.current?.undo()}
      />
      <div
        data-slot="cv-editor-desk"
        className="relative flex min-h-0 flex-1 flex-col items-center overflow-auto"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute start-7 top-[72px] flex flex-col gap-2.5"
        >
          <span data-cv-outline="rest" className="h-0.5 w-3.5 rounded-[1px]" />
          <span
            data-cv-outline="active"
            className="h-0.5 w-[22px] rounded-[1px]"
          />
          <span data-cv-outline="rest" className="h-0.5 w-3.5 rounded-[1px]" />
          <span data-cv-outline="rest" className="h-0.5 w-3.5 rounded-[1px]" />
        </div>
        {showBanner ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Over one page</p>
              <p className="text-sm text-muted-foreground">
                Most hiring teams read one page. Coach can tighten it for you.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="h-11 md:h-7"
                onClick={() => void fitOnePage()}
              >
                Fit to one page
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 md:h-7"
                onClick={() => void keepPages()}
              >
                Keep 2 pages
              </Button>
            </div>
          </div>
        ) : null}
        <PaperCheckBar
          checks={state.checks}
          hidden={state.checksHidden}
          onAddPhone={focusPhoneField}
          onAddDates={focusDatesField}
          onSkip={(id) => void skipCheck(id)}
          onDone={() => dispatch({ type: "hide_checks" })}
        />
        {state.nameError ? (
          <p className="text-sm text-destructive">{state.nameError}</p>
        ) : null}
        <div
          data-paper-a4-fit="width"
          data-template={previewTemplate(state.templateId)}
          data-slot="cv-editor-sheet"
        >
          <CvPhotoFrame
            value={{
              docId: initial.id,
              afterPhoto: () => syncRef.current?.poke(),
            }}
          >
            <CvChromeContext.Provider
              value={{
                showPhoto: previewTemplate(state.templateId) === "with-photo",
                askCoach,
                seedName,
              }}
            >
              {client ? (
                <PaperEditorEngine
                  kind="cv"
                  client={client}
                  generation={generation}
                  label={`CV ${initial.name}`}
                  onDocument={onDocument}
                  onSelectedBlocks={onSelectedBlocks}
                  handleRef={editorRef}
                />
              ) : (
                <p
                  role="status"
                  className="px-8 py-14 text-sm text-muted-foreground"
                >
                  {status === "offline"
                    ? "Offline. Retrying to open this CV."
                    : status === "refused"
                      ? SYNC_LABEL.refused
                      : "Connecting"}
                </p>
              )}
            </CvChromeContext.Provider>
          </CvPhotoFrame>
        </div>
      </div>
      {source ? (
        <PaperPrintMeasure
          source={source}
          templateId={state.templateId}
          docId={initial.id}
          measureRef={measureRef}
        />
      ) : null}
      {state.printing && source ? (
        <PaperPrintSheet
          name={state.name}
          kind="cv"
          source={source}
          templateId={state.templateId}
          docId={initial.id}
        />
      ) : null}
      <Dialog
        open={state.galleryOpen}
        onOpenChange={(open) => dispatch({ type: "gallery", open })}
      >
        <DialogContent className={PAPER_GALLERY_DIALOG_CLASS}>
          <DialogHeader>
            <DialogTitle>Choose a template</DialogTitle>
            <DialogDescription>
              The open CV keeps its text and uses this layout.
            </DialogDescription>
          </DialogHeader>
          <PaperTemplateGallery
            onUse={(templateId) => void applyTemplate(templateId)}
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
