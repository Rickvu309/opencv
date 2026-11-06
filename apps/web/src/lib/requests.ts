import { fileIdSchema } from "@workspace/domain"

import { apiBaseUrl } from "@/lib/api-url.ts"

export const endpoints = {
  publicConfig: "/api/public-config",
  profile: "/api/profile",
  billing: "/api/billing",
  integrations: "/api/integrations",
  coachUsage: "/api/coach/usage",
  accountPhoto: "/api/account/photo",
  accountExport: "/api/account/export",
  inbox: "/api/inbox",
  inboxSnoozed: "/api/inbox/snoozed",
  inboxConnect: "/api/inbox/connect",
  inboxThread: (threadId: string) => `/api/inbox/${threadId}`,
  paper: "/api/paper",
  paperOfKind: (kind: "cv" | "letter") => `/api/paper?kind=${kind}`,
  paperDoc: (docId: string) => `/api/paper/${docId}`,
  paperFiles: "/api/paper/files",
  paperFileBytes: (fileId: string) => `/api/paper/files/${fileId}/bytes`,
  paperPages: (docId: string) => `/api/paper/${docId}/pages`,
  paperShared: (token: string) => `/api/paper/shared/${token}`,
  paperSharedPhoto: (token: string) => `/api/paper/shared/${token}/photo`,
  paperImport: "/api/paper/import",
  letterAttachment: "/api/paper/letter-attachment",
  chats: "/api/chats",
  chat: (chatId: string) => `/api/chats/${chatId}`,
  chatStop: (chatId: string) => `/api/chats/${chatId}/stop`,
  activity: (query: URLSearchParams) => `/api/activity?${query}`,
  activityOfSubject: (subjectId: string) =>
    `/api/activity?subjectId=${encodeURIComponent(subjectId)}`,
  jobs: "/api/jobs",
  jobsPriorityCounts: "/api/jobs/priority-counts",
  job: (jobId: string) => `/api/jobs/${jobId}`,
  jobsCalendar: (query: URLSearchParams) => `/api/jobs/calendar?${query}`,
  jobsPreview: "/api/jobs/preview",
  search: (query: string) => `/api/search?q=${encodeURIComponent(query)}`,
} as const

export const inboxConnectReadKeyOutsideContract = ["inbox-connect"] as const

export function fetchBinary(path: string, init?: RequestInit) {
  return fetch(new URL(path, apiBaseUrl), init)
}

export function resolvePhotoSrc(
  stored: string | undefined,
  shareToken?: string
) {
  if (!stored || stored.startsWith("blob:")) return undefined
  if (stored.startsWith("file:")) {
    const id = stored.slice("file:".length)
    if (!id) return undefined
    const path = shareToken
      ? endpoints.paperSharedPhoto(shareToken)
      : endpoints.paperFileBytes(id)
    return new URL(path, apiBaseUrl).href
  }
  if (stored.startsWith("https://") || stored.startsWith("http://"))
    return stored
  return undefined
}

export function resolveProfileImageSrc(stored: string | null | undefined) {
  if (!stored || stored.startsWith("blob:")) return undefined
  if (stored.startsWith("https://") || stored.startsWith("http://"))
    return stored
  if (!fileIdSchema.safeParse(stored).success) return undefined
  return new URL(endpoints.paperFileBytes(stored), apiBaseUrl).href
}
