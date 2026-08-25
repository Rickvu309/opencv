import {
  ERROR_CODES,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type ThreadMessagePart,
  type ThreadMessageStatus,
} from "@workspace/domain"
import { desc, eq } from "drizzle-orm"

import { CommandError, type AppDatabase } from "../commands/registry.js"
import { threadMessages, threads } from "../db/schema.js"

function iso(value: Date) {
  return value.toISOString()
}

export function toThreadListItem(row: {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
}): ThreadListItem {
  return {
    id: row.id,
    title: row.title,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export function toThreadMessage(row: {
  id: string
  role: "user" | "coach"
  text: string
  createdAt: Date
  parts?: ThreadMessagePart[] | null
  status?: ThreadMessageStatus | null
  workedMs?: number | null
}): ThreadMessage {
  const message: ThreadMessage = {
    id: row.id,
    role: row.role,
    text: row.text,
    createdAt: iso(row.createdAt),
  }

  if (row.parts != null) {
    message.parts = row.parts
  }
  if (row.status != null) {
    message.status = row.status
  }
  if (row.workedMs != null) {
    message.workedMs = row.workedMs
  }

  return message
}

export async function listThreadsForUser(
  db: AppDatabase,
  userId: string
): Promise<ThreadListItem[]> {
  const rows = await db
    .select()
    .from(threads)
    .where(eq(threads.userId, userId))
    .orderBy(desc(threads.updatedAt), desc(threads.id))

  return rows.map(toThreadListItem)
}

export async function getOwnedThread(
  db: AppDatabase,
  userId: string,
  threadId: string
) {
  const [row] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1)

  if (!row) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Thread not found")
  }
  if (row.userId !== userId) {
    throw new CommandError(
      ERROR_CODES.FORBIDDEN,
      "You cannot access this Thread"
    )
  }

  return row
}

export async function getThreadDetail(
  db: AppDatabase,
  userId: string,
  threadId: string
): Promise<ThreadDetail> {
  const thread = await getOwnedThread(db, userId, threadId)
  const messages = await db
    .select()
    .from(threadMessages)
    .where(eq(threadMessages.threadId, thread.id))
    .orderBy(threadMessages.createdAt, threadMessages.id)

  return {
    ...toThreadListItem(thread),
    messages: messages.map(toThreadMessage),
  }
}
