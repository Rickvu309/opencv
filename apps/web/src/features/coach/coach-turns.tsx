import type { ReactNode } from "react"

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
  type ChatViewMessage,
} from "@/features/coach/chat-messages.ts"

import { CoachMessageActions } from "./coach-message-actions.tsx"
import { CoachParts } from "./coach-part-renderers.tsx"
import { toCoachParts } from "./coach-parts.ts"
import { CoachWorking } from "./coach-working.tsx"

export type CoachTurnsProps = {
  messages: readonly ChatViewMessage[]
  waiting?: boolean
  error?: string | null
  onRetry?: () => void
  onRegenerate?: () => void
  onUndo?: (activityId: string) => Promise<void>
  messageCite?: (message: ChatViewMessage) => ReactNode
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
                  onUndo,
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
