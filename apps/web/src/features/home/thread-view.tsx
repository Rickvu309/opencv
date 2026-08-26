import { useState } from "react"
import {
  Check,
  Copy,
  Link2,
  MoreHorizontal,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react"
import type { CoachUsageRating, ThreadToolPart } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { ComingSoon } from "@/components/coming-soon.tsx"
import { ErrorBanner } from "@/components/error-banner.tsx"
import { CoachMarkdown } from "@/features/home/coach-markdown.tsx"
import {
  receiptHeadline,
  receiptReversalNote,
  receiptShowsUndo,
} from "@/features/home/coach-receipt.ts"
import {
  STREAMING_COACH_ID,
  latestCoachMessageId,
  type HomeMessage,
} from "@/features/home/threads.ts"

const DISABLED_ACTIONS = [
  { label: "Copy link", icon: Link2 },
  { label: "More", icon: MoreHorizontal },
] as const

function CoachReceipt({
  part,
  canUndo,
  onUndo,
}: {
  part: ThreadToolPart
  canUndo: boolean
  onUndo?: () => Promise<void>
}) {
  const Icon = part.ok ? Check : X
  const note = receiptReversalNote(part)
  const [pending, setPending] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)

  async function undo() {
    if (!onUndo || pending) return
    setPending(true)
    setUndoError(null)
    try {
      await onUndo()
    } catch (error) {
      setUndoError(
        error instanceof Error ? error.message : "Couldn't undo this action"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      role="status"
      aria-label={part.ok ? "Command succeeded" : "Command failed"}
      className="min-w-0 max-w-full space-y-0.5 text-xs text-muted-foreground"
    >
      <p className="flex min-w-0 items-start gap-1.5">
        <Icon
          className={cn(
            "mt-0.5 size-3 shrink-0",
            part.ok ? "text-emerald-600" : "text-destructive"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
          {receiptHeadline(part)}
        </span>
      </p>
      {note ? (
        <p className="min-w-0 pl-5 break-words [overflow-wrap:anywhere]">
          {note}
        </p>
      ) : null}
      {canUndo ? (
        <div className="pl-5 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            aria-label="Undo"
            disabled={pending}
            onClick={() => void undo()}
          >
            {pending ? "Undoing…" : "Undo"}
          </Button>
        </div>
      ) : null}
      {undoError ? (
        <ErrorBanner variant="inline" className="pl-5">
          {undoError}
        </ErrorBanner>
      ) : null}
    </div>
  )
}

function CoachBody({
  message,
  canUndo,
  onUndo,
}: {
  message: HomeMessage
  canUndo: boolean
  onUndo?: (toolCallId: string) => Promise<void>
}) {
  if (message.parts && message.parts.length > 0) {
    return (
      <div className="min-w-0 space-y-2">
        {message.parts.map((part, index) =>
          part.type === "text" ? (
            <CoachMarkdown key={`text-${index}`} text={part.text} />
          ) : (
            <CoachReceipt
              key={part.toolCallId ?? `tool-${index}`}
              part={part}
              canUndo={canUndo && receiptShowsUndo(part)}
              onUndo={
                part.toolCallId && onUndo
                  ? () => onUndo(part.toolCallId!)
                  : undefined
              }
            />
          )
        )}
      </div>
    )
  }

  return <CoachMarkdown text={message.text} />
}

function MessageActions({
  text,
  rating,
  rateable,
  canRegenerate,
  onRate,
  onRegenerate,
}: {
  text: string
  rating?: CoachUsageRating | null
  rateable: boolean
  canRegenerate: boolean
  onRate?: (rating: CoachUsageRating) => void
  onRegenerate?: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Copy"
        aria-pressed={copied || undefined}
        onClick={() => void copy()}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Copy className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Good response"
        aria-pressed={rating === "up"}
        disabled={!rateable}
        onClick={() => onRate?.("up")}
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          rateable
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "text-muted-foreground opacity-40",
          rating === "up" && "text-foreground"
        )}
      >
        <ThumbsUp className={cn("size-3.5", rating === "up" && "fill-current")} />
      </button>
      <button
        type="button"
        aria-label="Bad response"
        aria-pressed={rating === "down"}
        disabled={!rateable}
        onClick={() => onRate?.("down")}
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          rateable
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "text-muted-foreground opacity-40",
          rating === "down" && "text-foreground"
        )}
      >
        <ThumbsDown
          className={cn("size-3.5", rating === "down" && "fill-current")}
        />
      </button>
      <button
        type="button"
        aria-label="Regenerate"
        disabled={!canRegenerate}
        onClick={() => onRegenerate?.()}
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          canRegenerate
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "text-muted-foreground opacity-40"
        )}
      >
        <RefreshCw className="size-3.5" />
      </button>
      {DISABLED_ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            type="button"
            disabled
            aria-label={action.label}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-40"
          >
            <Icon className="size-3.5" />
            <ComingSoon silent />
          </button>
        )
      })}
    </div>
  )
}

type Props = {
  messages: HomeMessage[]
  waiting?: boolean
  error?: string | null
  compact?: boolean
  onRetry?: () => void
  onRate?: (messageId: string, rating: CoachUsageRating) => void
  onRegenerate?: () => void
  onUndo?: (messageId: string, toolCallId: string) => Promise<void>
}

export function ThreadView({
  messages,
  waiting,
  error,
  compact,
  onRetry,
  onRate,
  onRegenerate,
  onUndo,
}: Props) {
  const latestCoachId = latestCoachMessageId(messages)
  return (
    <div
      role="log"
      aria-label="Thread"
      aria-live="polite"
      className={cn(
        compact
          ? "w-full space-y-4 px-0 py-0"
          : "mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8"
      )}
    >
      {messages.map((item) =>
        item.role === "user" ? (
          <div key={item.id} className="flex justify-end">
            <div className="max-w-[min(85%,28rem)] space-y-2">
              <div
                aria-invalid={item.failed || undefined}
                data-failed={item.failed ? "true" : undefined}
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  item.failed
                    ? "border border-destructive/40 bg-destructive/5"
                    : "bg-muted"
                )}
              >
                {item.text}
              </div>
              {item.failed && item.error ? (
                <div className="space-y-2 text-right">
                  <ErrorBanner variant="inline">{item.error}</ErrorBanner>
                  {onRetry ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                    >
                      Retry
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div key={item.id} className="space-y-2">
            {item.workedMs ? (
              <p className="text-xs text-muted-foreground">
                Worked for {Math.max(1, Math.round(item.workedMs / 1000))}s
              </p>
            ) : null}
            <CoachBody
              message={item}
              canUndo={
                !waiting &&
                item.id !== STREAMING_COACH_ID &&
                Boolean(onUndo)
              }
              onUndo={
                onUndo
                  ? (toolCallId) => onUndo(item.id, toolCallId)
                  : undefined
              }
            />
            {item.id !== STREAMING_COACH_ID ? (
              <MessageActions
                text={item.text}
                rating={item.rating}
                rateable={item.rating !== undefined}
                canRegenerate={
                  !waiting && Boolean(onRegenerate) && item.id === latestCoachId
                }
                onRate={
                  onRate ? (rating) => onRate(item.id, rating) : undefined
                }
                onRegenerate={onRegenerate}
              />
            ) : null}
          </div>
        )
      )}

      {error ? (
        <div className="space-y-2">
          <ErrorBanner variant="inline">{error}</ErrorBanner>
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {waiting ? (
        <div role="status" aria-label="Coach is working" className="space-y-2">
          <p className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            Working
            <span className="inline-flex gap-0.5" aria-hidden>
              <span className="animate-pulse">.</span>
              <span className="animate-pulse [animation-delay:150ms]">.</span>
              <span className="animate-pulse [animation-delay:300ms]">.</span>
            </span>
          </p>
        </div>
      ) : null}
    </div>
  )
}
