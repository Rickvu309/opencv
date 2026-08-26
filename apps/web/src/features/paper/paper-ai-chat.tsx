import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowUp, ChevronDown, Sparkles, Square, X } from "lucide-react"

import { ThreadView } from "@/features/home/thread-view.tsx"

import { usePaperCoach } from "./use-paper-coach.ts"

export type ToolbarVariant = "full" | "cv" | "proof" | "letter"

const QUICK_PROMPTS: Record<ToolbarVariant, string[]> = {
  cv: [
    "Sharpen my checkout project bullet",
    "Add a metric to outcome",
    "Tailor for associate PM intern",
    "What should I cut?",
  ],
  proof: [
    "Turn this note into an outcome",
    "What screenshot should I add?",
    "Link this to my CV",
  ],
  letter: [
    "Make opening stronger",
    "Tie in my checkout Proof",
    "Shorten to half page",
    "Fix tone — less stiff",
  ],
  full: ["Rewrite selection", "Fix spelling", "Make it shorter"],
}

const EMPTY_HINT: Record<ToolbarVariant, string> = {
  cv: "Ask about this CV. I can read it and run Commands — the same Coach as Home.",
  proof:
    "Ask about this Proof. I can read it and run Commands — the same Coach as Home.",
  letter:
    "Ask about this Letter. I can read it and run Commands — the same Coach as Home.",
  full: "Ask about this document. I can read it and run Commands — the same Coach as Home.",
}

type Props = {
  variant: ToolbarVariant
  docId: string
  contextLabel?: string
  prominent?: boolean
}

export function AiAssistChat({
  variant,
  docId,
  contextLabel,
  prominent,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState("")
  const { messages, phase, error, send, stop, retry, regenerate, rate } =
    usePaperCoach(docId, contextLabel ?? "Paper")
  const turnActive = phase !== "idle"

  useEffect(() => {
    setDraft("")
  }, [variant, docId])

  useLayoutEffect(() => {
    if (!open) {
      setMounted(false)
      return
    }

    function updatePosition() {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const panelWidth = 360
      const gap = 8
      let left = rect.left
      const maxLeft = window.innerWidth - panelWidth - gap
      if (left > maxLeft) left = Math.max(gap, maxLeft)
      setPos({ top: rect.bottom + gap, left })
      setMounted(true)
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (
        rootRef.current?.contains(target) ||
        target.closest("[data-ai-chat-panel]")
      ) {
        return
      }
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, phase, open, error])

  function submit(text?: string) {
    const t = (text ?? draft).trim()
    if (!t || turnActive) return
    if (send(t)) setDraft("")
  }

  const empty = messages.length === 0 && !turnActive && !error

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            data-ai-chat-panel
            role="dialog"
            aria-label="AI assist"
            className={cn(
              "fixed z-50 flex w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-opacity",
              mounted ? "opacity-100" : "opacity-0"
            )}
            style={{ top: pos.top, left: pos.left }}
          >
            <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <div className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
                <Sparkles className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">AI assist</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {contextLabel ?? "Paper"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            </header>

            <div
              ref={listRef}
              className="max-h-80 min-h-[12rem] flex-1 overflow-auto px-3 py-3"
            >
              {empty ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {EMPTY_HINT[variant]}
                </p>
              ) : (
                <ThreadView
                  compact
                  messages={messages}
                  waiting={phase === "waiting"}
                  error={error}
                  onRetry={retry}
                  onRate={rate}
                  onRegenerate={phase === "idle" ? regenerate : undefined}
                />
              )}
            </div>

            <div className="border-t border-border px-3 py-2">
              <div className="mb-2 flex flex-wrap gap-1">
                {QUICK_PROMPTS[variant].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => submit(chip)}
                    disabled={turnActive}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-1.5 rounded-full border border-border bg-background px-2 py-1.5">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      if (!turnActive) submit()
                    }
                  }}
                  placeholder="Ask about this document…"
                  rows={1}
                  className="max-h-20 min-h-6 flex-1 resize-none bg-transparent py-0.5 text-xs leading-5 outline-none placeholder:text-muted-foreground"
                  aria-label="Message AI assist"
                />
                {turnActive ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80"
                  >
                    <Square className="size-3 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => submit()}
                    disabled={!draft.trim()}
                    aria-label="Send"
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                      draft.trim()
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className="relative">
      {panel}
      <button
        ref={anchorRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
          open
            ? "bg-muted text-foreground ring-1 ring-ring/30"
            : prominent
              ? "bg-secondary text-secondary-foreground hover:bg-muted"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Sparkles className="size-3.5" />
        AI assist
        <ChevronDown
          className={cn(
            "size-3 opacity-60 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
    </div>
  )
}
