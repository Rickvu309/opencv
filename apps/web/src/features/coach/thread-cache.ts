import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import {
  DEFAULT_THREAD_TITLE,
  textFromParts,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type ThreadMessagePart,
} from "@workspace/domain"

import {
  getThread,
  threadQueryKeys,
  toListItem,
  upsertThreadListItem,
} from "@/features/home/thread-api.ts"
import type { HomeMessage } from "@/features/home/threads.ts"
import { paperQueryKeys } from "@/features/paper/paper-api.ts"

export function withFallbackMessage(
  prev: ThreadDetail,
  fallback: ThreadMessage
): ThreadDetail {
  const already = prev.messages.some((item) => item.id === fallback.id)
  return {
    ...prev,
    updatedAt: fallback.createdAt,
    messages: already
      ? prev.messages.map((item) => (item.id === fallback.id ? fallback : item))
      : [...prev.messages, fallback],
  }
}

type KeepAbortedInput = {
  id: string
  prev: ThreadDetail | undefined
  user: HomeMessage | undefined
  parts: ThreadMessagePart[]
  title: (text: string) => string
  focusDocId: string | null | undefined
}

export function withAbortedCoach({
  id,
  prev,
  user,
  parts,
  title,
  focusDocId,
}: KeepAbortedInput): ThreadDetail | null {
  const now = new Date().toISOString()
  const text = textFromParts(parts)
  if (prev?.messages.some((m) => m.role === "coach" && m.text === text)) {
    return null
  }

  const existing = prev?.messages ?? []
  const addUser =
    user != null &&
    !existing.some((m) => m.role === "user" && m.text === user.text)
  const userRow: ThreadMessage[] = addUser
    ? [{ id: user.id, role: "user", text: user.text, createdAt: now }]
    : []
  const coachRow: ThreadMessage = {
    id: crypto.randomUUID(),
    role: "coach",
    text,
    createdAt: now,
    status: "aborted",
    parts,
  }

  return {
    id,
    title: prev?.title ?? (user ? title(user.text) : DEFAULT_THREAD_TITLE),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    focusDocId: prev?.focusDocId ?? focusDocId ?? null,
    messages: [...existing, ...userRow, coachRow],
  }
}

type ThreadCacheOptions = {
  titleForCreate: (text: string) => string
  focusDocId: string | null | undefined
}

export function useThreadCache({
  titleForCreate,
  focusDocId,
}: ThreadCacheOptions) {
  const queryClient = useQueryClient()

  const writeDetail = useCallback(
    (id: string, detail: ThreadDetail) => {
      queryClient.setQueryData(threadQueryKeys.detail(id), detail)
      const item = toListItem(detail)
      queryClient.setQueryData(
        threadQueryKeys.list(),
        (prev: ThreadListItem[] | undefined) =>
          upsertThreadListItem(prev ?? [], item)
      )
      if (detail.focusDocId) {
        queryClient.setQueryData(
          threadQueryKeys.byFocusDoc(detail.focusDocId),
          item
        )
      }
    },
    [queryClient]
  )

  const rememberListItem = useCallback(
    (item: ThreadListItem) => {
      queryClient.setQueryData(
        threadQueryKeys.list(),
        (prev: ThreadListItem[] | undefined) =>
          upsertThreadListItem(prev ?? [], item)
      )
      if (item.focusDocId) {
        queryClient.setQueryData(
          threadQueryKeys.byFocusDoc(item.focusDocId),
          item
        )
      }
    },
    [queryClient]
  )

  const hydrateThread = useCallback(
    async (
      id: string,
      fallback?: ThreadMessage
    ): Promise<ThreadDetail | undefined> => {
      try {
        const detail = await getThread(id)
        writeDetail(id, detail)
        return detail
      } catch {
        const prev = queryClient.getQueryData<ThreadDetail>(
          threadQueryKeys.detail(id)
        )
        if (!fallback || !prev) return undefined
        const next = withFallbackMessage(prev, fallback)
        writeDetail(id, next)
        return next
      }
    },
    [queryClient, writeDetail]
  )

  const keepStreamedCoach = useCallback(
    (id: string, user: HomeMessage | undefined, parts: ThreadMessagePart[]) => {
      const next = withAbortedCoach({
        id,
        prev: queryClient.getQueryData<ThreadDetail>(
          threadQueryKeys.detail(id)
        ),
        user,
        parts,
        title: titleForCreate,
        focusDocId,
      })
      if (next) writeDetail(id, next)
    },
    [focusDocId, queryClient, titleForCreate, writeDetail]
  )

  const rememberPaperTools = useCallback(
    (parts: ThreadMessagePart[]) => {
      if (
        parts.some(
          (part) => part.type === "tool" && part.name.startsWith("paper_")
        )
      ) {
        void queryClient.invalidateQueries({ queryKey: paperQueryKeys.all })
      }
    },
    [queryClient]
  )

  return {
    writeDetail,
    rememberListItem,
    hydrateThread,
    keepStreamedCoach,
    rememberPaperTools,
  }
}
