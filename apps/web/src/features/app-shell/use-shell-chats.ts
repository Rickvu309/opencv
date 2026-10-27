import { useQuery } from "@tanstack/react-query"

import {
  listStarredJobs,
  readInboxUnreadCount,
} from "@/features/app-shell/shell-api.ts"
import { chatListKey, listThreads } from "@/features/home/thread-api.ts"
import { listPaper, paperListKey } from "@/features/paper/paper-api.ts"

export const shellQueryKeys = {
  jobs: ["shell", "jobs"] as const,
  inbox: ["shell", "inbox"] as const,
}

export function useShellChats() {
  return useQuery({
    queryKey: chatListKey(),
    queryFn: listThreads,
    select: (threads) => threads.slice(0, 2),
  })
}

export function useShellFavorites() {
  const jobs = useQuery({
    queryKey: shellQueryKeys.jobs,
    queryFn: listStarredJobs,
  })
  const docs = useQuery({
    queryKey: paperListKey(),
    queryFn: listPaper,
  })
  const favoriteDocs = docs.isError
    ? []
    : [...(docs.data ?? [])]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3)
  return {
    pending: jobs.isPending || docs.isPending,
    jobs: jobs.data ?? [],
    docs: favoriteDocs,
  }
}

export function useInboxUnread() {
  return useQuery({
    queryKey: shellQueryKeys.inbox,
    queryFn: readInboxUnreadCount,
  })
}
