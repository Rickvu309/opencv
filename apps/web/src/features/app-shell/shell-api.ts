import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export type ShellJob = {
  id: string
  title: string
  company: string
  starred: boolean
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function parseJobs(data: unknown): ShellJob[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    const row = record(item)
    if (row?.starred !== true) return []
    const title = text(row.title)
    if (!title) return []
    return [
      {
        id: text(row.id),
        title,
        company: text(row.company),
        starred: true,
      },
    ]
  })
}

export async function listStarredJobs() {
  try {
    const body = await apiFetch<SuccessBody<unknown>>("/api/jobs")
    return parseJobs(unwrapData(body))
  } catch {
    return []
  }
}

export function inboxUnreadCount(data: unknown) {
  const threads = record(data)?.threads
  if (!Array.isArray(threads)) return null
  const count = threads.filter((item) => record(item)?.unread === true).length
  return count > 0 ? count : null
}

export async function readInboxUnreadCount() {
  try {
    const body = await apiFetch<SuccessBody<unknown>>("/api/inbox")
    return inboxUnreadCount(unwrapData(body))
  } catch {
    return null
  }
}
