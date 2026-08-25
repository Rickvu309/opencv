import { useMemo } from "react"

import {
  toThreadListItems,
  type ThreadListPort,
} from "@/features/home/thread-list-port.ts"
import { useThreadStore } from "@/features/home/use-thread-store.ts"

export function useThreadList(): ThreadListPort {
  const { threads, activeThreadId, openThread, newThread } = useThreadStore()

  return useMemo(
    () => ({
      threads: toThreadListItems(threads),
      activeThreadId,
      openThread,
      newThread,
    }),
    [threads, activeThreadId, openThread, newThread]
  )
}
