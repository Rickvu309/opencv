import { useQuery } from "@tanstack/react-query"

import {
  listShellChats,
  listStarredJobs,
  readInboxUnreadCount,
} from "@/features/app-shell/shell-api.ts"
import { listPaperDocs, paperQueryKeys } from "@/features/paper/paper-api.ts"

export const shellQueryKeys = {
  chats: ["shell", "chats"] as const,
  jobs: ["shell", "jobs"] as const,
  inbox: ["shell", "inbox"] as const,
}

export function useShellChats() {
  return useQuery({
    queryKey: shellQueryKeys.chats,
    queryFn: listShellChats,
  })
}

export function useShellFavorites() {
  const jobs = useQuery({
    queryKey: shellQueryKeys.jobs,
    queryFn: listStarredJobs,
  })
  const docs = useQuery({
    queryKey: paperQueryKeys.list(),
    queryFn: listPaperDocs,
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
