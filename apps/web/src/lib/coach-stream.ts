import type { QueryClient } from "@tanstack/react-query"
import {
  commands,
  parseChatTurnEvent,
  type AnyCommandEntry,
  type ChatTurnEvent,
} from "@workspace/domain"

import { apiStream } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { refreshReads, refreshQueries } from "@/lib/contract-client.ts"
import { readSseStream } from "@/lib/sse.ts"

function isCommandName(name: string): name is keyof typeof commands {
  return name in commands
}

export function createToolRefresher(queryClient: QueryClient) {
  const inputs = new Map<string, unknown>()
  return (event: ChatTurnEvent) => {
    if (event.type === "tool-call") {
      inputs.set(event.toolCallId, event.input)
      return
    }
    if (event.type !== "tool-result" || !event.ok) return
    if (!isCommandName(event.name) || !inputs.has(event.toolCallId)) return
    const entry = commands[event.name] as AnyCommandEntry
    void refreshQueries(
      queryClient,
      entry.invalidates(inputs.get(event.toolCallId))
    )
    inputs.delete(event.toolCallId)
  }
}

export async function streamChatTurn(input: {
  queryClient: QueryClient
  chatId: string
  body: unknown
  signal?: AbortSignal
  onEvent: (event: ChatTurnEvent) => void
}): Promise<void> {
  const res = await apiStream(`/api/chats/${input.chatId}/turns`, {
    method: "POST",
    body: JSON.stringify(input.body),
    signal: input.signal,
  })
  try {
    if (!res.body) {
      throw new ApiError(502, "REQUEST_FAILED", "Coach stream was empty")
    }
    const refresh = createToolRefresher(input.queryClient)
    for await (const wire of readSseStream(res.body, {
      signal: input.signal,
    })) {
      const event = parseChatTurnEvent(wire)
      if (!event) continue
      refresh(event)
      input.onEvent(event)
    }
  } finally {
    await refreshReads(input.queryClient, [{ query: "coach.usage" }])
  }
}
