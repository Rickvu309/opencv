import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export type ShellProfile = {
  name: string | null
  image: string | null
  startPage: string | null
  timeZone: string | null
}

export type ShellChat = {
  id: string
  title: string
  updatedAt: string
}

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

export function parseShellProfile(data: unknown): ShellProfile {
  const row = record(data)
  return {
    name: text(row?.name) || null,
    image: text(row?.image) || null,
    startPage: text(row?.startPage) || null,
    timeZone: text(row?.timeZone) || null,
  }
}

export async function getShellProfile() {
  const body = await apiFetch<SuccessBody<unknown>>("/api/profile")
  return parseShellProfile(unwrapData(body))
}

function parseChats(data: unknown): ShellChat[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    const row = record(item)
    const id = text(row?.id)
    if (!id) return []
    return [
      {
        id,
        title: text(row?.title),
        updatedAt: text(row?.updatedAt),
      },
    ]
  })
}

export async function listShellChats() {
  try {
    const body = await apiFetch<SuccessBody<unknown>>("/api/chats")
    return parseChats(unwrapData(body)).slice(0, 2)
  } catch {
    return []
  }
}

export async function createShellChat() {
  const body = await apiFetch<SuccessBody<unknown>>(
    "/api/commands/chat.create",
    {
      method: "POST",
      body: JSON.stringify({
        input: {},
        idempotencyKey: crypto.randomUUID(),
      }),
    }
  )
  const row = record(unwrapData(body))
  const id = text(row?.id)
  if (!id) throw new Error("Chat was not created")
  return { id, title: text(row?.title) }
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
  if (!Array.isArray(data)) return null
  const count = data.filter((item) => record(item)?.unread === true).length
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
