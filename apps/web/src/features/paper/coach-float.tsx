import { useQuery } from "@tanstack/react-query"
import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import type { CoachSelection } from "@workspace/domain"
import { Maximize2, Minus, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"
import { cn } from "@workspace/ui/lib/utils"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import { useCoachTurn } from "@/features/coach/use-coach-turn.ts"
import { readStored, writeStored } from "@/lib/local-storage.ts"
import {
  getThreadByFocusDoc,
  threadQueryKeys,
} from "@/features/home/thread-api.ts"

import {
  ATTACH_FROM_PAPER_FAIL,
  addDocChip,
  addSelectionChip,
  consumeUnpinnedContextChips,
  focusDocIdForTurn,
  hasMatchingSelectionChip,
  removeContextChip,
  selectionForTurn,
  toggleContextChipPin,
  type CoachContextChip,
} from "./coach-context-chips.ts"
import {
  DurableContextChip,
  QUICK_PROMPTS,
  QuickPromptChips,
  REWRITE_SELECTION,
  SoftScopeChip,
} from "./coach-float-chips.tsx"
import { PaperCiteControl } from "./paper-cite-control.tsx"
import {
  rememberCoachCites,
  type PaperCite,
  type PaperCiteSpan,
  type StoredCoachCites,
} from "./paper-cite.ts"
import { previewCoachSelectionText } from "./paper-selection.ts"
import type { ToolbarVariant } from "./paper-editor-toolbar.tsx"

export const COACH_FLOAT_STORAGE_KEY = "opencv:paper:coach-float"
export const COACH_FLOAT_NUDGE_ATTR = "data-coach-float-nudge"
export const COACH_FLOAT_DESKTOP_OPEN_HEIGHT_CLASS = "max-h-[min(22rem,42vh)]"

export type CoachFloatState = "closed" | "open" | "minimized"

const CoachThreadPanel = lazy(() =>
  import("@/features/coach/coach-thread-panel.tsx").then((m) => ({
    default: m.CoachThreadPanel,
  }))
)

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

type Props = {
  docId: string
  docName: string
  variant: ToolbarVariant
  selection?: CoachSelection | null
  onClearSelection?: () => void
  citeSpans?: readonly PaperCiteSpan[]
  onCitePaper?: (sectionId: string) => void
}

function parseFloatState(raw: string | null): CoachFloatState {
  return raw === "open" || raw === "minimized" ? raw : "closed"
}

function focusableIn(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => el.getAttribute("aria-disabled") !== "true"
  )
}

function isPaperDocumentSurface(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (target.closest("[data-coach-float-card], [data-coach-float-pill]")) {
    return false
  }
  return Boolean(
    target.closest("[data-paper-section], .cv-a4-page, .paper-editor-canvas")
  )
}

function threadViewportIn(root: HTMLElement | null) {
  return (
    root?.querySelector<HTMLElement>("[data-coach-thread-viewport]") ?? null
  )
}

export const CoachFloat = memo(function CoachFloat({
  docId,
  docName,
  variant,
  selection,
  onClearSelection,
  citeSpans = [],
  onCitePaper,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef(false)
  const threadScrollRef = useRef(0)
  const restoreThreadScrollRef = useRef(false)
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null)
  const [floatState, setFloatState] = useState<CoachFloatState>(() =>
    readStored(COACH_FLOAT_STORAGE_KEY, parseFloatState, "closed")
  )
  const [softScope, setSoftScope] = useState(true)
  const [contextChips, setContextChips] = useState<CoachContextChip[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  const focusDocId = focusDocIdForTurn(softScope, contextChips, docId)

  const captureThreadScroll = useCallback(() => {
    const viewport = threadViewportIn(dialogRef.current)
    if (viewport) threadScrollRef.current = viewport.scrollTop
  }, [])

  const applyMinimized = useCallback(() => {
    captureThreadScroll()
    restoreThreadScrollRef.current = true
    setFloatState("minimized")
  }, [captureThreadScroll])

  const focusedThreadQuery = useQuery({
    queryKey: threadQueryKeys.byFocusDoc(docId),
    queryFn: () => getThreadByFocusDoc(docId),
    staleTime: Infinity,
  })

  const threadId = createdThreadId ?? focusedThreadQuery.data?.id ?? null
  const titleForCreate = useCallback(() => docName, [docName])
  const { messages, phase, error, send, stop, retry, regenerate, rate, undo } =
    useCoachTurn({
      threadId,
      setThreadId: setCreatedThreadId,
      titleForCreate,
      focusDocId,
    })

  const lastTurnRef = useRef<{
    selection?: CoachSelection
    chips: CoachContextChip[]
  } | null>(null)
  const [citesByMessageId, setCitesByMessageId] = useState<StoredCoachCites>({})

  const sendWithSelection = useCallback(
    (text: string) => {
      const turnSelection = selectionForTurn(contextChips, selection)
      lastTurnRef.current = {
        selection: turnSelection,
        chips: contextChips,
      }
      const sent = send(text, {
        selection: turnSelection,
      })
      if (sent) setContextChips(consumeUnpinnedContextChips)
      return sent
    },
    [contextChips, selection, send]
  )

  useEffect(() => {
    setCitesByMessageId((prev) =>
      rememberCoachCites(prev, messages, citeSpans, lastTurnRef.current)
    )
  }, [citeSpans, messages])

  const citePaper = useCallback(
    (cite: PaperCite) => {
      onCitePaper?.(cite.sectionId)
      if (!isDesktop && floatState === "open") applyMinimized()
    },
    [applyMinimized, floatState, isDesktop, onCitePaper]
  )

  const messageCite = useCallback(
    (message: (typeof messages)[number]) => {
      const cite = citesByMessageId[message.id]
      if (!cite || !onCitePaper) return null
      return <PaperCiteControl cite={cite} onCite={citePaper} />
    },
    [citePaper, citesByMessageId, onCitePaper]
  )

  const addSelectionToContext = useCallback(() => {
    if (!selection?.text) return
    setContextChips((prev) => addSelectionChip(prev, selection))
  }, [selection])

  const attachFromPaper = useCallback(() => {
    if (!docId.trim()) {
      setAttachError(ATTACH_FROM_PAPER_FAIL)
      return
    }
    setAttachError(null)
    setContextChips((prev) => {
      const result = addDocChip(prev, docId, docName)
      return result.ok ? result.chips : prev
    })
  }, [docId, docName])

  const turnActive = phase !== "idle"
  const headerTitle = focusedThreadQuery.data?.title ?? docName
  const mobileSheet = !isDesktop && floatState === "open"

  useEffect(() => {
    writeStored(COACH_FLOAT_STORAGE_KEY, floatState)
  }, [floatState])

  useEffect(() => {
    const canvas = document.querySelector("[data-paper-canvas]")
    if (!(canvas instanceof HTMLElement)) return
    const shouldNudge = isDesktop && floatState === "open"
    if (shouldNudge) canvas.setAttribute(COACH_FLOAT_NUDGE_ATTR, "")
    else canvas.removeAttribute(COACH_FLOAT_NUDGE_ATTR)
    return () => canvas.removeAttribute(COACH_FLOAT_NUDGE_ATTR)
  }, [floatState, isDesktop])

  useEffect(() => {
    if (floatState !== "open" || !isDesktop) return

    function onDocumentIntent(event: Event) {
      if (!isPaperDocumentSurface(event.target)) return
      applyMinimized()
    }

    document.addEventListener("pointerdown", onDocumentIntent)
    document.addEventListener("focusin", onDocumentIntent)
    return () => {
      document.removeEventListener("pointerdown", onDocumentIntent)
      document.removeEventListener("focusin", onDocumentIntent)
    }
  }, [applyMinimized, floatState, isDesktop])

  useLayoutEffect(() => {
    if (floatState !== "open" || !restoreThreadScrollRef.current) return
    restoreThreadScrollRef.current = false
    const viewport = threadViewportIn(dialogRef.current)
    if (viewport) viewport.scrollTop = threadScrollRef.current
  }, [floatState])

  useEffect(() => {
    if (floatState !== "closed" || !returnFocusRef.current) return
    returnFocusRef.current = false
    const pill = document.querySelector<HTMLElement>("[data-coach-float-pill]")
    pill?.focus()
  }, [floatState])

  useEffect(() => {
    if (!mobileSheet) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileSheet])

  useEffect(() => {
    if (floatState === "closed") return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        returnFocusRef.current = true
        setFloatState("closed")
        return
      }

      if (!mobileSheet || event.key !== "Tab") return
      const root = dialogRef.current
      if (!root) return
      const nodes = focusableIn(root)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault()
          last?.focus()
        }
        return
      }
      if (active === last || !root.contains(active)) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [floatState, mobileSheet])

  useEffect(() => {
    if (!mobileSheet) return
    const root = dialogRef.current
    if (!root) return
    const first = focusableIn(root)[0]
    first?.focus()
  }, [mobileSheet])

  function submit(text: string) {
    const next = text.trim()
    if (!next || turnActive) return
    sendWithSelection(next)
  }

  function open() {
    setFloatState("open")
  }

  function minimize() {
    applyMinimized()
  }

  function restore() {
    setFloatState("open")
  }

  function close() {
    returnFocusRef.current = true
    setFloatState("closed")
  }

  const chrome = (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {headerTitle}
        </p>
        {floatState === "minimized" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Restore"
            onClick={restore}
          >
            <Maximize2 />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Minimize"
            onClick={minimize}
          >
            <Minus />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close"
          onClick={close}
        >
          <X />
        </Button>
      </div>
      {floatState !== "closed" ? (
        <div
          data-coach-float-thread
          hidden={floatState !== "open"}
          inert={floatState !== "open" ? true : undefined}
          className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 pt-1.5 pb-2"
        >
          {selection?.text ? (
            <div
              data-coach-selection-preview
              role="status"
              aria-label="Selected text"
              className="flex items-start gap-1 rounded-lg bg-muted/70 px-2 py-1.5 text-2xs text-muted-foreground"
            >
              <p className="min-w-0 flex-1 text-pretty">
                “{previewCoachSelectionText(selection.text)}”
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label="Add to context"
                disabled={hasMatchingSelectionChip(contextChips, selection)}
                onClick={addSelectionToContext}
                className="h-auto shrink-0 rounded-full px-2 py-0.5 text-2xs"
              >
                {hasMatchingSelectionChip(contextChips, selection)
                  ? "Added"
                  : "Add to context"}
              </Button>
              {onClearSelection ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Clear selection"
                  onClick={onClearSelection}
                >
                  <X />
                </Button>
              ) : null}
            </div>
          ) : null}
          <Suspense
            fallback={
              <div
                data-coach-thread-loading
                className="flex flex-1 flex-col gap-2 pt-1"
              >
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            }
          >
            <CoachThreadPanel
              turn={{
                messages,
                phase,
                send: sendWithSelection,
                stop,
                regenerate,
                rate,
              }}
              messages={messages}
              waiting={phase === "waiting"}
              turnActive={turnActive}
              error={error}
              send={sendWithSelection}
              stop={stop}
              onRetry={retry}
              onRate={rate}
              onRegenerate={phase === "idle" ? regenerate : undefined}
              onUndo={phase === "idle" ? undo : undefined}
              onAttachFromPaper={attachFromPaper}
              messageCite={onCitePaper ? messageCite : undefined}
              placeholder="Ask about this document…"
              empty={
                <QuickPromptChips
                  chips={QUICK_PROMPTS[variant]}
                  turnActive={turnActive}
                  hasSelection={Boolean(selection?.text)}
                  onSubmit={submit}
                />
              }
              beforeComposer={
                softScope ||
                contextChips.length > 0 ||
                attachError ||
                (messages.length > 0 && selection?.text) ? (
                  <>
                    {softScope || contextChips.length > 0 ? (
                      <div
                        data-coach-context-chips
                        className="flex flex-wrap gap-1"
                      >
                        {softScope ? (
                          <SoftScopeChip
                            docName={docName}
                            onRemove={() => setSoftScope(false)}
                          />
                        ) : null}
                        {contextChips.map((chip) => (
                          <DurableContextChip
                            key={chip.id}
                            chip={chip}
                            onPin={() =>
                              setContextChips((prev) =>
                                toggleContextChipPin(prev, chip.id)
                              )
                            }
                            onRemove={() =>
                              setContextChips((prev) =>
                                removeContextChip(prev, chip.id)
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                    {attachError ? (
                      <ErrorBanner variant="inline">{attachError}</ErrorBanner>
                    ) : null}
                    {messages.length > 0 && selection?.text ? (
                      <QuickPromptChips
                        chips={[REWRITE_SELECTION]}
                        turnActive={turnActive}
                        hasSelection
                        onSubmit={submit}
                      />
                    ) : null}
                  </>
                ) : null
              }
            />
          </Suspense>
        </div>
      ) : null}
    </>
  )

  const ui =
    floatState === "closed" ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-coach-float-pill
        aria-haspopup="dialog"
        aria-expanded={false}
        onClick={open}
        className="coach-float-card fixed right-4 bottom-4 z-popover rounded-full px-3 shadow-md"
      >
        Coach
      </Button>
    ) : (
      <>
        {mobileSheet ? (
          <div
            data-coach-float-backdrop
            aria-hidden
            className="coach-float-backdrop fixed inset-0 z-overlay bg-foreground/20"
            onClick={close}
          />
        ) : null}
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Coach"
          aria-modal={mobileSheet || undefined}
          tabIndex={-1}
          data-coach-float-card
          data-coach-float-state={floatState}
          className={cn(
            "coach-float-card z-popover flex flex-col border border-border bg-popover text-popover-foreground shadow-lg",
            mobileSheet
              ? "fixed inset-x-0 top-6 bottom-0 rounded-t-xl"
              : cn(
                  "fixed right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))]",
                  floatState === "open"
                    ? cn(COACH_FLOAT_DESKTOP_OPEN_HEIGHT_CLASS, "rounded-xl")
                    : "rounded-xl"
                )
          )}
        >
          {chrome}
        </div>
      </>
    )

  return createPortal(ui, document.body)
})
