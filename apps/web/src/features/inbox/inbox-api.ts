import { ApiError, apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export type InboxStatus = "open" | "done" | "snoozed"

export type InboxThread = {
  id: string
  company: string
  role: string
  summary: string
  lastMessageAt: string
  unread: boolean
  suggestedStage: "interview" | null
  jobId: string | null
  status: InboxStatus
}

export type InboxList = {
  connected: boolean
  skipped: boolean
  threads: InboxThread[]
}

export type InboxMessage = {
  id: string
  direction: "in" | "out"
  fromName: string
  fromEmail: string
  toEmail: string
  bodyText: string
  sentAt: string
}

export type InboxDetail = InboxThread & {
  subject: string
  messages: InboxMessage[]
  draft: { body: string; times: string[] } | null
  job: { id: string; title: string; stage: string } | null
  openUrl: string | null
}

export type ScanResult = {
  threads: InboxThread[]
  emailCount: number
  companyCount: number
}

export type CommandDone = {
  id?: string
  activityId?: string | null
  body?: string
  times?: string[]
}

export const inboxKeys = {
  list: ["inbox", "list"] as const,
  connect: ["inbox", "connect"] as const,
  thread: (id: string) => ["inbox", "thread", id] as const,
}

export function isCoachLimit(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 429 || error.code === "COACH_LIMIT_REACHED")
  )
}

export function fetchInbox() {
  return apiFetch<SuccessBody<unknown>>("/api/inbox").then((body) =>
    parseList(unwrapData(body))
  )
}

export function fetchConnect() {
  return apiFetch<SuccessBody<unknown>>("/api/inbox/connect").then((body) =>
    parseConnect(unwrapData(body))
  )
}

export function fetchThread(id: string) {
  return apiFetch<SuccessBody<unknown>>(`/api/inbox/${id}`).then((body) =>
    parseDetail(unwrapData(body))
  )
}

export function fetchTimeZone() {
  return apiFetch<SuccessBody<{ timeZone?: string }>>("/api/profile")
    .then((body) => unwrapData(body).timeZone || "")
    .catch(() => "")
}

export function skipInbox() {
  return post("inbox.skip", {})
}

export function scanInbox() {
  return post<ScanResult>("inbox.scan", {}).then((result) => ({
    threads: Array.isArray(result.threads)
      ? result.threads.filter(isThread)
      : [],
    emailCount: numberOf(result.emailCount),
    companyCount: numberOf(result.companyCount),
  }))
}

export function markDone(threadId: string) {
  return post<CommandDone>("inbox.markDone", { threadId })
}

export function snoozeThread(threadId: string, until: string) {
  return post<CommandDone>("inbox.snooze", { threadId, until })
}

export function clearSuggestion(threadId: string) {
  return post<CommandDone>("inbox.clearSuggestion", { threadId })
}

export function acceptSuggestion(threadId: string) {
  return post<CommandDone>("inbox.acceptSuggestion", { threadId })
}

export function draftReply(threadId: string, hint?: string) {
  return post<CommandDone>(
    "inbox.draftReply",
    hint ? { threadId, hint } : { threadId }
  )
}

export function updateInboxDraft(threadId: string, body: string) {
  return post<CommandDone>("inbox.updateDraft", { threadId, body })
}

export function sendReply(threadId: string) {
  return post<CommandDone>("inbox.send", { threadId })
}

export function addToCalendar(threadId: string, start: string) {
  return post<CommandDone>("inbox.addToCalendar", { threadId, start })
}

export function undoActivity(activityId: string) {
  return post("activity.undo", { activityId })
}

async function post<T>(name: string, input: unknown): Promise<T> {
  const body = await apiFetch<SuccessBody<T>>(`/api/commands/${name}`, {
    method: "POST",
    body: JSON.stringify({
      input,
      idempotencyKey: crypto.randomUUID(),
    }),
  })
  return unwrapData(body)
}

function parseList(value: unknown): InboxList {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { connected: false, skipped: false, threads: [] }
  }
  const row = value as {
    connected?: unknown
    skipped?: unknown
    threads?: unknown
  }
  return {
    connected: row.connected === true,
    skipped: row.skipped === true,
    threads: Array.isArray(row.threads) ? row.threads.filter(isThread) : [],
  }
}

function parseConnect(value: unknown) {
  if (!value || typeof value !== "object" || !("url" in value)) {
    return { url: null as string | null }
  }
  const url = (value as { url: unknown }).url
  return { url: typeof url === "string" && url.trim() ? url : null }
}

function parseDetail(value: unknown): InboxDetail {
  if (!isThread(value)) {
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Could not load inbox. Refresh the page."
    )
  }
  const row = value as InboxThread & {
    subject?: unknown
    messages?: unknown
    draft?: unknown
    job?: unknown
    openUrl?: unknown
  }
  return {
    ...row,
    subject: typeof row.subject === "string" ? row.subject : row.summary,
    messages: Array.isArray(row.messages) ? row.messages.filter(isMessage) : [],
    draft: parseDraft(row.draft),
    job: parseJob(row.job),
    openUrl: typeof row.openUrl === "string" ? row.openUrl : null,
  }
}

function parseDraft(value: unknown) {
  if (!value || typeof value !== "object") return null
  const draft = value as { body?: unknown; times?: unknown }
  const body = typeof draft.body === "string" ? draft.body : ""
  const times = Array.isArray(draft.times)
    ? draft.times.filter((item): item is string => typeof item === "string")
    : []
  if (!body && times.length === 0) return null
  return { body, times }
}

function parseJob(value: unknown) {
  if (!value || typeof value !== "object") return null
  const job = value as { id?: unknown; title?: unknown; stage?: unknown }
  if (typeof job.id !== "string" || typeof job.title !== "string") return null
  return {
    id: job.id,
    title: job.title,
    stage: typeof job.stage === "string" ? job.stage : "saved",
  }
}

function isThread(value: unknown): value is InboxThread {
  if (!value || typeof value !== "object") return false
  const row = value as Partial<InboxThread>
  return (
    typeof row.id === "string" &&
    typeof row.company === "string" &&
    typeof row.role === "string" &&
    typeof row.summary === "string" &&
    typeof row.lastMessageAt === "string"
  )
}

function isMessage(value: unknown): value is InboxMessage {
  if (!value || typeof value !== "object") return false
  const row = value as Partial<InboxMessage>
  return typeof row.id === "string" && typeof row.bodyText === "string"
}

function numberOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
