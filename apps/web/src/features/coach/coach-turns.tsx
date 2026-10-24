import type { ReactNode } from "react"

import type { CoachUsageRating } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"

import { ChatItem } from "@/components/ai-elements/chat.tsx"
import {
  CoachMessage,
  MessageFooter,
  PersonMessage,
} from "@/components/ai-elements/message.tsx"
import { ErrorBanner } from "@/components/error-banner.tsx"
import {
  STREAMING_COACH_ID,
  latestCoachMessageId,
  type HomeMessage,
} from "@/features/home/threads.ts"

import { CoachMessageActions } from "./coach-message-actions.tsx"
import { CoachParts } from "./coach-part-renderers.tsx"
import { toCoachParts } from "./coach-parts.ts"
import { CoachWorking } from "./coach-working.tsx"

export type CoachTurnsProps = {
  messages: readonly HomeMessage[]
  waiting?: boolean
  error?: string | null
  onRetry?: () => void
  onRate?: (messageId: string, rating: CoachUsageRating) => void
  onRegenerate?: () => void
  onUndo?: (messageId: string, toolCallId: string) => Promise<void>
  messageCite?: (message: HomeMessage) => ReactNode
}

function RetryRow({
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
      className={
        align === "end" ? "mt-2 flex flex-col items-end gap-2" : "space-y-2"
      }
    >
      <ErrorBanner variant="inline">{message}</ErrorBanner>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function CoachTurns({
  messages,
  waiting = false,
  error = null,
  onRetry,
  onRate,
  onRegenerate,
  onUndo,
  messageCite,
}: CoachTurnsProps) {
  const latestCoachId = latestCoachMessageId(messages)
  const turns = messages.map((message) => ({
    message,
    parts: message.role === "coach" ? toCoachParts(message) : [],
  }))
  const working =
    waiting ||
    turns.some(
      ({ message, parts }) =>
        message.id === STREAMING_COACH_ID && parts.length === 0
    )

  return (
    <>
      {turns.map(({ message, parts }) => {
        if (message.role === "user") {
          return (
            <ChatItem key={message.id} messageId={message.id} scrollAnchor>
              <PersonMessage failed={message.failed}>
                {message.text}
              </PersonMessage>
              {message.failed && message.error ? (
                <RetryRow
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
        return (
          <ChatItem key={message.id} messageId={message.id}>
            <CoachMessage>
              {message.workedMs ? (
                <p className="text-xs text-muted-foreground">
                  Worked for {Math.max(1, Math.round(message.workedMs / 1000))}s
                </p>
              ) : null}
              <CoachParts
                parts={parts}
                ctx={{
                  canUndo: !waiting && !streaming && Boolean(onUndo),
                  onUndo: onUndo
                    ? (toolCallId) => onUndo(message.id, toolCallId)
                    : undefined,
                }}
              />
              {streaming ? null : messageCite?.(message)}
              {streaming ? null : (
                <MessageFooter>
                  <CoachMessageActions
                    message={message}
                    canRegenerate={
                      !waiting &&
                      Boolean(onRegenerate) &&
                      message.id === latestCoachId
                    }
                    onRate={onRate}
                    onRegenerate={onRegenerate}
                  />
                </MessageFooter>
              )}
            </CoachMessage>
          </ChatItem>
        )
      })}
      {error ? (
        <ChatItem messageId="coach-error">
          <RetryRow message={error} onRetry={onRetry} />
        </ChatItem>
      ) : null}
      {working ? (
        <ChatItem messageId="coach-working">
          <CoachWorking />
        </ChatItem>
      ) : null}
    </>
  )
}
