import { z } from "zod"

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

export type MailDraft = {
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

export type MailEventInput = {
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
