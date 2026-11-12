import { shouldAutoTitleChat, deterministicChatTitle } from "@workspace/domain"
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
import { and, asc, desc, eq, gt, inArray, isNotNull } from "drizzle-orm"

import { getDb, transaction } from "../db/context.js"
import { activity, chatMessages, chats, coachTasks } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError } from "../registry/errors.js"
import { registry } from "../registry/registry.js"
import {
  chatViewPart,
  readChatViewParts,
  readStoredParts,
} from "./stored-parts.js"

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
    parts: readChatViewParts(row.parts),
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
    .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
  const visible = projectCurrentMessages(messages)
  const undone = await undoneActivityIds(userId, messages)
  const blocked = await blockedReceipts(userId, visible)
  const confirmations = new Map(
    (await registry.confirmations(userId, chatId)).map((row) => [row.id, row])
  )
  const [activeTask] = await getDb()
    .select({ id: coachTasks.id, createdAt: coachTasks.createdAt })
    .from(coachTasks)
    .where(
      and(
        eq(coachTasks.ownerId, userId),
        eq(coachTasks.chatId, chatId),
        inArray(coachTasks.state, [
          "queued",
          "running",
          "waitingApproval",
          "cancelling",
        ])
      )
    )
    .limit(1)

  return {
    ...toChat(row),
    activeTaskId: activeTask?.id ?? null,
    messages: [
      ...visible.map((message) => {
        const result = withBlocked(withUndone(message, undone), blocked)
        return {
          ...result,
          parts: result.parts.map((part) => {
            if (part.type !== "tool" || !part.pendingActionId) return part
            const confirmation = confirmations.get(part.pendingActionId)
            const approval = confirmation?.status ?? ("expired" as const)
            return {
              ...part,
              ...confirmation?.receipt,
              approval,
              outcome: confirmation?.receipt?.undone
                ? ("undone" as const)
                : approval === "pending"
                  ? ("waiting" as const)
                  : approval,
            }
          }),
        }
      }),
      ...(activeTask
        ? [
            {
              id: activeTask.id,
              chatId,
              role: "coach" as const,
              text: "Coach is still working. Reload this Chat to follow or stop it.",
              parts: [
                {
                  type: "text" as const,
                  text: "Coach is still working. Reload this Chat to follow or stop it.",
                },
              ],
              status: null,
              workedMs: null,
              createdAt: iso(activeTask.createdAt),
            },
          ]
        : []),
    ],
  }
}

function projectCurrentMessages(rows: (typeof chatMessages.$inferSelect)[]) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const superseded = new Set(
    rows.flatMap((row) =>
      row.supersedesMessageId ? [row.supersedesMessageId] : []
    )
  )
  return rows
    .filter((row) => !superseded.has(row.id))
    .map((row) => {
      const revisions = [row]
      const seen = new Set([row.id])
      let predecessorId = row.supersedesMessageId
      while (predecessorId && !seen.has(predecessorId)) {
        seen.add(predecessorId)
        const predecessor = byId.get(predecessorId)
        if (!predecessor) break
        revisions.unshift(predecessor)
        predecessorId = predecessor.supersedesMessageId
      }
      const current =
        [...revisions].reverse().find((revision) => revision.text.trim()) ?? row
      return {
        ...toMessage(current),
        parts: revisions.flatMap((revision) =>
          readStoredParts(revision.parts)
            .filter(
              (stored) =>
                revision.id === current.id ||
                !stored.readable ||
                stored.part.type === "tool"
            )
            .map(chatViewPart)
        ),
      }
    })
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

type ReceiptPart = {
  name?: string
  reversal?: { possible?: boolean; command?: string; input?: unknown }
  activityId?: string
  undone?: boolean
}

async function blockedReceipts(
  userId: UserId,
  messages: ReturnType<typeof toMessage>[]
) {
  const parts = messages
    .flatMap((message) => message.parts as ReceiptPart[])
    .filter((part) => part.reversal?.possible && part.reversal.command)
  const reasons = await registry.undoBlockedReasons(
    userId,
    parts.map((part) => ({
      command: part.reversal!.command ?? null,
      input: part.reversal!.input,
      source: part.name ?? null,
    }))
  )
  const blocked = new Map<ReceiptPart, string>()
  parts.forEach((part, index) => {
    const reason = reasons[index]
    if (reason) blocked.set(part, reason)
  })
  return blocked
}

function withBlocked(
  message: ReturnType<typeof toMessage>,
  blocked: Map<ReceiptPart, string>
) {
  if (blocked.size === 0) return message
  return {
    ...message,
    parts: message.parts.map((part) => {
      const reason = blocked.get(part as ReceiptPart)
      return reason
        ? ({
            ...part,
            reversal: { possible: false, description: reason },
          } as ChatMessagePart)
        : part
    }),
  }
}

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
        ? ({ ...part, undone: true, outcome: "undone" } as ChatMessagePart)
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
    {
      type: "text",
      text: input.text,
      ...(input.selection ? { selection: input.selection } : {}),
    },
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
  autoTitle?: boolean
  supersedesMessageId?: string | null
}) {
  await ownedChat(input.userId, input.chatId)
  const now = new Date()
  const id = createId(now.getTime())
  const savedId = await transaction(async () => {
    let supersedesMessageId: string | null = null
    if (input.supersedesMessageId) {
      await getDb()
        .select({ id: chats.id })
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .for("update")
      const rows = await getDb()
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, input.chatId))
        .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
      const targetIndex = rows.findIndex(
        (row) => row.id === input.supersedesMessageId && row.role === "coach"
      )
      const latestPersonIndex = rows.reduce(
        (last, row, index) => (row.role === "person" ? index : last),
        -1
      )
      if (targetIndex <= latestPersonIndex) return null
      supersedesMessageId = input.supersedesMessageId
      while (true) {
        const child = rows.find(
          (row) => row.supersedesMessageId === supersedesMessageId
        )
        if (!child) break
        if (child.role !== "coach")
          throw new CommandError(
            ERROR_CODES.INTERNAL_ERROR,
            "Invalid reply revision"
          )
        supersedesMessageId = child.id
      }
    }
    const tx = getDb()
    await tx.insert(chatMessages).values({
      id,
      chatId: input.chatId,
      role: "coach",
      text: input.text,
      parts: input.parts,
      status: input.status,
      workedMs: input.workedMs,
      supersedesMessageId,
      createdAt: now,
    })
    await tx
      .update(chats)
      .set({ updatedAt: now })
      .where(eq(chats.id, input.chatId))
    if (input.autoTitle && input.status === "final") {
      const [chat] = await tx
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .for("update")
      const messages = await tx
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, input.chatId))
        .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
      const decision = shouldAutoTitleChat({
        currentTitle: chat!.title,
        status: input.status,
        messages: messages
          .filter((message) => message.id !== id)
          .map((message) => ({
            role: message.role === "person" ? "user" : "coach",
            text: message.text,
            status: message.status ?? undefined,
          })),
      })
      const title =
        decision &&
        deterministicChatTitle({
          userText: decision.userText,
          coachText: input.text,
        })
      if (title)
        await tx.update(chats).set({ title }).where(eq(chats.id, input.chatId))
    }
    return id
  })
  return savedId ? { id: savedId } : null
}

export async function deleteChat(actor: Actor, chatId: ChatId) {
  await ownedChat(actor.userId, chatId)
  await getDb().delete(chats).where(eq(chats.id, chatId))
  return { id: chatId }
}
