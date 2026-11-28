import { fileIdSchema } from "@workspace/domain/kernel"

import { apiBaseUrl } from "@/lib/api-url.ts"

export const endpoints = {
  catalogRead: (name: string) => `/api/reads/${name}`,
  catalogCommand: (name: string) => `/api/commands/${name}`,
  publicConfig: "/api/public-config",
  coachTaskEvents: (taskId: string, after: number) =>
    `/api/coach/tasks/${taskId}/events?after=${after}`,
  accountPhoto: "/api/account/photo",
  accountExport: "/api/account/export",
  inboxConnect: "/api/inbox/connect",
  paper: "/api/paper",
  paperDoc: (docId: string) => `/api/paper/${docId}`,
  paperNativeWord: (docId: string, kind: "cv" | "letter") =>
    `/api/paper/${docId}/native-word?kind=${kind}`,
  paperFiles: "/api/paper/files",
  paperFileBytes: (fileId: string) => `/api/paper/files/${fileId}/bytes`,
  paperPages: (docId: string) => `/api/paper/${docId}/pages`,
  paperShared: (token: string) => `/api/paper/shared/${token}`,
  paperSharedPhoto: (token: string) => `/api/paper/shared/${token}/photo`,
  paperImport: "/api/paper/import",
  letterAttachment: "/api/paper/letter-attachment",
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
