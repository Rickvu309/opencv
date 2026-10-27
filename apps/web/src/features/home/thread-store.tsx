import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import type { ThreadListItem } from "@workspace/domain"

import { refreshJobQueries } from "@/lib/contract-client.ts"
import { useCoachTurn } from "@/features/coach/use-coach-turn.ts"
import { profileQueryKeys } from "@/features/home/profile-api.ts"
import {
  deleteThread as deleteThreadRequest,
  listThreads,
  threadQueryKeys,
} from "@/features/home/thread-api.ts"
import { ThreadStoreContext } from "@/features/home/thread-store-context.ts"
import { titleFrom } from "@/features/home/threads.ts"

const EMPTY_THREADS: ThreadListItem[] = []

export function ThreadStoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: threadQueryKeys.list(),
    queryFn: listThreads,
  })
  const threads = listQuery.data ?? EMPTY_THREADS

  const {
    messages,
    phase,
    error,
    send,
    stop,
    retry,
    regenerate,
    rate,
    undo,
    cancelInFlight,
  } = useCoachTurn({
    threadId: activeThreadId,
    setThreadId: setActiveThreadId,
    titleForCreate: titleFrom,
    onAfterUndo: () => {
      void refreshJobQueries(queryClient)
      void queryClient.invalidateQueries({
        queryKey: profileQueryKeys.current(),
      })
    },
  })

  const newThread = useCallback(() => {
    cancelInFlight()
    setActiveThreadId(null)
  }, [cancelInFlight])

  const deleteThread = useCallback(
    async (id: string) => {
      await deleteThreadRequest({ threadId: id })
      queryClient.setQueryData(
        threadQueryKeys.list(),
        (prev: ThreadListItem[] | undefined) =>
          (prev ?? []).filter((thread) => thread.id !== id)
      )
      queryClient.removeQueries({ queryKey: threadQueryKeys.detail(id) })
      if (activeThreadId === id) {
        cancelInFlight()
        setActiveThreadId(null)
      }
    },
    [activeThreadId, cancelInFlight, queryClient]
  )

  const openThread = useCallback(
    (id: string) => {
      cancelInFlight()
      setActiveThreadId(id)
    },
    [cancelInFlight]
  )

  const value = useMemo(
    () => ({
      threads,
      activeThreadId,
      messages,
      phase,
      error,
      send,
      stop,
      retry,
      regenerate,
      rate,
      undo,
      openThread,
      newThread,
      deleteThread,
    }),
    [
      threads,
      activeThreadId,
      messages,
      phase,
      error,
      send,
      stop,
      retry,
      regenerate,
      rate,
      undo,
      openThread,
      newThread,
      deleteThread,
    ]
  )

  return (
    <ThreadStoreContext.Provider value={value}>
      {children}
    </ThreadStoreContext.Provider>
  )
}
