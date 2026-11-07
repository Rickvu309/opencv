import type { QueryClient } from "@tanstack/react-query"
import {
  catalog,
  commands,
  parseChatTurnEvent,
  queries,
  resourcesOverlap,
  z,
  type AnyCommandEntry,
  type ChatTurnEvent,
  type QueryRef,
  type ResourceRef,
} from "@workspace/domain"

import { apiStream } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { refreshReads, refreshQueries } from "@/lib/contract-client.ts"
import { readSseStream } from "@/lib/sse.ts"

const mountedDependency = z.object({
  ownerId: z.string(),
  name: z.string(),
  entityId: z.string().optional(),
})

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

function invalidateCatalogReads(
  queryClient: QueryClient,
  writes: readonly ResourceRef[]
) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      if (query.queryKey[0] !== "catalog") return false
      const ownerId = query.queryKey[1]
      if (typeof ownerId !== "string" || !ownerId) return false
      const dependencies = z
        .array(mountedDependency)
        .safeParse(query.meta?.dependsOn)
      if (!dependencies.success) return false
      return writes.some((write) =>
        dependencies.data.some((dependency) =>
          resourcesOverlap(
            {
              ownerId,
              name: write.name,
              ...(write.entityId ? { entityId: write.entityId } : {}),
            },
            dependency
          )
        )
      )
    },
  })
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
    const input = inputs.get(event.toolCallId)
    inputs.delete(event.toolCallId)
    if (isCommandName(event.name)) {
      const entry = commands[event.name] as AnyCommandEntry
      void refreshQueries(queryClient, entry.invalidates(input))
      return
    }
    const operation = adoptedCommand(event.name)
    if (!operation) return
    void refreshQueries(queryClient, legacyReadsForAdoptedWrite(input))
    const parsed = operation.input.safeParse(input)
    if (!parsed.success) return
    void invalidateCatalogReads(
      queryClient,
      operation.writes(parsed.data as never)
    )
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
