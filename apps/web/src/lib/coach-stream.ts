import type { QueryClient } from "@tanstack/react-query"
import { parseChatTurnEvent, type ChatTurnEvent } from "@workspace/domain/coach"
import { catalog, type ResourceTouch } from "@workspace/domain/kernel"

import { apiStream } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { authClient } from "@/lib/auth-client.ts"
import { refreshCatalogReads, refreshReads } from "@/lib/contract-client.ts"
import { refreshPaperSuggestions } from "@/lib/paper-suggestions.ts"
import { readSseStream } from "@/lib/sse.ts"

function adoptedCommand(name: string) {
  if (!(name in catalog)) return null
  const operation = catalog[name as keyof typeof catalog]
  return operation.kind === "command" ? operation : null
}

function executingOwnerId() {
  const id = authClient.$store.atoms.session?.get()?.data?.user?.id
  return typeof id === "string" ? id : ""
}

function touchesFor(
  name: string,
  input: unknown,
  ownerId: string
): ResourceTouch[] {
  if (!ownerId) return []
  const operation = adoptedCommand(name)
  if (!operation) return []
  const parsed = operation.input.safeParse(input)
  if (!parsed.success) return [{ ownerId, name: "workspace" }]
  return operation.writes(parsed.data as never).map((write) => ({
    ownerId,
    name: write.name,
    ...(write.entityId ? { entityId: write.entityId } : {}),
  }))
}

export function createToolRefresher(queryClient: QueryClient) {
  const inputs = new Map<string, unknown>()
  return (event: ChatTurnEvent) => {
    if (event.type === "tool-call") {
      inputs.set(event.toolCallId, event.input)
      return
    }
    if (event.type !== "tool-result" || !event.ok) return
    if (!inputs.has(event.toolCallId)) return
    if (event.pendingActionId) return refreshPaperSuggestions(queryClient)
    const input = inputs.get(event.toolCallId)
    inputs.delete(event.toolCallId)
    if (!adoptedCommand(event.name)) return
    const touches = touchesFor(event.name, input, executingOwnerId())
    if (touches.length) return refreshCatalogReads(queryClient, touches)
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
