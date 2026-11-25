import { z } from "zod"

import { jobStageSchema } from "./job.js"
import type { ResourceRef } from "./resources.js"

export type MailThread = {
  id: string
  company: string
  role: string
  summary: string
  lastMessageAt: string
  unread: boolean
  suggestedStage: "interview" | null
  subject: string
  draft: MailDraft | null
  messages: MailMessage[]
}

type MailDraft = {
  body: string
  times: string[]
}

export type MailMessage = {
  id: string
  direction: "in" | "out"
  fromName: string
  fromEmail: string
  toEmail: string
  bodyText: string
  sentAt: string
}

type MailEventInput = {
  title: string
  start: string
  end: string
}

export type MailProvider = {
  listThreads(): Promise<MailThread[]>
  getThread(
    id: string
  ): Promise<{ thread: MailThread; messages: MailMessage[] } | null>
  send(threadId: string, body: string): Promise<{ id: string }>
  createEvent(input: MailEventInput): Promise<{ id: string }>
}

const messageSchema = z
  .object({
    id: z.string().min(1),
    direction: z.enum(["in", "out"]),
    fromName: z.string(),
    fromEmail: z.string(),
    toEmail: z.string(),
    bodyText: z.string(),
    sentAt: z.string(),
  })
  .strict()

const threadSchema = z
  .object({
    id: z.string().min(1),
    company: z.string(),
    role: z.string(),
    summary: z.string(),
    lastMessageAt: z.string(),
    unread: z.boolean(),
    suggestedStage: z.enum(["interview"]).nullable(),
    subject: z.string().optional(),
    draft: z
      .object({
        body: z.string(),
        times: z.array(z.string()),
      })
      .strict()
      .nullable()
      .optional(),
    messages: z.array(messageSchema).optional(),
  })
  .strict()

const fixtureSchema = z
  .object({
    threads: z.array(threadSchema),
  })
  .strict()

export function loadInboxFixture(raw: unknown): MailThread[] {
  const parsed = fixtureSchema.parse(raw)
  return parsed.threads.map((thread) => ({
    id: thread.id,
    company: thread.company,
    role: thread.role,
    summary: thread.summary,
    lastMessageAt: thread.lastMessageAt,
    unread: thread.unread,
    suggestedStage: thread.suggestedStage,
    subject: thread.subject ?? thread.summary,
    draft: thread.draft ?? null,
    messages: thread.messages ?? [],
  }))
}

export function createFakeMailProvider(
  source: readonly MailThread[]
): MailProvider {
  const threads = source.map((thread) => ({
    ...thread,
    draft: thread.draft
      ? { ...thread.draft, times: [...thread.draft.times] }
      : null,
    messages: thread.messages.map((message) => ({ ...message })),
  }))
  return {
    async listThreads() {
      return threads.map(copyThread)
    },
    async getThread(id) {
      const thread = threads.find((item) => item.id === id)
      if (!thread) return null
      return {
        thread: copyThread(thread),
        messages: thread.messages.map((message) => ({ ...message })),
      }
    },
    async send(threadId, body) {
      const thread = threads.find((item) => item.id === threadId)
      if (!thread) throw new Error("Unknown mail thread")
      return { id: `${threadId}-out-${body.length}` }
    },
    async createEvent(input) {
      return { id: `event-${input.start}` }
    },
  }
}

function copyThread(thread: MailThread): MailThread {
  return {
    ...thread,
    draft: thread.draft
      ? { body: thread.draft.body, times: [...thread.draft.times] }
      : null,
    messages: thread.messages.map((message) => ({ ...message })),
  }
}

export const inboxStatusSchema = z.enum(["open", "done", "snoozed"])

const suggestedStageSchema = z.enum(["interview"]).nullable()

export const inboxThreadSchema = z
  .object({
    id: z.string(),
    company: z.string(),
    role: z.string(),
    summary: z.string(),
    lastMessageAt: z.string().datetime(),
    unread: z.boolean(),
    suggestedStage: suggestedStageSchema,
    jobId: z.string().nullable(),
    status: inboxStatusSchema,
  })
  .strict()

export type InboxThread = z.output<typeof inboxThreadSchema>

export const inboxListSchema = z
  .object({
    connected: z.boolean(),
    skipped: z.boolean(),
    timeZone: z.string(),
    threads: z.array(inboxThreadSchema),
  })
  .strict()

const inboxMessageSchema = z
  .object({
    id: z.string(),
    direction: z.enum(["in", "out"]),
    fromName: z.string(),
    fromEmail: z.string(),
    toEmail: z.string(),
    bodyText: z.string(),
    sentAt: z.string().datetime(),
  })
  .strict()

const draftSchema = z
  .object({ body: z.string(), times: z.array(z.string()) })
  .strict()

export const inboxDetailSchema = inboxThreadSchema
  .extend({
    subject: z.string(),
    messages: z.array(inboxMessageSchema),
    draft: draftSchema.nullable(),
    job: z
      .object({ id: z.string(), title: z.string(), stage: jobStageSchema })
      .strict()
      .nullable(),
    openUrl: z.string().nullable(),
  })
  .strict()

export type InboxDetail = z.output<typeof inboxDetailSchema>

export const threadIdSchema = z.string().uuid()
export const emptyInboxInput = z.object({}).strict()
export const threadInput = z.object({ threadId: threadIdSchema }).strict()

export const draftOutput = z
  .object({ id: z.string(), body: z.string(), times: z.array(z.string()) })
  .strict()

export const inboxStatusChangeSchema = z
  .object({
    id: z.string(),
    previousStatus: inboxStatusSchema,
    previousSnoozeUntil: z.string().datetime().nullable(),
  })
  .strict()

export type InboxStatusChange = z.output<typeof inboxStatusChangeSchema>

export function inboxThreadResource(threadId?: string): ResourceRef {
  return {
    name: "inboxThread",
    coachFloor: "auto",
    ...(threadId ? { entityId: threadId } : {}),
  }
}
