import {
  ERROR_CODES,
  createFakeMailProvider,
  type Actor,
  type InboxDetail,
  type InboxThread,
  type MailMessage,
  type MailProvider,
  type MailThread,
} from "@workspace/domain"
import { and, asc, desc, eq } from "drizzle-orm"

import {
  authUrlFromEnv,
  gmailEnabledFromEnv,
  googleClientIdFromEnv,
} from "../platform/config.js"
import { markInboxSkipped } from "../account/index.js"
import { getDb } from "../db/context.js"
import {
  connections,
  inboxMessages,
  inboxThreads,
  jobs,
  user,
} from "../db/schema.js"
import { createId } from "../platform/id.js"
import { CommandError } from "../platform/errors.js"
import { loadFixtureThreads } from "./fixture.js"
import { matchInboxJob } from "./match.js"

type ThreadRow = typeof inboxThreads.$inferSelect

export function gmailIsConfigured(env: NodeJS.ProcessEnv = process.env) {
  return gmailEnabledFromEnv(env) && Boolean(googleClientIdFromEnv(env))
}

export function connectUrl(env: NodeJS.ProcessEnv = process.env) {
  const clientId = googleClientIdFromEnv(env)
  if (!gmailIsConfigured(env) || !clientId) return null
  const redirect = new URL("/api/inbox/callback", authUrlFromEnv(env))
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirect.toString())
  url.searchParams.set("response_type", "code")
  url.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/gmail.readonly"
  )
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  return url.toString()
}

function mailProvider(env: NodeJS.ProcessEnv = process.env): MailProvider {
  if (gmailIsConfigured(env)) {
    throw new CommandError(
      ERROR_CODES.AUTH_UNAVAILABLE,
      "Gmail is not connected on this server. You can skip for now."
    )
  }
  return createFakeMailProvider(loadFixtureThreads(env))
}

export async function readInbox(userId: string) {
  return readInboxView(userId, "inbox")
}

export async function readSnoozedInbox(userId: string) {
  return readInboxView(userId, "snoozed")
}

async function readInboxView(userId: string, view: "inbox" | "snoozed") {
  const profile = await profileRow(userId)
  const threads = await getDb()
    .select()
    .from(inboxThreads)
    .where(eq(inboxThreads.userId, userId))
    .orderBy(desc(inboxThreads.lastMessageAt))
  const now = Date.now()
  return {
    connected: await gmailConnected(userId),
    skipped: profile.inboxSkippedAt != null,
    timeZone: profile.timeZone,
    threads: threads
      .filter((row) =>
        view === "snoozed"
          ? row.status === "snoozed" && (row.snoozeUntil?.getTime() ?? 0) > now
          : visibleWhileSnoozed(row, now)
      )
      .map(toListItem),
  }
}

export async function readInboxThread(
  userId: string,
  threadId: string
): Promise<InboxDetail> {
  const row = await ownedThread(userId, threadId)
  const messages = await getDb()
    .select()
    .from(inboxMessages)
    .where(eq(inboxMessages.threadId, row.id))
    .orderBy(asc(inboxMessages.sentAt))
  const job = row.jobId ? await jobSummary(userId, row.jobId) : null
  const fixture = loadFixtureThreads().find(
    (thread) => thread.id === row.providerThreadId
  )
  return {
    ...toListItem(row),
    subject: fixture?.subject || row.summary,
    messages: messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      fromName: message.fromName ?? "",
      fromEmail: message.fromEmail ?? "",
      toEmail: message.toEmail ?? "",
      bodyText: message.bodyText,
      sentAt: message.sentAt.toISOString(),
    })),
    draft: draftOf(row),
    job,
    openUrl: null,
  }
}

export async function skipInbox(actor: Actor) {
  await markInboxSkipped(actor.userId)
  return { skipped: true as const }
}

export async function scanInbox(actor: Actor) {
  const provider = mailProvider()
  const connectionId = await expiredGmailFixtureConnection(actor.userId)
  const source = await provider.listThreads()
  const jobRows = await getDb()
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .where(eq(jobs.userId, actor.userId))
    .orderBy(desc(jobs.updatedAt), desc(jobs.id))
  const companies = new Set<string>()
  const saved: InboxThread[] = []
  for (const thread of source) {
    companies.add(thread.company.trim().toLowerCase())
    const detail = await provider.getThread(thread.id)
    const messages = detail?.messages ?? thread.messages
    const match = matchInboxJob(thread, jobRows)
    const row = await upsertThread(
      actor.userId,
      connectionId,
      thread,
      messages,
      match
    )
    await upsertMessages(row.id, messages)
    saved.push(toListItem(row))
  }
  return {
    threads: saved,
    emailCount: source.length,
    companyCount: companies.size,
  }
}

export async function setThreadStatus(
  actor: Actor,
  threadId: string,
  status: "open" | "done" | "snoozed",
  snoozeUntil: Date | null
) {
  const current = await ownedThread(actor.userId, threadId)
  await getDb()
    .update(inboxThreads)
    .set({ status, snoozeUntil })
    .where(eq(inboxThreads.id, current.id))
  return {
    id: current.id,
    previousStatus: current.status,
    previousSnoozeUntil: current.snoozeUntil?.toISOString() ?? null,
  }
}

export async function clearSuggestion(actor: Actor, threadId: string) {
  const current = await ownedThread(actor.userId, threadId)
  await getDb()
    .update(inboxThreads)
    .set({ suggestedStage: null })
    .where(eq(inboxThreads.id, current.id))
  return { id: current.id, previousStage: current.suggestedStage }
}

export async function updateDraft(
  actor: Actor,
  threadId: string,
  body: string
) {
  const current = await ownedThread(actor.userId, threadId)
  await getDb()
    .update(inboxThreads)
    .set({ draftBody: body })
    .where(eq(inboxThreads.id, current.id))
  return { id: current.id, body, times: timesOf(current) }
}

export async function sendReply(actor: Actor, threadId: string) {
  const current = await ownedThread(actor.userId, threadId)
  const body = current.draftBody?.trim() ?? ""
  if (!body) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Write a reply before sending."
    )
  }
  const profile = await profileRow(actor.userId)
  let sent: { id: string }
  try {
    sent = await mailProvider().send(current.providerThreadId, body)
  } catch {
    throw new CommandError(
      ERROR_CODES.INTERNAL_ERROR,
      "Could not send that reply. Try it again."
    )
  }
  const inbound = await latestInbound(current.id)
  const id = createId()
  await getDb()
    .insert(inboxMessages)
    .values({
      id,
      threadId: current.id,
      providerMessageId: sent.id,
      direction: "out",
      fromName: profile.name,
      fromEmail: profile.email,
      toEmail: inbound?.fromEmail ?? profile.email,
      bodyText: body,
      sentAt: new Date(),
    })
  await getDb()
    .update(inboxThreads)
    .set({ draftBody: "", unread: false })
    .where(eq(inboxThreads.id, current.id))
  return { id, threadId: current.id, body }
}

export async function addToCalendar(
  actor: Actor,
  threadId: string,
  start: string
) {
  const current = await ownedThread(actor.userId, threadId)
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Choose a time before adding it to the calendar."
    )
  }
  const end = new Date(startDate.getTime() + 20 * 60 * 1000).toISOString()
  const created = await mailProvider().createEvent({
    title: current.role || current.summary,
    start: startDate.toISOString(),
    end,
  })
  return {
    id: created.id,
    threadId: current.id,
    start: startDate.toISOString(),
  }
}

export async function fixtureDraft(actor: Actor, threadId: string) {
  const current = await ownedThread(actor.userId, threadId)
  const fixture = loadFixtureThreads().find(
    (thread) => thread.id === current.providerThreadId
  )
  const body = current.draftBody ?? fixture?.draft?.body ?? ""
  const times = timesOf(current).length
    ? timesOf(current)
    : (fixture?.draft?.times ?? [])
  if (current.draftBody == null && fixture?.draft) {
    await getDb()
      .update(inboxThreads)
      .set({ draftBody: fixture.draft.body, draftTimes: fixture.draft.times })
      .where(eq(inboxThreads.id, current.id))
  }
  return { id: current.id, body, times }
}

async function gmailConnected(userId: string) {
  if (!gmailIsConfigured()) return false
  const rows = await getDb()
    .select({ token: connections.accessToken, status: connections.status })
    .from(connections)
    .where(
      and(eq(connections.userId, userId), eq(connections.provider, "gmail"))
    )
    .limit(1)
  return Boolean(rows[0]?.token) && rows[0]?.status === "active"
}

async function profileRow(userId: string) {
  const rows = await getDb()
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Profile not found")
  return row
}

async function ownedThread(userId: string, threadId: string) {
  const rows = await getDb()
    .select()
    .from(inboxThreads)
    .where(and(eq(inboxThreads.id, threadId), eq(inboxThreads.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Thread not found")
  return row
}

async function jobSummary(userId: string, jobId: string) {
  const rows = await getDb()
    .select({ id: jobs.id, title: jobs.title, stage: jobs.stage })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return { id: row.id, title: row.title, stage: row.stage }
}

async function latestInbound(threadId: string) {
  const rows = await getDb()
    .select()
    .from(inboxMessages)
    .where(
      and(
        eq(inboxMessages.threadId, threadId),
        eq(inboxMessages.direction, "in")
      )
    )
    .orderBy(desc(inboxMessages.sentAt))
    .limit(1)
  return rows[0] ?? null
}

async function expiredGmailFixtureConnection(userId: string) {
  const rows = await getDb()
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(eq(connections.userId, userId), eq(connections.provider, "gmail"))
    )
    .limit(1)
  if (rows[0]) return rows[0].id
  const id = createId()
  await getDb().insert(connections).values({
    id,
    userId,
    provider: "gmail",
    status: "expired",
  })
  return id
}

async function upsertThread(
  userId: string,
  connectionId: string,
  thread: MailThread,
  messages: MailMessage[],
  match: { jobId: string | null; suggestedStage: "interview" | null }
) {
  const existing = await getDb()
    .select()
    .from(inboxThreads)
    .where(
      and(
        eq(inboxThreads.connectionId, connectionId),
        eq(inboxThreads.providerThreadId, thread.id)
      )
    )
    .limit(1)
  const knownIncomingIds = existing[0]
    ? new Set(
        (
          await getDb()
            .select({ providerMessageId: inboxMessages.providerMessageId })
            .from(inboxMessages)
            .where(
              and(
                eq(inboxMessages.threadId, existing[0].id),
                eq(inboxMessages.direction, "in")
              )
            )
        ).map((message) => message.providerMessageId)
      )
    : new Set<string>()
  const hasNewIncoming =
    existing[0] != null &&
    messages.some(
      (message) =>
        message.direction === "in" && !knownIncomingIds.has(message.id)
    )
  const fields = {
    company: thread.company,
    role: thread.role,
    summary: thread.summary,
    lastMessageAt: new Date(thread.lastMessageAt),
    unread: hasNewIncoming
      ? true
      : existing[0] && !existing[0].unread && thread.unread
        ? false
        : thread.unread,
    jobId: match.jobId,
    suggestedStage: match.suggestedStage,
  }
  if (existing[0]) {
    await getDb()
      .update(inboxThreads)
      .set(fields)
      .where(eq(inboxThreads.id, existing[0].id))
    return { ...existing[0], ...fields }
  }
  const id = createId()
  await getDb()
    .insert(inboxThreads)
    .values({
      id,
      userId,
      connectionId,
      providerThreadId: thread.id,
      ...fields,
      draftBody: thread.draft?.body ?? null,
      draftTimes: thread.draft?.times ?? null,
    })
  const inserted = await ownedThread(userId, id)
  return inserted
}

async function upsertMessages(threadId: string, messages: MailMessage[]) {
  for (const message of messages) {
    const existing = await getDb()
      .select({ id: inboxMessages.id })
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.threadId, threadId),
          eq(inboxMessages.providerMessageId, message.id)
        )
      )
      .limit(1)
    if (existing[0]) continue
    await getDb()
      .insert(inboxMessages)
      .values({
        id: createId(),
        threadId,
        providerMessageId: message.id,
        direction: message.direction,
        fromName: message.fromName,
        fromEmail: message.fromEmail,
        toEmail: message.toEmail,
        bodyText: message.bodyText,
        sentAt: new Date(message.sentAt),
      })
  }
}

function visibleWhileSnoozed(row: ThreadRow, now: number) {
  if (row.status === "done") return false
  if (row.status !== "snoozed" || !row.snoozeUntil) return true
  return row.snoozeUntil.getTime() <= now
}

function toListItem(row: ThreadRow): InboxThread {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    summary: row.summary,
    lastMessageAt: (row.lastMessageAt ?? row.createdAt).toISOString(),
    unread: row.unread,
    suggestedStage: row.jobId ? row.suggestedStage : null,
    jobId: row.jobId,
    status: row.status,
  }
}

function draftOf(row: ThreadRow) {
  if (row.draftBody == null && timesOf(row).length === 0) return null
  return { body: row.draftBody ?? "", times: timesOf(row) }
}

function timesOf(row: ThreadRow) {
  return Array.isArray(row.draftTimes)
    ? row.draftTimes.filter((item): item is string => typeof item === "string")
    : []
}
