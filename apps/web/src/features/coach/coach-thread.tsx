import { createContext, useContext, useState, type ReactNode } from "react"
import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  type DataMessagePart,
} from "@assistant-ui/react"
import {
  Copy,
  Link2,
  MoreHorizontal,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import type { CoachUsageRating, ThreadToolPart } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { ComingSoon } from "@/components/coming-soon.tsx"
import { ErrorBanner } from "@/components/error-banner.tsx"
import { CoachMarkdown } from "@/features/home/coach-markdown.tsx"
import { receiptShowsUndo } from "@/features/home/coach-receipt.ts"
import {
  STREAMING_COACH_ID,
  type HomeMessage,
} from "@/features/home/threads.ts"
import { useFlash } from "@/lib/use-flash.ts"

import { RECEIPT_PART_NAME } from "./coach-runtime.ts"
import { CoachDock } from "./coach-dock.tsx"
import { CoachToolLine } from "./coach-tool-line.tsx"
import {
  CoachWorking,
  RECEIPT_ENTER_STAGGER_MS,
  UNDO_FLASH_MS,
} from "./coach-working.tsx"

const DISABLED_ACTIONS = [
  { label: "Copy link", icon: Link2 },
  { label: "More", icon: MoreHorizontal },
] as const

type CoachThreadActions = {
  messages: readonly HomeMessage[]
  waiting: boolean
  error: string | null
  turnActive: boolean
  placeholder: string
  send: (text: string) => boolean
  stop: () => void
  onRetry?: () => void
  onRate?: (messageId: string, rating: CoachUsageRating) => void
  onRegenerate?: () => void
  onUndo?: (messageId: string, toolCallId: string) => Promise<void>
  onAttachFromPaper?: () => void
  messageCite?: (message: HomeMessage) => ReactNode
}

const CoachThreadActionsContext = createContext<CoachThreadActions | null>(null)

function useThreadActions() {
  const actions = useContext(CoachThreadActionsContext)
  if (!actions) {
    throw new Error("CoachThread actions are missing")
  }
  return actions
}

function useBoundHomeMessage() {
  const { messages } = useThreadActions()
  const id = useAuiState((state) => state.optional.message?.id)
  return messages.find((message) => message.id === id)
}

function ReceiptPart({ data }: DataMessagePart<ThreadToolPart>) {
  const { waiting, onUndo } = useThreadActions()
  const message = useBoundHomeMessage()
  const [undoneFlash, flashUndone] = useFlash(UNDO_FLASH_MS)

  const stagger = (message?.parts ?? [])
    .filter((part) => part.type === "tool")
    .findIndex((part) => part === data || part.toolCallId === data.toolCallId)
  const lastTool = [...(message?.parts ?? [])]
    .reverse()
    .find((part) => part.type === "tool")
  const streaming = message?.id === STREAMING_COACH_ID
  const canUndo =
    Boolean(message) &&
    !waiting &&
    !streaming &&
    Boolean(onUndo) &&
    receiptShowsUndo(data)

  return (
    <CoachToolLine
      part={data}
      canUndo={canUndo}
      enter={streaming && !data.undone}
      enterDelayMs={
        streaming && stagger >= 0
          ? stagger * RECEIPT_ENTER_STAGGER_MS
          : undefined
      }
      announceUndone={undoneFlash && lastTool?.toolCallId === data.toolCallId}
      onUndo={
        message && data.toolCallId && onUndo
          ? async () => {
              await onUndo(message.id, data.toolCallId!)
              flashUndone()
            }
          : undefined
      }
    />
  )
}

function MessageActions({ message }: { message: HomeMessage }) {
  const { waiting, onRate, onRegenerate } = useThreadActions()
  const isLast = useAuiState((state) => state.optional.message?.isLast === true)
  const [copied, flashCopied] = useFlash(2000)
  const rateable = message.rating !== undefined
  const canRegenerate = !waiting && Boolean(onRegenerate) && isLast

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.text)
      flashCopied()
    } catch {
      // Clipboard denied: leave the button unpressed.
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
        aria-pressed={message.rating === "up"}
        disabled={!rateable}
        onClick={() => onRate?.(message.id, "up")}
        className={cn(
          "text-muted-foreground",
          message.rating === "up" && "text-foreground"
        )}
      >
        <ThumbsUp
          className={cn("size-3.5", message.rating === "up" && "fill-current")}
        />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Bad response"
        aria-pressed={message.rating === "down"}
        disabled={!rateable}
        onClick={() => onRate?.(message.id, "down")}
        className={cn(
          "text-muted-foreground",
          message.rating === "down" && "text-foreground"
        )}
      >
        <ThumbsDown
          className={cn(
            "size-3.5",
            message.rating === "down" && "fill-current"
          )}
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

function UserMessage() {
  const { onRetry } = useThreadActions()
  const message = useBoundHomeMessage()

  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[min(85%,28rem)] space-y-2">
        <div
          aria-invalid={message?.failed || undefined}
          data-failed={message?.failed ? "true" : undefined}
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            message?.failed
              ? "border border-destructive/40 bg-destructive/5"
              : "bg-muted"
          )}
        >
          <MessagePrimitive.Parts
            components={{
              Text: ({ text }) => <>{text}</>,
            }}
          />
        </div>
        {message?.failed && message.error ? (
          <div className="space-y-2 text-right">
            <ErrorBanner variant="inline">{message.error}</ErrorBanner>
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
    </MessagePrimitive.Root>
  )
}

function CoachBoundBody({ message }: { message: HomeMessage }) {
  const { waiting, onUndo } = useThreadActions()
  const streaming = message.id === STREAMING_COACH_ID
  const [undoneFlash, flashUndone] = useFlash(UNDO_FLASH_MS)

  if (!message.parts?.length) {
    if (streaming || !message.text) return <CoachWorking />
    return <CoachMarkdown text={message.text} />
  }

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
        const stagger = message
          .parts!.slice(0, index)
          .filter((item) => item.type === "tool").length
        return (
          <CoachToolLine
            key={part.toolCallId ?? `tool-${index}`}
            part={part}
            canUndo={
              !waiting &&
              !streaming &&
              Boolean(onUndo) &&
              receiptShowsUndo(part)
            }
            enter={streaming && !part.undone}
            enterDelayMs={
              streaming ? stagger * RECEIPT_ENTER_STAGGER_MS : undefined
            }
            announceUndone={undoneFlash && index === lastToolIndex}
            onUndo={
              part.toolCallId && onUndo
                ? async () => {
                    await onUndo(message.id, part.toolCallId!)
                    flashUndone()
                  }
                : undefined
            }
          />
        )
      })}
    </div>
  )
}

function AssistantMessage() {
  const { messageCite } = useThreadActions()
  const message = useBoundHomeMessage()
  const streaming = message?.id === STREAMING_COACH_ID

  return (
    <MessagePrimitive.Root
      className={cn("space-y-2", streaming && "coach-text-enter")}
      data-coach-text-enter={streaming ? "true" : undefined}
    >
      {message?.workedMs ? (
        <p className="text-xs text-muted-foreground">
          Worked for {Math.max(1, Math.round(message.workedMs / 1000))}s
        </p>
      ) : null}
      {message ? (
        <CoachBoundBody message={message} />
      ) : (
        <MessagePrimitive.Parts
          components={{
            Text: ({ text }) => <CoachMarkdown text={text} />,
            Empty: () => <CoachWorking />,
            data: {
              by_name: {
                [RECEIPT_PART_NAME]: ReceiptPart,
              },
            },
          }}
        />
      )}
      {message && message.id !== STREAMING_COACH_ID
        ? messageCite?.(message)
        : null}
      {message && message.id !== STREAMING_COACH_ID ? (
        <MessageActions message={message} />
      ) : null}
    </MessagePrimitive.Root>
  )
}

function CoachComposer() {
  const { placeholder, send, stop, turnActive, onAttachFromPaper } =
    useThreadActions()
  const [draft, setDraft] = useState("")

  return (
    <ComposerPrimitive.Root className="relative w-full">
      <CoachDock
        draft={draft}
        setDraft={setDraft}
        onSend={() => {
          if (send(draft)) setDraft("")
        }}
        onStop={stop}
        turnActive={turnActive}
        placeholder={placeholder}
        menuPlacement="above"
        showModePicker={false}
        onAttachFromPaper={onAttachFromPaper}
      />
    </ComposerPrimitive.Root>
  )
}

type Props = {
  messages: readonly HomeMessage[]
  empty?: ReactNode
  beforeComposer?: ReactNode
  waiting?: boolean
  turnActive?: boolean
  error?: string | null
  placeholder?: string
  send: (text: string) => boolean
  stop: () => void
  onRetry?: () => void
  onRate?: (messageId: string, rating: CoachUsageRating) => void
  onRegenerate?: () => void
  onUndo?: (messageId: string, toolCallId: string) => Promise<void>
  onAttachFromPaper?: () => void
  messageCite?: (message: HomeMessage) => ReactNode
}

function ThreadChrome({
  empty,
  beforeComposer,
}: {
  empty?: ReactNode
  beforeComposer?: ReactNode
}) {
  const { error, onRetry } = useThreadActions()
  const isEmpty = useAuiState((state) => state.thread.isEmpty)

  return (
    <ThreadPrimitive.Root
      role={isEmpty ? undefined : "log"}
      aria-label={isEmpty ? undefined : "Thread"}
      aria-live={isEmpty ? undefined : "polite"}
      className="flex min-h-0 flex-1 flex-col"
    >
      <ThreadPrimitive.Viewport
        data-coach-thread-viewport
        className="min-h-0 flex-1 overflow-auto"
      >
        <AuiIf condition={(state) => state.thread.isEmpty}>{empty}</AuiIf>
        <ThreadPrimitive.Messages>
          {({ message }) =>
            message.role === "user" ? <UserMessage /> : <AssistantMessage />
          }
        </ThreadPrimitive.Messages>
        {error ? (
          <div className="space-y-2">
            <ErrorBanner variant="inline">{error}</ErrorBanner>
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
      </ThreadPrimitive.Viewport>
      <ThreadPrimitive.ViewportFooter className="flex flex-col gap-2">
        {beforeComposer}
        <CoachComposer />
      </ThreadPrimitive.ViewportFooter>
    </ThreadPrimitive.Root>
  )
}

export function CoachThread({
  messages,
  empty,
  beforeComposer,
  waiting = false,
  turnActive = false,
  error = null,
  placeholder = "Ask the Coach",
  send,
  stop,
  onRetry,
  onRate,
  onRegenerate,
  onUndo,
  onAttachFromPaper,
  messageCite,
}: Props) {
  return (
    <CoachThreadActionsContext.Provider
      value={{
        messages,
        waiting,
        error,
        turnActive,
        placeholder,
        send,
        stop,
        onRetry,
        onRate,
        onRegenerate,
        onUndo,
        onAttachFromPaper,
        messageCite,
      }}
    >
      <ThreadChrome empty={empty} beforeComposer={beforeComposer} />
    </CoachThreadActionsContext.Provider>
  )
}
