import {
  ERROR_CODES,
  chatContract,
  parseChatId,
  type ActivityRow,
  type PendingActionRow,
} from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import {
  appendChatMessage,
  createChat,
  deleteChat,
  getChat,
  listChats,
  openChat,
  renameChat,
  setChatFocus,
} from "./store.js"

const stops = new Map<string, AbortController>()

export function stopChat(chatId: string) {
  const controller = stops.get(chatId)
  if (!controller) return false
  controller.abort()
  stops.delete(chatId)
  return true
}

export function trackChatTurn(chatId: string, controller: AbortController) {
  stops.set(chatId, controller)
  return () => {
    if (stops.get(chatId) === controller) stops.delete(chatId)
  }
}

type ActivityDbRow = {
  createdAt: Date
  undoneAt: Date | null
} & Omit<ActivityRow, "createdAt" | "undoneAt">

function toActivityRow(row: ActivityDbRow | null): ActivityRow {
  if (!row)
    throw new CommandError(
      ERROR_CODES.INTERNAL_ERROR,
      "Activity row is missing"
    )
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    undoneAt: row.undoneAt?.toISOString() ?? null,
  }
}

function toPendingActionRow(
  row: { createdAt: Date } & Omit<PendingActionRow, "createdAt">
): PendingActionRow {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

export function registerChat(registry: Registry) {
  bindCommands(registry, chatContract, {
    "chat.create": {
      handler: (input, actor) => createChat(actor, input.title),
      reversal: () => null,
      activity: () => null,
    },
    "chat.rename": {
      handler: (input, actor) => renameChat(actor, input.chatId, input.title),
      reversal: (_input, output) => ({
        command: "chat.rename",
        input: { chatId: parseChatId(output.id), title: output.previousTitle },
      }),
      activity: () => null,
    },
    "chat.open": {
      handler: (input, actor) => openChat(actor, input),
      reversal: () => null,
      activity: () => null,
    },
    "chat.setFocus": {
      handler: (input, actor) => setChatFocus(actor, input),
      reversal: (input, output) => ({
        command: "chat.setFocus",
        input: { chatId: input.chatId, focus: output.previousFocus },
      }),
      activity: () => null,
    },
    "chat.appendMessage": {
      handler: (input, actor) => appendChatMessage(actor, input),
      reversal: () => null,
      activity: () => null,
    },
    "chat.delete": {
      handler: (input, actor) => deleteChat(actor, input.chatId),
      reversal: () => null,
      activity: () => null,
    },
    "coach.stop": {
      handler: async (input) => ({ stopped: stopChat(input.chatId) }),
      reversal: () => null,
      activity: () => null,
    },
    "actions.approve": {
      handler: async (input, actor) =>
        toActivityRow(
          await registry.approve(actor.userId, input.pendingActionId)
        ),
      reversal: () => null,
      activity: () => null,
    },
    "actions.deny": {
      handler: async (input, actor) =>
        toPendingActionRow(
          await registry.deny(actor.userId, input.pendingActionId)
        ),
      reversal: () => null,
      activity: () => null,
    },
    "activity.undo": {
      handler: async (input, actor) =>
        toActivityRow(await registry.undo(actor.userId, input.activityId)),
      reversal: () => null,
      activity: () => null,
    },
  })

  registry.addQuery(
    tableQuery("chat.list", {
      description: "List chats.",
      coach: true,
      step: () => "List chats",
      read: (input, actor) => listChats(actor.userId, input.query),
    })
  )

  registry.addQuery(
    tableQuery("chat.get", {
      description: "Read one chat.",
      coach: true,
      step: () => "Read the chat",
      read: (input, actor) => getChat(actor.userId, input.chatId),
    })
  )

  registry.addQuery(
    tableQuery("link.get", {
      description: "Read a link host. The page is not fetched.",
      coach: true,
      step: () => "Read the link",
      read: async (input) => {
        let host: string
        try {
          host = new URL(input.url).host
        } catch {
          host = ""
        }
        return { url: input.url, host }
      },
    })
  )
}
