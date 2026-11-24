import { chatContract, parseChatId } from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import { hostDelegateProposals } from "../registry/proposal-hosts.js"
import type { Registry } from "../registry/registry.js"
import {
  appendAgentProposalApproval,
  createAgentProposalChat,
} from "./agent-proposal.js"
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

const stops = new Map<string, Set<AbortController>>()

export function stopChat(chatId: string) {
  const controllers = stops.get(chatId)
  if (!controllers) return false
  for (const controller of controllers) controller.abort()
  stops.delete(chatId)
  return true
}

export function trackChatTurn(chatId: string, controller: AbortController) {
  const controllers = stops.get(chatId) ?? new Set<AbortController>()
  controllers.add(controller)
  stops.set(chatId, controllers)
  return () => {
    controllers.delete(controller)
    if (controllers.size === 0) stops.delete(chatId)
  }
}

export function registerChat(registry: Registry) {
  hostDelegateProposals({
    open: createAgentProposalChat,
    show: appendAgentProposalApproval,
  })
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
      activity: (input) => ({
        subjectKind: "chat",
        subjectId: input.chatId,
        summary: `You renamed the chat to ${input.title}`,
      }),
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
      activity: (input) => ({
        subjectKind: "chat",
        subjectId: input.chatId,
        summary: input.focus
          ? `You pointed the chat at the ${input.focus.kind}`
          : "You cleared what the chat points at",
      }),
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
