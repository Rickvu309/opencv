import {
  canReverseReceipt,
  ERROR_CODES,
  type ThreadMessagePart,
  type ThreadToolPart,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import { getChat } from "../chat/index.js"
import { getDb } from "../db/context.js"
import { chatMessages } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import { compatThreadDetail } from "./commands.js"

export async function reverseCompatReceipt(input: {
  registry: Registry
  userId: string
  chatId: string
  messageId: string
  toolCallId: string
}) {
  const chat = await getChat(input.userId, input.chatId)
  const message = chat.messages.find((item) => item.id === input.messageId)
  if (!message || message.role !== "coach") {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Only Coach receipts can be undone"
    )
  }
  const parts = (message.parts ?? []) as ThreadMessagePart[]
  const index = parts.findIndex(
    (part) => part.type === "tool" && part.toolCallId === input.toolCallId
  )
  const part = parts[index]
  if (!part || part.type !== "tool") {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Receipt not found")
  }
  if (!canReverseReceipt(part)) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      part.undone ? "This action was already undone" : "This receipt cannot be undone"
    )
  }
  await input.registry.execute({
    name: part.reversal!.command!,
    input: part.reversal!.input,
    actor: { type: "person", userId: input.userId },
    skipConfirm: true,
  })
  const receipt: ThreadToolPart = {
    type: "tool",
    name: part.name,
    summary: "Undone",
    ok: true,
    toolCallId: createId(),
  }
  const next = parts.map((item, itemIndex) =>
    itemIndex === index && item.type === "tool" ? { ...item, undone: true } : item
  )
  next.push(receipt)
  await getDb()
    .update(chatMessages)
    .set({ parts: next })
    .where(eq(chatMessages.id, input.messageId))
  const thread = await compatThreadDetail(input.registry, {
    type: "person",
    userId: input.userId,
  }, input.chatId)
  return { thread, receipt }
}
