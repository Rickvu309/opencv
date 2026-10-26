// Temporary compat for the current web.
// #376 removed apply, #375 profile, and #378 paper. #377 deletes the thread map.
import {
  ERROR_CODES,
  THREAD_COMMANDS,
  type Actor,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
} from "@workspace/domain"

import { CommandError } from "../registry/errors.js"
import type { ExecuteResult, Registry } from "../registry/registry.js"

const COMPAT_COMMANDS = new Set<string>([
  THREAD_COMMANDS.create,
  THREAD_COMMANDS.rename,
  THREAD_COMMANDS.delete,
  THREAD_COMMANDS.postMessage,
])

type ChatView = {
  id: string
  title: string
  focusKind: string | null
  focusId: string | null
  createdAt: string
  updatedAt: string
  messages?: MessageView[]
}

type MessageView = {
  id: string
  role: "person" | "coach"
  text: string
  createdAt: string
  parts?: ThreadMessage["parts"]
  status?: ThreadMessage["status"]
  workedMs?: number | null
}

export function isCompatCommand(name: string) {
  return COMPAT_COMMANDS.has(name)
}

function outputOf(result: ExecuteResult): unknown {
  return result.output
}

async function run(
  registry: Registry,
  name: string,
  input: unknown,
  actor: Actor
): Promise<unknown> {
  const result = await registry.execute({ name, input, actor })
  return outputOf(result)
}

function asThread(chat: ChatView): ThreadListItem {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    focusDocId: chat.focusKind === "paper" ? chat.focusId : null,
  }
}

function asMessage(message: MessageView): ThreadMessage {
  return {
    id: message.id,
    role: message.role === "person" ? "user" : "coach",
    text: message.text,
    createdAt: message.createdAt,
    ...(message.parts ? { parts: message.parts } : {}),
    ...(message.status ? { status: message.status } : {}),
    ...(message.workedMs != null ? { workedMs: message.workedMs } : {}),
  }
}

function asDetail(chat: ChatView): ThreadDetail {
  return {
    ...asThread(chat),
    messages: (chat.messages ?? []).map(asMessage),
  }
}

function record(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Invalid command input"
    )
  }
  return input as Record<string, unknown>
}

export async function runCompatCommand(
  registry: Registry,
  name: string,
  input: unknown,
  actor: Actor
) {
  const body = record(input)
  switch (name) {
    case THREAD_COMMANDS.create: {
      const title = typeof body.title === "string" ? body.title : undefined
      const focusDocId =
        typeof body.focusDocId === "string" ? body.focusDocId : undefined
      const chat = focusDocId
        ? ((await run(
            registry,
            "chat.open",
            {
              focus: { kind: "paper", id: focusDocId },
            },
            actor
          )) as ChatView)
        : ((await run(
            registry,
            "chat.create",
            title ? { title } : {},
            actor
          )) as ChatView)
      if (focusDocId && title) {
        return asThread(
          (await run(
            registry,
            "chat.rename",
            { chatId: chat.id, title },
            actor
          )) as ChatView
        )
      }
      return asThread(chat)
    }
    case THREAD_COMMANDS.rename: {
      const chat = (await run(
        registry,
        "chat.rename",
        { chatId: body.threadId, title: body.title },
        actor
      )) as ChatView
      return asThread(chat)
    }
    case THREAD_COMMANDS.delete: {
      return run(registry, "chat.delete", { chatId: body.threadId }, actor)
    }
    case THREAD_COMMANDS.postMessage: {
      const chat = (await run(
        registry,
        "chat.appendMessage",
        { chatId: body.threadId, text: body.text },
        actor
      )) as ChatView
      return asDetail(chat)
    }
    default: {
      throw new CommandError(ERROR_CODES.UNKNOWN_COMMAND, "Unknown command")
    }
  }
}

export async function listCompatThreads(registry: Registry, actor: Actor) {
  const chats = (await registry.read("chat.list", {}, actor)) as ChatView[]
  return chats.map(asThread)
}

export async function compatThreadByFocus(
  registry: Registry,
  actor: Actor,
  focusDocId: string
) {
  const chats = (await registry.read("chat.list", {}, actor)) as ChatView[]
  const match = chats.find(
    (chat) => chat.focusKind === "paper" && chat.focusId === focusDocId
  )
  return match ? asThread(match) : null
}

export async function compatThreadDetail(
  registry: Registry,
  actor: Actor,
  chatId: string
) {
  const chat = (await registry.read("chat.get", { chatId }, actor)) as ChatView
  return asDetail(chat)
}

export { asDetail, asMessage, asThread }
