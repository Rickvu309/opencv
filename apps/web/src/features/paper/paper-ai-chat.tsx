import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Textarea } from "@workspace/ui/components/textarea"
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
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const { messages, phase, error, send, stop, retry, regenerate, rate, undo } =
    usePaperCoach(docId, contextLabel ?? "Paper")
  const turnActive = phase !== "idle"

  useEffect(() => {
    setDraft("")
  }, [variant, docId])

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant={prominent ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-medium",
              !prominent && "text-muted-foreground"
            )}
          />
        }
        onMouseDown={(e) => e.preventDefault()}
        aria-haspopup="dialog"
      >
        <Sparkles className="size-3.5" />
        AI assist
        <ChevronDown
          className={cn(
            "size-3 opacity-60 transition-transform",
            open && "rotate-180"
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[360px] gap-0 overflow-hidden p-0"
        data-ai-chat-panel
        role="dialog"
        aria-label="AI assist"
      >
        <div className="flex w-full flex-col">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
              <Sparkles className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">AI assist</p>
              <p className="truncate text-2xs text-muted-foreground">
                {contextLabel ?? "Paper"}
              </p>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-muted-foreground"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </Button>
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
                onUndo={phase === "idle" ? undo : undefined}
              />
            )}
          </div>

          <div className="border-t border-border px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-1">
              {QUICK_PROMPTS[variant].map((chip) => (
                <Button
                  key={chip}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => submit(chip)}
                  disabled={turnActive}
                  className="h-auto rounded-full px-2 py-0.5 text-2xs text-muted-foreground"
                >
                  {chip}
                </Button>
              ))}
            </div>
            <div className="flex items-end gap-1.5 rounded-full border border-border bg-background px-2 py-1.5">
              <Textarea
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
                className="max-h-20 min-h-6 flex-1 resize-none border-0 bg-transparent px-0 py-0.5 text-xs leading-5 shadow-none focus-visible:border-0 focus-visible:ring-0"
                aria-label="Message AI assist"
              />
              {turnActive ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  onClick={stop}
                  aria-label="Stop"
                  className="rounded-full"
                >
                  <Square className="size-3 fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon-sm"
                  variant={draft.trim() ? "default" : "secondary"}
                  onClick={() => submit()}
                  disabled={!draft.trim()}
                  aria-label="Send"
                  className="rounded-full"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
