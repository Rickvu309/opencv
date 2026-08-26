import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { CoachSelection } from "@workspace/domain"
import { Maximize2, Minus, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"
import { cn } from "@workspace/ui/lib/utils"

import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import { CoachDock } from "@/features/coach/coach-dock.tsx"
import { useCoachTurn } from "@/features/coach/use-coach-turn.ts"
import {
  getThreadByFocusDoc,
  threadQueryKeys,
} from "@/features/home/thread-api.ts"
import { ThreadView } from "@/features/home/thread-view.tsx"

import type { ToolbarVariant } from "./paper-editor-toolbar.tsx"

export const COACH_FLOAT_STORAGE_KEY = "openpath:paper:coach-float"

export type CoachFloatState = "closed" | "open" | "minimized"

const REWRITE_SELECTION = "Rewrite selection"

const QUICK_PROMPTS: Record<ToolbarVariant, string[]> = {
  cv: [
    REWRITE_SELECTION,
    "Sharpen my checkout project bullet",
    "Add a metric to outcome",
    "Tailor for associate PM intern",
    "What should I cut?",
  ],
  proof: [
    REWRITE_SELECTION,
    "Turn this note into an outcome",
    "What screenshot should I add?",
    "Link this to my CV",
  ],
  letter: [
    REWRITE_SELECTION,
    "Make opening stronger",
    "Tie in my checkout Proof",
    "Shorten to half page",
    "Fix tone — less stiff",
  ],
  full: [REWRITE_SELECTION, "Fix spelling", "Make it shorter"],
}

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
}

function readFloatState(): CoachFloatState {
  try {
    const value = localStorage.getItem(COACH_FLOAT_STORAGE_KEY)
    if (value === "closed" || value === "open" || value === "minimized") {
      return value
    }
  } catch {
    // Private mode / storage blocked.
  }
  return "closed"
}

function writeFloatState(state: CoachFloatState) {
  try {
    localStorage.setItem(COACH_FLOAT_STORAGE_KEY, state)
  } catch {
    // Private mode / storage blocked.
  }
}

function focusableIn(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => el.getAttribute("aria-disabled") !== "true"
  )
}

export function CoachFloat({ docId, docName, variant, selection }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef(false)
  const titleId = useId()
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [floatState, setFloatState] = useState<CoachFloatState>(readFloatState)
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)

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
      focusDocId: docId,
    })

  const turnActive = phase !== "idle"
  const showTranscript = messages.length > 0 || turnActive || Boolean(error)
  const headerTitle = focusedThreadQuery.data?.title ?? docName
  const mobileSheet = !isDesktop && floatState === "open"

  useEffect(() => {
    writeFloatState(floatState)
  }, [floatState])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, phase, error])

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

  function submit(text?: string) {
    const next = (text ?? draft).trim()
    if (!next || turnActive) return
    if (send(next, { selection: selection ?? undefined })) setDraft("")
  }

  function open() {
    setFloatState("open")
  }

  function minimize() {
    setFloatState("minimized")
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
        <p
          id={titleId}
          className="min-w-0 flex-1 truncate text-sm font-medium"
        >
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
      {floatState === "open" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pt-2 pb-3">
          {showTranscript ? (
            <div ref={listRef} className="min-h-0 flex-1 overflow-auto">
              <ThreadView
                compact
                messages={messages}
                waiting={phase === "waiting"}
                error={error}
                onRetry={retry}
                onRate={rate}
                onRegenerate={phase === "idle" ? regenerate : undefined}
                onUndo={phase === "idle" ? undo : undefined}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {QUICK_PROMPTS[variant].map((chip) => {
                const needsSelection = chip === REWRITE_SELECTION
                const disabled =
                  turnActive || (needsSelection && !selection?.text)
                return (
                  <Button
                    key={chip}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => submit(chip)}
                    disabled={disabled}
                    className="h-auto rounded-full px-2 py-0.5 text-2xs text-muted-foreground"
                  >
                    {chip}
                  </Button>
                )
              })}
            </div>
          )}
          <CoachDock
            draft={draft}
            setDraft={setDraft}
            onSend={() => submit()}
            onStop={stop}
            turnActive={turnActive}
            placeholder="Ask about this document…"
            menuPlacement="above"
            showModePicker={false}
          />
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
          aria-labelledby={titleId}
          tabIndex={-1}
          data-coach-float-state={floatState}
          className={cn(
            "coach-float-card z-popover flex flex-col border border-border bg-popover text-popover-foreground shadow-lg",
            mobileSheet
              ? "fixed inset-x-0 top-6 bottom-0 rounded-t-xl"
              : cn(
                  "fixed right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))]",
                  floatState === "open"
                    ? "max-h-[min(32rem,70vh)] rounded-xl"
                    : "rounded-xl"
                )
          )}
        >
          {chrome}
        </div>
      </>
    )

  return createPortal(ui, document.body)
}
