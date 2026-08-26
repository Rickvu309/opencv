import { useCallback, useMemo } from "react"
import {
  getExternalStoreMessages,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react"
import type { CoachUsageRating } from "@workspace/domain"

import type { TurnPhase } from "@/features/home/thread-store-context.ts"
import { STREAMING_COACH_ID, type HomeMessage } from "@/features/home/threads.ts"

export const RECEIPT_PART_NAME = "receipt"

export type CoachRuntimeTurn = {
  messages: readonly HomeMessage[]
  phase: TurnPhase
  send: (text: string) => boolean
  stop: () => void
  regenerate: () => boolean
  rate: (messageId: string, rating: CoachUsageRating) => void
}

function textFromAppend(message: AppendMessage) {
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
}

/** Pure projection. Does not copy or own `useCoachTurn` / React Query state. */
export function toAssistantUiMessage(message: HomeMessage): ThreadMessageLike {
  const role = message.role === "user" ? "user" : "assistant"
  const content: ThreadMessageLike["content"] = message.parts?.length
    ? message.parts.map((part) =>
        part.type === "text"
          ? { type: "text" as const, text: part.text }
          : { type: `data-${RECEIPT_PART_NAME}` as const, data: part }
      )
    : message.text
      ? [{ type: "text" as const, text: message.text }]
      : []

  const submittedFeedback =
    message.rating === "up"
      ? { type: "positive" as const }
      : message.rating === "down"
        ? { type: "negative" as const }
        : undefined

  return {
    id: message.id,
    role,
    content,
    status:
      message.id === STREAMING_COACH_ID
        ? { type: "running" }
        : message.failed
          ? { type: "incomplete", reason: "error", error: message.error }
          : { type: "complete", reason: "stop" },
    metadata: {
      ...(submittedFeedback ? { submittedFeedback } : {}),
      custom: {
        workedMs: message.workedMs,
        failed: message.failed,
        error: message.error,
        rating: message.rating,
        rateable: message.rating !== undefined,
      },
    },
  }
}

export function originalHomeMessage(
  message: Parameters<typeof getExternalStoreMessages>[0]
) {
  return getExternalStoreMessages<HomeMessage>(message)[0]
}

/**
 * Maps `useCoachTurn` into assistant-ui `ExternalStoreRuntime`.
 * React Query remains the owner of persisted messages; this hook only
 * projects the already-derived `messages` array and forwards callbacks.
 */
export function useCoachExternalRuntime({
  messages,
  phase,
  send,
  stop,
  regenerate,
  rate,
}: CoachRuntimeTurn) {
  const onNew = useCallback(
    async (message: AppendMessage) => {
      send(textFromAppend(message))
    },
    [send]
  )

  const onCancel = useCallback(async () => {
    stop()
  }, [stop])

  const onReload = useCallback(async () => {
    regenerate()
  }, [regenerate])

  const feedback = useMemo(
    () => ({
      submit({
        message,
        type,
      }: {
        message: Parameters<typeof originalHomeMessage>[0]
        type: "positive" | "negative"
      }) {
        const original = originalHomeMessage(message)
        if (!original) return
        rate(original.id, type === "positive" ? "up" : "down")
      },
    }),
    [rate]
  )

  return useExternalStoreRuntime<HomeMessage>({
    messages,
    convertMessage: toAssistantUiMessage,
    isRunning: phase !== "idle",
    isSendDisabled: phase !== "idle",
    onNew,
    onCancel,
    onReload,
    adapters: { feedback },
    unstable_capabilities: { copy: true },
  })
}
