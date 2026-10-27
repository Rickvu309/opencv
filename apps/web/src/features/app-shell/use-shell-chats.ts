import { useQuery } from "@tanstack/react-query"

import {
  inboxUnreadCount,
  starredJobs,
} from "@/features/app-shell/shell-api.ts"
import { inboxListKey, fetchInbox } from "@/features/inbox/inbox-api.ts"
import { jobListKey, listJobs } from "@/features/apply/apply-api.ts"
import { chatListKey, listThreads } from "@/features/home/thread-api.ts"
import { listPaper, paperListKey } from "@/features/paper/paper-api.ts"

export function useShellChats() {
  return useQuery({
    queryKey: chatListKey(),
    queryFn: listThreads,
    select: (threads) => threads.slice(0, 2),
  })
}

export function useShellFavorites() {
  const jobs = useQuery({
    queryKey: jobListKey(),
    queryFn: listJobs,
    select: starredJobs,
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
    queryKey: inboxListKey(),
    queryFn: fetchInbox,
    select: inboxUnreadCount,
  })
}
