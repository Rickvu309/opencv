import type { ReactNode } from "react"

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
  latestCoachMessageId,
  type ChatViewMessage,
} from "@/features/coach/chat-messages.ts"

import { CoachMessageActions } from "./coach-message-actions.tsx"
import { CoachParts } from "./coach-part-renderers.tsx"
import { toCoachParts } from "./coach-parts.ts"
import type { CoachTurnProgress } from "./coach-progress.ts"
import { splitReadTraces } from "./coach-read-trace.ts"
import { CoachWorkedFor } from "./coach-worked-for.tsx"
import { CoachWorking } from "./coach-working.tsx"

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
  const showRows =
    rows.length > 0 &&
    (!coachWroteText || rows.some((row) => row.status === "running"))
  const showHeader = working && !awaitingApproval

  return (
    <>
      {turns.map(({ message, parts }) => {
        if (message.role === "user") {
          return (
            <ChatItem key={message.id} messageId={message.id} scrollAnchor>
              <PersonMessage failed={message.failed}>
                {message.text}
                {message.attachments?.length ? (
                  <div className="mt-2 flex max-w-full flex-wrap gap-1">
                    {message.attachments.map((attachment, index) => (
                      <span
                        key={`${attachment.kind}:${attachment.id}:${index}`}
                        className="max-w-full rounded-md border border-current/20 px-2 py-1 text-xs [overflow-wrap:anywhere]"
                      >
                        {attachment.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </PersonMessage>
              {message.failed && message.error ? (
                <TurnAlert
                  message={message.error}
                  onRetry={onRetry}
                  align="end"
                />
              ) : null}
            </ChatItem>
          )
        }
        const streaming = message.id === STREAMING_COACH_ID
        if (streaming && parts.length === 0) return null
        const { traces, answer } =
          message.workedMs && !streaming
            ? splitReadTraces(parts)
            : { traces: [], answer: parts }
        return (
          <ChatItem key={message.id} messageId={message.id}>
            <CoachMessage>
              {message.workedMs ? (
                <CoachWorkedFor workedMs={message.workedMs} traces={traces} />
              ) : null}
              <CoachParts
                parts={answer}
                ctx={{
                  canUndo: !waiting && !streaming && Boolean(onUndo),
                  onUndo,
                }}
              />
              {streaming ? null : messageCite?.(message)}
              {replyActionsVisible(message, streaming) ? (
                <MessageFooter className="px-0">
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
              ) : null}
            </CoachMessage>
          </ChatItem>
        )
      })}
      {error ? (
        <ChatItem messageId="coach-error">
          <TurnAlert message={error} onRetry={onRetry} />
        </ChatItem>
      ) : null}
      {showHeader || showRows ? (
        <ChatItem messageId="coach-working">
          <CoachWorking rows={showRows ? rows : []} showHeader={showHeader} />
        </ChatItem>
      ) : null}
    </>
  )
}
