import { useEffect, useReducer, type ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { ChatItem } from "@/components/ai-elements/chat.tsx"
import {
  CoachMessage,
  MessageFooter,
  PersonMessage,
} from "@/components/ai-elements/message.tsx"
import {
  STREAMING_COACH_ID,
  isLocalMessage,
  latestCoachMessageId,
  type ChatViewMessage,
} from "@/features/coach/chat-messages.ts"

import { CoachMessageActions } from "./coach-message-actions.tsx"
import { CoachParts } from "./coach-part-renderers.tsx"
import { toCoachParts, type CoachPart } from "./coach-parts.ts"
import type { CoachTurnProgress } from "./coach-progress.ts"
import { CoachWorkFold } from "./coach-work-fold.tsx"
import { splitReadTraces, traceSteps } from "./coach-read-trace.ts"

export type CoachTurnsProps = {
  messages: readonly ChatViewMessage[]
  pendingUser?: ChatViewMessage | null
  seenUserCount?: number
  waiting?: boolean
  progress?: CoachTurnProgress
  error?: string | null
  onRetry?: () => void
  onRegenerate?: () => void
  onUndo?: (activityId: string) => Promise<void>
  messageCite?: (message: ChatViewMessage) => ReactNode
}

export const REVEAL_ON_HOVER =
  "transition-opacity duration-(--duration-micro) ease-(--ease-micro) pointer-fine:opacity-0 pointer-fine:group-hover/reply:opacity-100 pointer-fine:focus-within:opacity-100"

function messagesWithPending(
  messages: readonly ChatViewMessage[],
  pending: ChatViewMessage | null | undefined,
  seenUserCount: number
): readonly ChatViewMessage[] {
  const text = pending?.text.trim() ?? ""
  if (!pending || !text) return messages
  const count = messages.filter(
    (message) => message.role === "user" && message.text === text
  ).length
  if (count > seenUserCount) return messages
  if (messages.some((message) => message.id === pending.id)) return messages
  return [...messages, { ...pending, text }]
}

function turnKey(message: ChatViewMessage, index: number) {
  return `${index}:${message.role}`
}

function lastTextKey(parts: readonly CoachPart[]) {
  return parts.findLast((part) => part.kind === "text")?.key
}

function replyActionsVisible(message: ChatViewMessage, streaming: boolean) {
  return (
    !streaming &&
    !message.failed &&
    message.status !== "error" &&
    message.status !== "aborted" &&
    message.text.trim().length > 0
  )
}

function TurnAlert({
  message,
  onRetry,
  align,
}: {
  message: string
  onRetry?: () => void
  align?: "end"
}) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        align === "end" && "self-end"
      )}
    >
      <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{message}</p>
      {onRetry ? (
        <Button
          className="h-11 shrink-0 md:h-8"
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  )
}

function CoachReply({
  live,
  fold,
  body = null,
  cite = null,
  footer,
}: {
  live: boolean
  fold: ReactNode
  body?: ReactNode
  cite?: ReactNode
  footer?: (wasLive: boolean) => ReactNode
}) {
  const [wasLive, latch] = useReducer(() => true, live)
  useEffect(() => {
    if (live) latch()
  }, [live])
  return (
    <CoachMessage className="group/reply">
      {fold}
      {body}
      {cite}
      {footer?.(wasLive) ?? null}
    </CoachMessage>
  )
}

export function CoachTurns({
  messages,
  pendingUser = null,
  seenUserCount = 0,
  waiting = false,
  progress,
  error = null,
  onRetry,
  onRegenerate,
  onUndo,
  messageCite,
}: CoachTurnsProps) {
  const shown = messagesWithPending(messages, pendingUser, seenUserCount)
  const latestCoachId = latestCoachMessageId(shown)
  const turns = shown.map((message) => ({
    message,
    parts: message.role === "coach" ? toCoachParts(message) : [],
  }))
  const coachWroteText = turns.some(
    ({ message, parts }) =>
      message.id === STREAMING_COACH_ID &&
      parts.some((part) => part.kind === "text" && part.markdown.trim())
  )
  const working =
    waiting ||
    (progress?.active === true && !coachWroteText) ||
    turns.some(
      ({ message, parts }) =>
        message.id === STREAMING_COACH_ID && parts.length === 0
    )
  const progressRows = progress?.active ? progress.rows : []
  const awaitingApproval = progressRows.some((row) => row.status === "approval")
  const rows = progressRows.filter((row) => row.status !== "approval")
  const announce = working && !awaitingApproval
  const streamingShown = turns.some(
    ({ message }) => message.id === STREAMING_COACH_ID
  )
  const liveFold =
    announce ||
    rows.length > 0 ||
    (streamingShown && coachWroteText && !awaitingApproval)
  const fold = (
    <CoachWorkFold
      steps={rows}
      live
      announce={announce}
      writing={coachWroteText}
    />
  )

  const items = turns.map(({ message, parts }, index) => {
    const live = isLocalMessage(message.id) || message.id === pendingUser?.id
    if (message.role === "user") {
      return (
        <ChatItem
          key={turnKey(message, index)}
          messageId={message.id}
          className={live ? "motion-send" : undefined}
          scrollAnchor
        >
          <PersonMessage failed={message.failed}>
            {message.text}
            {message.attachments?.length ? (
              <div className="mt-2 flex max-w-full flex-wrap gap-1">
                {message.attachments.map((attachment, at) => (
                  <span
                    key={`${attachment.kind}:${attachment.id}:${at}`}
                    className="max-w-full rounded-md border border-current/20 px-2 py-1 text-xs [overflow-wrap:anywhere]"
                  >
                    {attachment.label}
                  </span>
                ))}
              </div>
            ) : null}
          </PersonMessage>
          {message.failed && message.error ? (
            <TurnAlert message={message.error} onRetry={onRetry} align="end" />
          ) : null}
        </ChatItem>
      )
    }
    const streaming = message.id === STREAMING_COACH_ID
    if (streaming && parts.length === 0 && !liveFold) return null
    const { traces, answer } =
      message.workedMs && !streaming
        ? splitReadTraces(parts)
        : { traces: [], answer: parts }
    return (
      <ChatItem key={turnKey(message, index)} messageId={message.id}>
        <CoachReply
          live={streaming}
          footer={(wasLive) =>
            replyActionsVisible(message, streaming) ? (
              <MessageFooter
                data-reveal={
                  message.id === latestCoachId ? "always" : "on-hover"
                }
                className={cn(
                  "px-0",
                  message.id !== latestCoachId && REVEAL_ON_HOVER,
                  wasLive && "motion-rise"
                )}
              >
                <CoachMessageActions
                  message={message}
                  canRegenerate={
                    !waiting &&
                    Boolean(onRegenerate) &&
                    message.id === latestCoachId
                  }
                  onRegenerate={onRegenerate}
                />
              </MessageFooter>
            ) : null
          }
          fold={
            streaming ? (
              liveFold ? (
                fold
              ) : null
            ) : message.workedMs ? (
              <CoachWorkFold
                steps={traceSteps(traces)}
                live={false}
                workedMs={message.workedMs}
              />
            ) : null
          }
          body={
            <CoachParts
              parts={answer}
              ctx={{
                canUndo: !waiting && !streaming && Boolean(onUndo),
                onUndo,
                streamingTextKey: streaming ? lastTextKey(answer) : undefined,
              }}
            />
          }
          cite={streaming ? null : messageCite?.(message)}
        />
      </ChatItem>
    )
  })
  if (liveFold && !streamingShown)
    items.push(
      <ChatItem key={`${shown.length}:coach`} messageId="coach-working">
        <CoachReply live fold={fold} />
      </ChatItem>
    )

  return (
    <>
      {items}
      {error ? (
        <ChatItem messageId="coach-error" className="motion-rise">
          <TurnAlert message={error} onRetry={onRetry} />
        </ChatItem>
      ) : null}
    </>
  )
}
