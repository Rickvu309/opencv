import {
  canReverseReceipt,
  ERROR_CODES,
  type CoachReverseResult,
  type ThreadMessagePart,
  type ThreadToolPart,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import {
  CommandError,
  type AppDatabase,
  type CommandRegistry,
} from "../commands/registry.js"
import { threadMessages, threads } from "../db/schema.js"
import { createId } from "../id.js"
import {
  getOwnedThreadMessage,
  getThreadDetail,
} from "../threads/queries.js"
import { summarizeToolResult } from "./receipts.js"
import { commandToToolName } from "./tools.js"

export async function reverseCoachReceipt({
  db,
  registry,
  userId,
  threadId,
  messageId,
  toolCallId,
}: {
  db: AppDatabase
  registry: CommandRegistry
  userId: string
  threadId: string
  messageId: string
  toolCallId: string
}): Promise<CoachReverseResult> {
  const message = await getOwnedThreadMessage(db, userId, threadId, messageId)
  if (message.role !== "coach") {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Only Coach receipts can be undone"
    )
  }

  const parts: ThreadMessagePart[] = message.parts ?? []
  const index = parts.findIndex(
    (part) => part.type === "tool" && part.toolCallId === toolCallId
  )
  if (index === -1) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Receipt not found")
  }

  const part = parts[index]
  if (!part || part.type !== "tool") {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Receipt not found")
  }
  if (!canReverseReceipt(part)) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      part.undone
        ? "This action was already undone"
        : "This receipt cannot be undone"
    )
  }

  const commandName = part.reversal!.command!
  const executed = await registry.execute({
    name: commandName,
    input: part.reversal!.input,
    actor: { type: "user", userId },
    db,
  })

  const toolName = commandToToolName(commandName)
  const receipt: ThreadToolPart = {
    type: "tool",
    name: toolName,
    summary: summarizeToolResult(toolName, executed.body),
    ok: executed.body.ok,
    toolCallId: createId(),
    ...(executed.body.ok && executed.reversal
      ? { reversal: executed.reversal }
      : {}),
  }

  const nextParts = parts.map((item, itemIndex) =>
    itemIndex === index && item.type === "tool" && executed.body.ok
      ? { ...item, undone: true }
      : item
  )
  nextParts.push(receipt)

  const now = new Date()
  await db.transaction(async (tx: AppDatabase) => {
    await tx
      .update(threadMessages)
      .set({ parts: nextParts })
      .where(eq(threadMessages.id, messageId))
    await tx
      .update(threads)
      .set({ updatedAt: now })
      .where(eq(threads.id, threadId))
  })

  return {
    thread: await getThreadDetail(db, userId, threadId),
    receipt,
  }
}
