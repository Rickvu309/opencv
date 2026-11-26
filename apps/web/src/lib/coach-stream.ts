import type { QueryClient } from "@tanstack/react-query"
import { parseChatTurnEvent, type ChatTurnEvent } from "@workspace/domain/coach"
import {
  catalog,
  commands,
  queries,
  z,
  type AnyCommandEntry,
  type QueryRef,
  type ResourceTouch,
} from "@workspace/domain/kernel"

import { apiStream } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { authClient } from "@/lib/auth-client.ts"
import {
  refreshCatalogReads,
  refreshQueries,
  refreshReads,
} from "@/lib/contract-client.ts"
import { readSseStream } from "@/lib/sse.ts"

function isCommandName(name: string): name is keyof typeof commands {
  return name in commands
}

function adoptedCommand(name: string) {
  if (!(name in catalog)) return null
  const operation = catalog[name as keyof typeof catalog]
  return operation.kind === "command" ? operation : null
}

function inputRecord(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function executingOwnerId() {
  const id = authClient.$store.atoms.session?.get()?.data?.user?.id
  return typeof id === "string" ? id : ""
}

function legacyReadsForAdoptedWrite(input: unknown): QueryRef[] {
  const fields = inputRecord(input)
  const refs: QueryRef[] = []
  for (const query of Object.keys(queries)) {
    if (query in catalog) continue
    const entry = queries[query as keyof typeof queries]
    const shape = entry.input instanceof z.ZodObject ? entry.input.shape : null
    const filled: Record<string, unknown> = {}
    if (shape) {
      for (const key of Object.keys(shape)) {
        if (Object.prototype.hasOwnProperty.call(fields, key))
          filled[key] = fields[key]
      }
    }
    refs.push({ query } as QueryRef)
    if (Object.keys(filled).length > 0)
      refs.push({ query, input: filled } as QueryRef)
  }
  return refs
}

function touchesFor(
  name: string,
  input: unknown,
  ownerId: string
): ResourceTouch[] {
  if (!ownerId) return []
  if (isCommandName(name)) return [{ ownerId, name: "workspace" }]
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
    if (event.pendingActionId) return
    const input = inputs.get(event.toolCallId)
    inputs.delete(event.toolCallId)
    if (isCommandName(event.name)) {
      const entry = commands[event.name] as AnyCommandEntry
      const touches = touchesFor(event.name, input, executingOwnerId())
      return Promise.all([
        refreshQueries(queryClient, entry.invalidates(input)),
        touches.length
          ? refreshCatalogReads(queryClient, touches)
          : Promise.resolve(),
      ])
    }
    const operation = adoptedCommand(event.name)
    if (!operation) return
    const touches = touchesFor(event.name, input, executingOwnerId())
    return Promise.all([
      refreshQueries(queryClient, legacyReadsForAdoptedWrite(input)),
      touches.length
        ? refreshCatalogReads(queryClient, touches)
        : Promise.resolve(),
    ])
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
