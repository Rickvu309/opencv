import type { QueryOutput } from "@workspace/domain"

import { ApiError, apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export class InboxLimitError extends Error {
  readonly resetsAt: string | null

  constructor(message: string, resetsAt: string | null) {
    super(message)
    this.name = "InboxLimitError"
    this.resetsAt = resetsAt
  }
}

export function isCoachLimit(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === 429 || error.code === "COACH_LIMIT_REACHED")
  )
}

export async function inboxLimitFrom(error: ApiError) {
  return new InboxLimitError(error.message, await readCoachReset())
}

export function fetchInbox() {
  return apiFetch<SuccessBody<QueryOutput<"inbox.list">>>("/api/inbox").then(
    unwrapData
  )
}

export function fetchThread(threadId: string) {
  return apiFetch<SuccessBody<QueryOutput<"inbox.get">>>(
    `/api/inbox/${threadId}`
  ).then(unwrapData)
}

/** Not a contract query: the route returns a redirect target for Gmail. */
export function fetchConnect() {
  return apiFetch<SuccessBody<unknown>>("/api/inbox/connect").then((body) =>
    parseConnect(unwrapData(body))
  )
}

async function readCoachReset() {
  try {
    const body = await apiFetch<SuccessBody<unknown>>("/api/coach/usage")
    return resetsAtOf(unwrapData(body))
  } catch {
    return null
  }
}

function resetsAtOf(value: unknown) {
  if (!value || typeof value !== "object") return null
  const row = value as { resetsAt?: unknown; day?: { resetsAt?: unknown } }
  if (typeof row.resetsAt === "string") return row.resetsAt
  if (typeof row.day?.resetsAt === "string") return row.day.resetsAt
  return null
}

function parseConnect(value: unknown) {
  if (!value || typeof value !== "object" || !("url" in value)) {
    return { url: null as string | null }
  }
  const url = (value as { url: unknown }).url
  return { url: typeof url === "string" && url.trim() ? url : null }
}
