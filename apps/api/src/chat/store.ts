import {
  CHAT_OPEN_WINDOW_DAYS,
  DEFAULT_CHAT_TITLE,
  ERROR_CODES,
  parseChatId,
  type Actor,
  type ChatAppendMessageInput,
  type ChatMessagePart,
  type ChatFocus,
  type ChatId,
  type ChatOpenInput,
  type ChatSetFocusInput,
  type UserId,
} from "@workspace/domain"
import { and, desc, eq, gt, inArray, isNotNull } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity, chatMessages, chats } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError } from "../registry/errors.js"
import { readStoredParts } from "./stored-parts.js"

function iso(value: Date) {
  return value.toISOString()
}

export function toChat(row: typeof chats.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    focusKind: row.focusKind,
    focusId: row.focusId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

function toMessage(row: typeof chatMessages.$inferSelect) {
  return {
    id: row.id,
    chatId: row.chatId,
    role: row.role,
    text: row.text,
    parts: readStoredParts(row.parts),
    status: row.status,
    workedMs: row.workedMs,
    createdAt: iso(row.createdAt),
  }
}

async function ownedChat(userId: UserId, chatId: ChatId) {
  const rows = await getDb()
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Chat not found")
  return row
}

export async function listChats(userId: UserId, query?: string) {
  const rows = await getDb()
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt))
  const needle = query?.trim().toLowerCase()
  return rows
    .filter((row) => !needle || row.title.toLowerCase().includes(needle))
    .map(toChat)
}

export async function getChat(userId: UserId, chatId: ChatId) {
  const row = await ownedChat(userId, chatId)
  const messages = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(chatMessages.createdAt)
  const undone = await undoneActivityIds(userId, messages)
  return {
    ...toChat(row),
    messages: messages.map((message) => withUndone(toMessage(message), undone)),
  }
}

function toolActivityId(part: unknown) {
  const id = (part as { activityId?: unknown } | null)?.activityId
  return typeof id === "string" ? id : null
}

async function undoneActivityIds(
  userId: UserId,
  messages: (typeof chatMessages.$inferSelect)[]
) {
  const ids = messages.flatMap((message) =>
    (message.parts ?? []).flatMap((part) => toolActivityId(part) ?? [])
  )
  if (ids.length === 0) return new Set<string>()
  const rows = await getDb()
    .select({ id: activity.id })
    .from(activity)
    .where(
      and(
        eq(activity.userId, userId),
        inArray(activity.id, ids),
        isNotNull(activity.undoneAt)
      )
    )
  return new Set(rows.map((row) => row.id))
}

// The activity row owns whether a receipt was undone, so a reload cannot offer Undo twice.
function withUndone(
  message: ReturnType<typeof toMessage>,
  undone: Set<string>
) {
  if (undone.size === 0) return message
  return {
    ...message,
    parts: message.parts.map((part) => {
      const id = toolActivityId(part)
      return id && undone.has(id)
        ? ({ ...part, undone: true } as ChatMessagePart)
        : part
    }),
  }
}

export async function createChat(
  actor: Actor,
  title?: string,
  focus?: ChatFocus | null
) {
  const now = new Date()
  const id = createId(now.getTime())
  await getDb()
    .insert(chats)
    .values({
      id,
      userId: actor.userId,
      title: title?.trim() || DEFAULT_CHAT_TITLE,
      focusKind: focus?.kind ?? null,
      focusId: focus?.id ?? null,
      createdAt: now,
      updatedAt: now,
    })
  return getChat(actor.userId, parseChatId(id))
}

export async function openChat(actor: Actor, input: ChatOpenInput) {
  if (input.focus) {
    const since = new Date(
      Date.now() - CHAT_OPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000
    )
    const rows = await getDb()
      .select()
      .from(chats)
      .where(
        and(
          eq(chats.userId, actor.userId),
          eq(chats.focusKind, input.focus.kind),
          eq(chats.focusId, input.focus.id),
          gt(chats.updatedAt, since)
        )
      )
      .orderBy(desc(chats.updatedAt))
      .limit(1)
    if (rows[0]) return getChat(actor.userId, parseChatId(rows[0].id))
  }
  return createChat(actor, undefined, input.focus)
}

export async function renameChat(actor: Actor, chatId: ChatId, title: string) {
  const current = await ownedChat(actor.userId, chatId)
  await getDb()
    .update(chats)
    .set({ title, updatedAt: new Date() })
    .where(eq(chats.id, current.id))
  return {
    ...(await getChat(actor.userId, chatId)),
    previousTitle: current.title,
  }
}

export async function setChatFocus(actor: Actor, input: ChatSetFocusInput) {
  const current = await ownedChat(actor.userId, input.chatId)
  await getDb()
    .update(chats)
    .set({
      focusKind: input.focus?.kind ?? null,
      focusId: input.focus?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(chats.id, current.id))
  return {
    ...(await getChat(actor.userId, input.chatId)),
    previousFocus:
      current.focusKind && current.focusId
        ? { kind: current.focusKind, id: current.focusId }
        : null,
  }
}

export async function appendChatMessage(
  actor: Actor,
  input: ChatAppendMessageInput
) {
  await ownedChat(actor.userId, input.chatId)
  const now = new Date()
  const id = createId(now.getTime())
  const parts = [
    { type: "text", text: input.text },
    ...(input.attachments ?? []).map((attachment) => ({
      type: "attachment",
      ...attachment,
    })),
  ]
  await getDb().insert(chatMessages).values({
    id,
    chatId: input.chatId,
    role: "person",
    text: input.text,
    parts,
    status: "final",
    createdAt: now,
  })
  await getDb()
    .update(chats)
    .set({ updatedAt: now })
    .where(eq(chats.id, input.chatId))
  return getChat(actor.userId, input.chatId)
}

export async function insertCoachMessage(input: {
  chatId: ChatId
  userId: UserId
  text: string
  parts: unknown[]
  status: "final" | "error" | "aborted"
  workedMs: number
}) {
  await ownedChat(input.userId, input.chatId)
  const now = new Date()
  const id = createId(now.getTime())
  await getDb().insert(chatMessages).values({
    id,
    chatId: input.chatId,
    role: "coach",
    text: input.text,
    parts: input.parts,
    status: input.status,
    workedMs: input.workedMs,
    createdAt: now,
  })
  await getDb()
    .update(chats)
    .set({ updatedAt: now })
    .where(eq(chats.id, input.chatId))
  const detail = await getChat(input.userId, input.chatId)
  const message = detail.messages.find((item) => item.id === id)
  if (!message)
    throw new CommandError(ERROR_CODES.INTERNAL_ERROR, "Message was not saved")
  return message
}

export async function deleteChat(actor: Actor, chatId: ChatId) {
  await ownedChat(actor.userId, chatId)
  await getDb().delete(chats).where(eq(chats.id, chatId))
  return { id: chatId }
}
