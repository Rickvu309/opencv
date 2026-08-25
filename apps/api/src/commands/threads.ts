import {
  DEFAULT_THREAD_TITLE,
  STUB_COACH_REPLY,
  THREAD_COMMANDS,
  threadsCreateInputSchema,
  threadsDeleteInputSchema,
  threadsPostMessageInputSchema,
  threadsRenameInputSchema,
  type ThreadDeleted,
  type ThreadDetail,
  type ThreadListItem,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { threadMessages, threads } from "../db/schema.js"
import { createId } from "../id.js"
import {
  getOwnedThread,
  getThreadDetail,
  toThreadListItem,
} from "../threads/queries.js"
import { defineCommand, type AppDatabase } from "./registry.js"

function ownedThread(threadId: string, userId: string) {
  return and(eq(threads.id, threadId), eq(threads.userId, userId))
}

export const createThreadCommand = defineCommand({
  name: THREAD_COMMANDS.create,
  input: threadsCreateInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: THREAD_COMMANDS.delete,
    description: "Undo by deleting the Thread.",
  },
  async handler(ctx, input): Promise<ThreadListItem> {
    const now = new Date()
    const row = {
      id: createId(),
      userId: ctx.actor.userId,
      title: input.title ?? DEFAULT_THREAD_TITLE,
      createdAt: now,
      updatedAt: now,
    }

    await ctx.db.insert(threads).values(row)
    return toThreadListItem(row)
  },
})

export const renameThreadCommand = defineCommand({
  name: THREAD_COMMANDS.rename,
  input: threadsRenameInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: THREAD_COMMANDS.rename,
    description: "Undo by renaming the Thread back to its previous title.",
  },
  async handler(ctx, input): Promise<ThreadListItem> {
    const existing = await getOwnedThread(
      ctx.db,
      ctx.actor.userId,
      input.threadId
    )
    const updatedAt = new Date()

    await ctx.db
      .update(threads)
      .set({ title: input.title, updatedAt })
      .where(ownedThread(existing.id, ctx.actor.userId))

    return toThreadListItem({
      ...existing,
      title: input.title,
      updatedAt,
    })
  },
})

export const deleteThreadCommand = defineCommand({
  name: THREAD_COMMANDS.delete,
  input: threadsDeleteInputSchema,
  coachAllowed: false,
  destructive: true,
  reversal: {
    possible: false,
    description: "Deleting a Thread permanently removes its messages.",
  },
  async handler(ctx, input): Promise<ThreadDeleted> {
    const existing = await getOwnedThread(
      ctx.db,
      ctx.actor.userId,
      input.threadId
    )

    await ctx.db
      .delete(threads)
      .where(ownedThread(existing.id, ctx.actor.userId))
    return { id: existing.id }
  },
})

export const postMessageCommand = defineCommand({
  name: THREAD_COMMANDS.postMessage,
  input: threadsPostMessageInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: false,
    description: "Messages are append-only and cannot be unsent.",
  },
  async handler(ctx, input): Promise<ThreadDetail> {
    await getOwnedThread(ctx.db, ctx.actor.userId, input.threadId)

    const now = new Date()
    const userMessage = {
      id: createId(),
      threadId: input.threadId,
      role: "user" as const,
      text: input.text,
      createdAt: now,
    }
    const coachMessage = {
      id: createId(),
      threadId: input.threadId,
      role: "coach" as const,
      text: STUB_COACH_REPLY,
      createdAt: now,
    }

    await ctx.db.transaction(async (tx: AppDatabase) => {
      await tx.insert(threadMessages).values([userMessage, coachMessage])
      await tx
        .update(threads)
        .set({ updatedAt: now })
        .where(ownedThread(input.threadId, ctx.actor.userId))
    })

    return getThreadDetail(ctx.db, ctx.actor.userId, input.threadId)
  },
})

export const threadCommands = [
  createThreadCommand,
  renameThreadCommand,
  deleteThreadCommand,
  postMessageCommand,
]
