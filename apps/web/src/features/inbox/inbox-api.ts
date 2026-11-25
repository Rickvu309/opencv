import { ApiError, apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { endpoints } from "@/lib/requests.ts"

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

export function fetchGmailConnectTargetNotAContractRead() {
  return apiFetch<SuccessBody<unknown>>(endpoints.inboxConnect).then((body) =>
    parseConnect(unwrapData(body))
  )
}

async function readCoachReset() {
  try {
    const body = await apiFetch<SuccessBody<unknown>>(endpoints.coachUsage)
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
