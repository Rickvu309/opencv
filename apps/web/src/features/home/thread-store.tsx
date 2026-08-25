import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import type { ThreadListItem } from "@workspace/domain"

import {
  createThread,
  getThread,
  listThreads,
  postThreadMessage,
  threadQueryKeys,
  toListItem,
  upsertThreadListItem,
} from "@/features/home/thread-api.ts"
import { ThreadStoreContext } from "@/features/home/thread-store-context.ts"
import {
  titleFrom,
  toHomeMessages,
  type HomeMessage,
} from "@/features/home/threads.ts"

const EMPTY_THREADS: ThreadListItem[] = []

export function ThreadStoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [optimisticMessages, setOptimisticMessages] = useState<
    HomeMessage[] | null
  >(null)
  const [thinking, setThinking] = useState(false)
  const sendGeneration = useRef(0)

  const listQuery = useQuery({
    queryKey: threadQueryKeys.list(),
    queryFn: listThreads,
  })
  const threads = listQuery.data ?? EMPTY_THREADS

  const detailQuery = useQuery({
    queryKey: threadQueryKeys.detail(activeThreadId ?? ""),
    queryFn: () => getThread(activeThreadId!),
    enabled: Boolean(activeThreadId) && !thinking,
  })

  const messages = useMemo(() => {
    if (optimisticMessages) return optimisticMessages
    if (detailQuery.data) return toHomeMessages(detailQuery.data.messages)
    return []
  }, [detailQuery.data, optimisticMessages])

  const cancelInFlight = useCallback(() => {
    sendGeneration.current += 1
    setThinking(false)
    setOptimisticMessages(null)
  }, [])

  const newThread = useCallback(() => {
    cancelInFlight()
    setActiveThreadId(null)
  }, [cancelInFlight])

  const openThread = useCallback(
    (id: string) => {
      cancelInFlight()
      setActiveThreadId(id)
    },
    [cancelInFlight]
  )

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || thinking) return false

      const generation = ++sendGeneration.current
      const startedAt = Date.now()
      const optimistic: HomeMessage = {
        id: `local-${crypto.randomUUID()}`,
        role: "user",
        text: trimmed,
      }
      const baseline =
        optimisticMessages ??
        (detailQuery.data ? toHomeMessages(detailQuery.data.messages) : [])

      setOptimisticMessages([...baseline, optimistic])
      setThinking(true)

      void (async () => {
        try {
          let threadId = activeThreadId
          if (!threadId) {
            const created = await createThread({ title: titleFrom(trimmed) })
            queryClient.setQueryData(
              threadQueryKeys.list(),
              (prev: ThreadListItem[] | undefined) =>
                upsertThreadListItem(prev ?? [], created)
            )
            if (generation !== sendGeneration.current) return
            threadId = created.id
            setActiveThreadId(threadId)
          }

          const detail = await postThreadMessage({
            threadId,
            text: trimmed,
          })
          queryClient.setQueryData(threadQueryKeys.detail(threadId), detail)
          queryClient.setQueryData(
            threadQueryKeys.list(),
            (prev: ThreadListItem[] | undefined) =>
              upsertThreadListItem(prev ?? [], toListItem(detail))
          )
          if (generation !== sendGeneration.current) return

          setOptimisticMessages(
            toHomeMessages(detail.messages, Date.now() - startedAt)
          )
        } finally {
          if (generation === sendGeneration.current) {
            setThinking(false)
          }
        }
      })()

      return true
    },
    [
      activeThreadId,
      detailQuery.data,
      optimisticMessages,
      queryClient,
      thinking,
    ]
  )

  const value = useMemo(
    () => ({
      threads,
      activeThreadId,
      messages,
      thinking,
      send,
      openThread,
      newThread,
    }),
    [threads, activeThreadId, messages, thinking, send, openThread, newThread]
  )

  return (
    <ThreadStoreContext.Provider value={value}>
      {children}
    </ThreadStoreContext.Provider>
  )
}
