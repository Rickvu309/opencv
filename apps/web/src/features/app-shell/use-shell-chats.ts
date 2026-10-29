import { useQuery } from "@tanstack/react-query"

import {
  inboxUnreadCount,
  starredJobs,
} from "@/features/app-shell/shell-api.ts"
import { inboxListKey, fetchInbox } from "@/features/inbox/inbox-api.ts"
import { jobListKey, listJobs } from "@/features/apply/apply-api.ts"
import { chatListKey, listChats } from "@/features/coach/chat-api.ts"
import { listPaper, paperListKey } from "@/features/paper/paper-api.ts"

export function useShellChats() {
  return useQuery({
    queryKey: chatListKey(),
    queryFn: listChats,
    select: (chats) => chats.slice(0, 2),
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
        .filter((doc) => doc.isFavorite && doc.kind === "cv")
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
