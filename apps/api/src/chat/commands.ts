import {
  actionsApproveInputSchema,
  actionsDenyInputSchema,
  activityUndoInputSchema,
  chatAppendMessageInputSchema,
  chatCreateInputSchema,
  chatDeleteInputSchema,
  chatOpenInputSchema,
  chatRenameInputSchema,
  chatSetFocusInputSchema,
  chatStopInputSchema,
  defineQuery,
  type Actor,
  type ChatRenameInput,
  type ChatSetFocusInput,
} from "@workspace/domain"
import { z } from "zod"

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

export function registerChat(registry: Registry) {
  registry.addCommand(
    {
      name: "chat.create",
      description: "Start a chat.",
      input: chatCreateInputSchema,
      coach: "auto",
      destructive: false,
      reversal: () => null,
      step: () => "Start a chat",
      activity: () => null,
    },
    (input, actor) => createChat(actor, input.title)
  )

  registry.addCommand(
    {
      name: "chat.rename",
      description: "Rename a chat.",
      input: chatRenameInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (_input, output) => ({
        command: "chat.rename",
        input: { chatId: output.id, title: output.previousTitle },
      }),
      step: () => "Rename the chat",
      activity: () => null,
    },
    (input: ChatRenameInput, actor: Actor) =>
      renameChat(actor, input.chatId, input.title)
  )

  registry.addCommand(
    {
      name: "chat.open",
      description: "Open a chat for a focus, reusing a recent one.",
      input: chatOpenInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Open a chat",
      activity: () => null,
    },
    (input, actor) => openChat(actor, input)
  )

  registry.addCommand(
    {
      name: "chat.setFocus",
      description: "Point a chat at a document, job, or inbox thread.",
      input: chatSetFocusInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "chat.setFocus",
        input: { chatId: input.chatId, focus: output.previousFocus },
      }),
      step: () => "Set the chat focus",
      activity: () => null,
    },
    (input: ChatSetFocusInput, actor: Actor) => setChatFocus(actor, input)
  )

  registry.addCommand(
    {
      name: "chat.appendMessage",
      description: "Append the person's message. The Coach does not post as the person.",
      input: chatAppendMessageInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Send a message",
      activity: () => null,
    },
    (input, actor) => appendChatMessage(actor, input)
  )

  registry.addCommand(
    {
      name: "chat.delete",
      description: "Delete a chat and its messages.",
      input: chatDeleteInputSchema,
      coach: "confirm",
      destructive: true,
      reversal: () => null,
      step: () => "Delete this chat",
      activity: () => null,
    },
    (input, actor) => deleteChat(actor, input.chatId)
  )

  registry.addCommand(
    {
      name: "coach.stop",
      description: "Stop the chat that is running.",
      input: chatStopInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Stop",
      activity: () => null,
    },
    async (input) => ({ stopped: stopChat(input.chatId) })
  )

  registry.addCommand(
    {
      name: "actions.approve",
      description: "Run a pending Coach action.",
      input: actionsApproveInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Approve",
      activity: () => null,
    },
    async (input, actor) => {
      const row = await registry.approve(actor.userId, input.pendingActionId)
      return row
    }
  )

  registry.addCommand(
    {
      name: "actions.deny",
      description: "Decline a pending Coach action.",
      input: actionsDenyInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Decline",
      activity: () => null,
    },
    (input, actor) => registry.deny(actor.userId, input.pendingActionId)
  )

  registry.addCommand(
    {
      name: "activity.undo",
      description: "Undo one activity row.",
      input: activityUndoInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Undo",
      activity: () => null,
    },
    (input, actor) => registry.undo(actor.userId, input.activityId)
  )

  registry.addQuery(
    defineQuery({
      name: "chat.list",
      description: "List chats.",
      input: z.object({ query: z.string().optional() }).strict(),
      coach: true,
      step: () => "List chats",
      read: (input, actor) => listChats(actor.userId, input.query),
    })
  )

  registry.addQuery(
    defineQuery({
      name: "chat.get",
      description: "Read one chat.",
      input: z.object({ chatId: z.string().uuid() }).strict(),
      coach: true,
      step: () => "Read the chat",
      read: (input, actor) => getChat(actor.userId, input.chatId),
    })
  )
}
