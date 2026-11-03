import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Bell, Ellipsis, LayoutTemplate, Link2, Star } from "lucide-react"
import {
  cvPrintModel,
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { CopyButton } from "@workspace/ui/components/copy-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderLeading,
  PageHeaderMeta,
} from "@workspace/ui/components/page-header"
import { toast } from "@workspace/ui/components/sonner"

import { createChat } from "@/features/coach/chat-api.ts"
import { useChatStore } from "@/features/coach/use-chat-store.ts"
import { reportRejected } from "@/lib/command-failure.ts"
import { publishCoachDraft } from "@/lib/coach-draft.ts"
import { useRunCommand } from "@/lib/contract-client.ts"
import { setPaperSelection } from "@/lib/paper-selection.ts"
import { SYNC_LABEL, usePaperSync } from "@/lib/paper-sync.ts"

import { CvChromeContext } from "./cv-blocks.tsx"
import { CvA4Canvas } from "./paper-cv-a4.tsx"
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
import {
  editorEditedLabel,
  previewTemplate,
  printLayout,
} from "./paper-templates.ts"

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
  }
}

function toastError(error: unknown, fallback: string) {
  toast(error instanceof Error ? error.message : fallback)
}

function printable(cv: CvPaper, templateId: string | null) {
  const model = cvPrintModel(cv, printLayout(templateId))
  return {
    templateId: model.templateId,
    name: model.name,
    headline: model.headline,
    contact: model.contact,
    summary: model.summary,
    experience: model.experience,
    education: model.education,
    skills: model.skills,
    projects: model.projects,
    languages: model.languages,
    ...(model.photoUrl ? { photoUrl: model.photoUrl } : {}),
  }
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
}: {
  initial: PaperView
  pages: PaperPages
  onBack: () => void
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
    cv: null,
  })
  useEffect(() => {
    syncRef.current = sync
  }, [sync])
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
  const source = state.cv ? printable(state.cv, state.templateId) : null
  const sections =
    state.cv?.blocks.filter((block) => block.type === "section") ?? []
  const statusLabel =
    status === "saved" || status === "loading"
      ? editorEditedLabel(state.editedAt)
      : SYNC_LABEL[status]

  return (
    <section
      aria-label={`Editing ${initial.name}`}
      data-slot="cv-editor-page"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <PageHeader>
        <PageHeaderLeading>
          <PageHeaderBack
            href="/paper"
            onClick={(event) => {
              event.preventDefault()
              onBack()
            }}
          >
            Paper
          </PageHeaderBack>
        </PageHeaderLeading>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/paper"
                onClick={(event) => {
                  event.preventDefault()
                  onBack()
                }}
              >
                Paper
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>CVs</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Input
                aria-label="Document name"
                value={state.name}
                onChange={(event) =>
                  dispatch({ type: "name", name: event.target.value })
                }
                onBlur={() => void commitName()}
                className="h-11 border-transparent bg-transparent shadow-none md:h-7"
              />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeaderMeta>{statusLabel}</PageHeaderMeta>
        <PageHeaderActions>
          <PageHeaderAction
            label="Favorite"
            pressed={initial.isFavorite}
            disabled={state.favoritePending}
            onSelect={() => void toggleFavorite()}
            icon={
              <Star
                className={initial.isFavorite ? "fill-current" : undefined}
              />
            }
          />
          <CopyButton
            value={shareLink}
            copiedMessage="Link copied"
            errorMessage={(error) =>
              error instanceof Error
                ? error.message
                : "Could not copy the link. Try again."
            }
            aria-label="Copy link"
            className="size-11 md:size-7"
          >
            <Link2 className="size-4" />
          </CopyButton>
          <PageHeaderAction
            label="Change template"
            icon={<LayoutTemplate />}
            onSelect={() => dispatch({ type: "gallery", open: true })}
          />
          <PageHeaderAction
            label="More"
            icon={<Ellipsis />}
            onSelect={() => dispatch({ type: "print", on: true })}
          />
          <PageHeaderAction
            label="Notifications"
            icon={<Bell />}
            onSelect={() => toast("Notifications are not on yet.")}
          />
        </PageHeaderActions>
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-11 md:h-7"
            onClick={() => askCoach("")}
          >
            Coach
          </Button>
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
                variant="glow"
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
        <div className="flex min-w-0 gap-4">
          <nav
            aria-label="Outline"
            className="hidden w-36 shrink-0 flex-col gap-1 md:flex"
          >
            <Button
              type="button"
              variant="ghost"
              className="h-11 justify-start md:h-7"
              onClick={() => editorRef.current?.focusBlock("header")}
            >
              Header
            </Button>
            {sections.map((block) => (
              <Button
                key={block.id}
                type="button"
                variant="ghost"
                className="h-11 justify-start md:h-7"
                onClick={() => editorRef.current?.focusBlock(block.id)}
              >
                {block.title || "Section"}
              </Button>
            ))}
          </nav>
          <div
            data-template={previewTemplate(state.templateId)}
            className="min-w-0 flex-1"
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
                }}
              >
                <CvA4Canvas>
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
                </CvA4Canvas>
              </CvChromeContext.Provider>
            </CvPhotoFrame>
          </div>
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
