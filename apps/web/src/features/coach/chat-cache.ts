import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import {
  DEFAULT_CHAT_TITLE,
  textFromParts,
  type ChatRecord,
  type ChatSummary,
  type ChatEntry,
  type ChatEntryPart,
} from "@workspace/domain"

import {
  getChat,
  chatDetailKey,
  chatListKey,
  toListItem,
  upsertChatSummary,
} from "@/features/coach/chat-api.ts"
import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"

type KeepAbortedInput = {
  id: string
  prev: ChatRecord | undefined
  user: ChatViewMessage | undefined
  parts: ChatEntryPart[]
  supersedesId?: string
  title: (text: string) => string
  focusDocId: string | null | undefined
}

export function withAbortedCoach({
  id,
  prev,
  user,
  parts,
  supersedesId,
  title,
  focusDocId,
}: KeepAbortedInput): ChatRecord | null {
  const now = new Date().toISOString()
  const text = textFromParts(parts)
  const existing = prev?.messages ?? []
  const addUser =
    user != null &&
    !existing.some((m) => m.role === "user" && m.text === user.text)
  const userRow: ChatEntry[] = addUser
    ? [{ id: user.id, role: "user", text: user.text, createdAt: now }]
    : []
  const coachRow: ChatEntry = {
    id: crypto.randomUUID(),
    role: "coach",
    text,
    createdAt: now,
    status: "aborted",
    parts: supersedesId
      ? [
          ...(
            existing.find((message) => message.id === supersedesId)?.parts ?? []
          ).filter((part) => part.type === "tool"),
          ...parts,
        ]
      : parts,
  }

  const replaces = supersedesId
    ? existing.some((message) => message.id === supersedesId)
    : false

  return {
    id,
    title: prev?.title ?? (user ? title(user.text) : DEFAULT_CHAT_TITLE),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    focusDocId: prev?.focusDocId ?? focusDocId ?? null,
    messages: replaces
      ? existing.map((message) =>
          message.id === supersedesId ? coachRow : message
        )
      : [...existing, ...userRow, coachRow],
  }
}

type ChatCacheOptions = {
  titleForCreate: (text: string) => string
  focusDocId: string | null | undefined
}

export function useChatCache({ titleForCreate, focusDocId }: ChatCacheOptions) {
  const queryClient = useQueryClient()

  const writeDetail = useCallback(
    (id: string, detail: ChatRecord) => {
      queryClient.setQueryData(chatDetailKey(id), detail)
      const item = toListItem(detail)
      queryClient.setQueryData(
        chatListKey(),
        (prev: ChatSummary[] | undefined) => upsertChatSummary(prev ?? [], item)
      )
    },
    [queryClient]
  )

  const rememberListItem = useCallback(
    (item: ChatSummary) => {
      queryClient.setQueryData(
        chatListKey(),
        (prev: ChatSummary[] | undefined) => upsertChatSummary(prev ?? [], item)
      )
    },
    [queryClient]
  )

  const hydrateChat = useCallback(
    async (id: string): Promise<ChatRecord | undefined> => {
      try {
        const detail = await getChat(id)
        writeDetail(id, detail)
        return detail
      } catch {
        return undefined
      }
    },
    [writeDetail]
  )

  const keepStreamedCoach = useCallback(
    (
      id: string,
      user: ChatViewMessage | undefined,
      parts: ChatEntryPart[],
      supersedesId?: string
    ) => {
      const next = withAbortedCoach({
        id,
        prev: queryClient.getQueryData<ChatRecord>(chatDetailKey(id)),
        user,
        parts,
        supersedesId,
        title: titleForCreate,
        focusDocId,
      })
      if (next) writeDetail(id, next)
    },
    [focusDocId, queryClient, titleForCreate, writeDetail]
  )

  return {
    writeDetail,
    rememberListItem,
    hydrateChat,
    keepStreamedCoach,
  }
}
