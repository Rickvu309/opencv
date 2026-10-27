import {
  ERROR_CODES,
  personActor,
  type Actor,
  type Plan,
  type ThreadMessage,
} from "@workspace/domain"
import type { SSEStreamingApi } from "hono/streaming"

import { assertDayCap } from "../account/index.js"
import {
  createDemoCoachRuntime,
  routeCoachModel,
  runCoachTurn,
} from "../coach/index.js"
import { coachModelEnv, coachRuntimeModeFromEnv } from "../config.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import { updateDraft } from "./store.js"

type ChatMessage = {
  id: string
  role: "person" | "coach"
  text: string
  createdAt: string
  status?: string
}

const INBOX_CHAT_TITLE = "Inbox reply"

export async function draftWithHint(
  registry: Registry,
  actor: Actor,
  threadId: string,
  hint: string
) {
  const person = personActor(actor.userId)
  const chatId = await inboxChatId(registry, person, threadId)
  await registry.execute({
    name: "chat.appendMessage",
    input: { chatId, text: hint },
    actor: person,
  })
  const capped = await assertDayCap(actor.userId, "free")
  const before = messagesOf(await registry.read("chat.get", { chatId }, person))
  const runtime = coachRuntime(capped.plan)
  const turn = {
    stream: silentStream(),
    wire: "native" as const,
    registry,
    userId: actor.userId,
    chatId,
    mode: "free" as const,
    plan: capped.plan,
    history: before.map(toHistory),
    heartbeatMs: 60_000,
    provider: runtime.provider,
    modelId: runtime.modelId,
  }
  if ("runtime" in runtime) {
    await runCoachTurn({ ...turn, runtime: runtime.runtime })
  } else {
    await runCoachTurn({ ...turn, model: runtime.model })
  }
  const after = messagesOf(await registry.read("chat.get", { chatId }, person))
  const drafted = [...after]
    .reverse()
    .find((message) => message.role === "coach" && message.status !== "error")
  const body = drafted?.text.trim() ?? ""
  if (!body) {
    throw new CommandError(
      ERROR_CODES.INTERNAL_ERROR,
      "Could not draft a reply. Try again."
    )
  }
  return updateDraft(person, threadId, body)
}

function coachRuntime(plan: Plan) {
  if (coachRuntimeModeFromEnv(process.env) === "fake") {
    return {
      runtime: createDemoCoachRuntime(),
      provider: "fake",
      modelId: "fake",
    }
  }
  return {
    model: routeCoachModel({ plan, mode: "free", env: coachModelEnv() }),
    provider: plan === "free" ? "openrouter" : "anthropic",
    modelId: "routed",
  }
}

async function inboxChatId(registry: Registry, actor: Actor, threadId: string) {
  const listed = await registry.read("chat.list", {}, actor)
  const existing = listedChats(listed).find(
    (chat) =>
      chat.title === INBOX_CHAT_TITLE &&
      chat.focusKind === "inbox" &&
      chat.focusId === threadId
  )
  if (existing) return existing.id
  const created = await registry.execute({
    name: "chat.create",
    input: { title: INBOX_CHAT_TITLE },
    actor,
  })
  const chatId = idOf(created.output)
  await registry.execute({
    name: "chat.setFocus",
    input: { chatId, focus: { kind: "inbox", id: threadId } },
    actor,
  })
  return chatId
}

function listedChats(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as {
      id?: unknown
      title?: unknown
      focusKind?: unknown
      focusId?: unknown
    }
    if (typeof row.id !== "string") return []
    return [
      {
        id: row.id,
        title: typeof row.title === "string" ? row.title : "",
        focusKind: typeof row.focusKind === "string" ? row.focusKind : null,
        focusId: typeof row.focusId === "string" ? row.focusId : null,
      },
    ]
  })
}

function idOf(value: unknown) {
  if (!value || typeof value !== "object" || !("id" in value)) {
    throw new CommandError(
      ERROR_CODES.INTERNAL_ERROR,
      "Could not draft a reply. Try again."
    )
  }
  const id = (value as { id: unknown }).id
  if (typeof id !== "string") {
    throw new CommandError(
      ERROR_CODES.INTERNAL_ERROR,
      "Could not draft a reply. Try again."
    )
  }
  return id
}

function messagesOf(value: unknown): ChatMessage[] {
  if (!value || typeof value !== "object" || !("messages" in value)) return []
  const messages = (value as { messages: unknown }).messages
  if (!Array.isArray(messages)) return []
  return messages.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const message = item as Record<string, unknown>
    if (typeof message.id !== "string" || typeof message.text !== "string") {
      return []
    }
    if (typeof message.createdAt !== "string") return []
    const role =
      message.role === "person"
        ? "person"
        : message.role === "coach"
          ? "coach"
          : null
    if (!role) return []
    return [
      {
        id: message.id,
        role,
        text: message.text,
        createdAt: message.createdAt,
        status: typeof message.status === "string" ? message.status : undefined,
      },
    ]
  })
}

function toHistory(message: ChatMessage): ThreadMessage {
  return {
    id: message.id,
    role: message.role === "person" ? "user" : "coach",
    text: message.text,
    createdAt: message.createdAt,
  }
}

function silentStream(): SSEStreamingApi {
  return {
    aborted: false,
    onAbort() {},
    async write() {},
    async writeSSE() {},
  } as unknown as SSEStreamingApi
}
