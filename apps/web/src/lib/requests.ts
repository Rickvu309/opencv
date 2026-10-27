import { apiBaseUrl } from "@/lib/api-url.ts"

/** Every API path the web app reads or posts outside the command route. */
export const endpoints = {
  publicConfig: "/api/public-config",
  profile: "/api/profile",
  billing: "/api/billing",
  integrations: "/api/integrations",
  coachUsage: "/api/coach/usage",
  accountPhoto: "/api/account/photo",
  accountExport: "/api/account/export",
  inbox: "/api/inbox",
  inboxConnect: "/api/inbox/connect",
  inboxThread: (threadId: string) => `/api/inbox/${threadId}`,
  paper: "/api/paper",
  paperOfKind: (kind: string) => `/api/paper?kind=${kind}`,
  paperDoc: (docId: string) => `/api/paper/${docId}`,
  paperFiles: "/api/paper/files",
  paperPages: (docId: string) => `/api/paper/${docId}/pages`,
  paperShared: (token: string) => `/api/paper/shared/${token}`,
  paperImport: "/api/paper/import",
  paperPdf: (docId: string) => `/api/paper/${docId}/pdf`,
  chats: "/api/chats",
  chat: (chatId: string) => `/api/chats/${chatId}`,
  chatStop: (chatId: string) => `/api/chats/${chatId}/stop`,
  activity: (query: URLSearchParams | string) => `/api/activity?${query}`,
  activityOfSubject: (subjectId: string) =>
    `/api/activity?subjectId=${encodeURIComponent(subjectId)}`,
  jobs: "/api/jobs",
  job: (jobId: string) => `/api/jobs/${jobId}`,
  jobsCalendar: (query: URLSearchParams) => `/api/jobs/calendar?${query}`,
  jobsPreview: "/api/jobs/preview",
  search: (query: string) => `/api/search?q=${encodeURIComponent(query)}`,
} as const

/** Query keys for reads that are not contract queries. */
export const inboxConnectKey = ["inbox-connect"] as const

/** For bodies `apiFetch` cannot carry: uploads and file downloads. */
export function fetchBinary(path: string, init?: RequestInit) {
  return fetch(new URL(path, apiBaseUrl), init)
}
