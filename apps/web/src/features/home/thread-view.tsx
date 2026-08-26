import { useEffect, useState } from "react"
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
import {
  CoachWorking,
  RECEIPT_ENTER_STAGGER_MS,
  UNDO_FLASH_MS,
} from "@/features/coach/coach-working.tsx"
import { CoachMarkdown } from "@/features/home/coach-markdown.tsx"
import {
  receiptHeadline,
  receiptReversalNote,
  receiptShowsUndo,
} from "@/features/home/coach-receipt.ts"
import { RichReceiptBody } from "@/features/home/rich-receipts.tsx"
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
  enter,
  enterDelayMs,
  announceUndone,
}: {
  part: ThreadToolPart
  canUndo: boolean
  onUndo?: () => Promise<void>
  enter?: boolean
  enterDelayMs?: number
  announceUndone?: boolean
}) {
  const Icon = part.ok ? Check : X
  const note = receiptReversalNote(part)
  const [pending, setPending] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)
  const collapsed = part.undone === true

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
      data-coach-receipt-enter={enter || undefined}
      data-coach-receipt-collapse={collapsed || undefined}
      className={cn(
        "min-w-0 max-w-full text-xs text-muted-foreground",
        enter && "coach-receipt-enter",
        collapsed && "coach-receipt-collapse"
      )}
      style={
        enter && enterDelayMs
          ? { animationDelay: `${enterDelayMs}ms` }
          : undefined
      }
    >
      <div
        className={cn(
          "min-w-0 space-y-0.5",
          collapsed && "coach-receipt-collapse-inner"
        )}
      >
        <p className="flex min-w-0 items-start gap-1.5">
          <Icon
            className={cn(
              "mt-0.5 size-3 shrink-0",
              part.ok ? "text-success" : "text-destructive"
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
            {receiptHeadline(part)}
          </span>
        </p>
        {announceUndone ? (
          <p
            className="coach-undone-flash pl-5 text-xs text-muted-foreground"
            data-slot="coach-undone"
          >
            Undone
          </p>
        ) : null}
        {part.ok && part.detail && !collapsed ? (
          <div className="min-w-0 pl-5">
            <RichReceiptBody detail={part.detail} />
          </div>
        ) : null}
        {note && !collapsed ? (
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
    </div>
  )
}

function CoachBody({
  message,
  canUndo,
  onUndo,
  animateEnter,
}: {
  message: HomeMessage
  canUndo: boolean
  onUndo?: (toolCallId: string) => Promise<void>
  animateEnter?: boolean
}) {
  const [undoneFlash, setUndoneFlash] = useState(false)

  useEffect(() => {
    if (!undoneFlash) return
    const timer = window.setTimeout(() => setUndoneFlash(false), UNDO_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [undoneFlash])

  if (message.parts && message.parts.length > 0) {
    const lastToolIndex = message.parts.reduce(
      (last, part, index) => (part.type === "tool" ? index : last),
      -1
    )
    return (
      <div className="min-w-0 space-y-2">
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return <CoachMarkdown key={`text-${index}`} text={part.text} />
          }
          const stagger = message.parts!.slice(0, index).filter(
            (item) => item.type === "tool"
          ).length
          return (
            <CoachReceipt
              key={part.toolCallId ?? `tool-${index}`}
              part={part}
              canUndo={canUndo && receiptShowsUndo(part)}
              enter={animateEnter && !part.undone}
              enterDelayMs={
                animateEnter ? stagger * RECEIPT_ENTER_STAGGER_MS : undefined
              }
              announceUndone={undoneFlash && index === lastToolIndex}
              onUndo={
                part.toolCallId && onUndo
                  ? async () => {
                      await onUndo(part.toolCallId!)
                      setUndoneFlash(true)
                    }
                  : undefined
              }
            />
          )
        })}
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
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Copy"
        aria-pressed={copied || undefined}
        onClick={() => void copy()}
        className="text-muted-foreground"
      >
        <Copy className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Good response"
        aria-pressed={rating === "up"}
        disabled={!rateable}
        onClick={() => onRate?.("up")}
        className={cn(
          "text-muted-foreground",
          rating === "up" && "text-foreground"
        )}
      >
        <ThumbsUp className={cn("size-3.5", rating === "up" && "fill-current")} />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Bad response"
        aria-pressed={rating === "down"}
        disabled={!rateable}
        onClick={() => onRate?.("down")}
        className={cn(
          "text-muted-foreground",
          rating === "down" && "text-foreground"
        )}
      >
        <ThumbsDown
          className={cn("size-3.5", rating === "down" && "fill-current")}
        />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Regenerate"
        disabled={!canRegenerate}
        onClick={() => onRegenerate?.()}
        className="text-muted-foreground"
      >
        <RefreshCw className="size-3.5" />
      </Button>
      {DISABLED_ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.label}
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled
            aria-label={action.label}
            className="text-muted-foreground"
          >
            <Icon className="size-3.5" />
            <ComingSoon silent />
          </Button>
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
          <div
            key={item.id}
            className={cn(
              "space-y-2",
              item.id === STREAMING_COACH_ID && "coach-text-enter"
            )}
            data-coach-text-enter={
              item.id === STREAMING_COACH_ID ? "true" : undefined
            }
          >
            {item.workedMs ? (
              <p className="text-xs text-muted-foreground">
                Worked for {Math.max(1, Math.round(item.workedMs / 1000))}s
              </p>
            ) : null}
            <CoachBody
              message={item}
              animateEnter={item.id === STREAMING_COACH_ID}
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

      {waiting ? <CoachWorking /> : null}
    </div>
  )
}
