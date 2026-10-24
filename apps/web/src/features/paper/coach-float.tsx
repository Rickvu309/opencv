import { useQuery } from "@tanstack/react-query"
import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import type { CoachSelection } from "@workspace/domain"
import { X } from "lucide-react"

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

export type CoachFloatState = "closed" | "open"

const CoachThreadPanel = lazy(() =>
  import("@/features/coach/coach-thread-panel.tsx").then((m) => ({
    default: m.CoachThreadPanel,
  }))
)

type Props = {
  docId: string
  docName: string
  variant: ToolbarVariant
  selection?: CoachSelection | null
  onClearSelection?: () => void
  citeSpans?: readonly PaperCiteSpan[]
  onCitePaper?: (sectionId: string) => void
  dock?: HTMLElement | null
  onDockedChange?: (docked: boolean) => void
}

function parseFloatState(raw: string | null): CoachFloatState {
  return raw === "open" ? "open" : "closed"
}

export const CoachFloat = memo(function CoachFloat({
  docId,
  docName,
  variant,
  selection,
  onClearSelection,
  citeSpans = [],
  onCitePaper,
  dock = null,
  onDockedChange,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef(false)
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null)
  const [floatState, setFloatState] = useState<CoachFloatState>(() =>
    readStored(COACH_FLOAT_STORAGE_KEY, parseFloatState, "closed")
  )
  const [softScope, setSoftScope] = useState(true)
  const [contextChips, setContextChips] = useState<CoachContextChip[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  const docked = floatState === "open" && dock !== null
  useEffect(() => {
    onDockedChange?.(docked)
  }, [docked, onDockedChange])
  const focusDocId = focusDocIdForTurn(softScope, contextChips, docId)

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
      if (!isDesktop) setFloatState("closed")
    },
    [isDesktop, onCitePaper]
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

  useEffect(() => {
    writeStored(COACH_FLOAT_STORAGE_KEY, floatState)
  }, [floatState])

  useEffect(() => {
    if (floatState === "open" && !isDesktop) dialogRef.current?.focus()
  }, [floatState, isDesktop])

  useEffect(() => {
    if (floatState !== "closed" || !returnFocusRef.current) return
    returnFocusRef.current = false
    const pill = document.querySelector<HTMLElement>("[data-coach-float-pill]")
    pill?.focus()
  }, [floatState])

  useEffect(() => {
    if (floatState === "closed") return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      returnFocusRef.current = true
      setFloatState("closed")
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [floatState])

  function submit(text: string) {
    const next = text.trim()
    if (!next || turnActive) return
    sendWithSelection(next)
  }

  function open() {
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
          className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 pt-1.5 pb-2"
        >
          {selection?.text ? (
            <div
              data-coach-selection-preview
              role="status"
              aria-label="Selected text"
              className="flex items-start gap-1 rounded-lg bg-muted/70 px-2 py-1.5 text-xs text-muted-foreground"
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
                className="h-auto shrink-0 rounded-full px-2 py-0.5 text-xs"
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
              placeholder="Ask the Coach"
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
        className="coach-float-card fixed right-4 bottom-4 z-50 rounded-full px-3 shadow-md"
      >
        Coach
      </Button>
    ) : (
      <>
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Coach"
          tabIndex={-1}
          data-coach-float-card
          data-coach-float-state={floatState}
          className={cn(
            "coach-float-card z-50 flex flex-col border border-border bg-popover text-popover-foreground shadow-lg",
            docked
              ? "h-full w-full border-0 border-l shadow-none"
              : "fixed right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))] rounded-xl"
          )}
        >
          {chrome}
        </div>
      </>
    )

  return createPortal(ui, docked && dock ? dock : document.body)
})
