export type MailThread = {
  id: string
  company: string
  role: string
  summary: string
  lastMessageAt: string
  unread: boolean
  suggestedStage: "interview" | null
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

export const FAKE_INBOX_THREADS: readonly MailThread[] = [
  {
    id: "fake-thread-northwind",
    company: "Northwind Labs",
    role: "Associate product manager intern",
    summary: "They asked for a 30 minute interview on Thursday.",
    lastMessageAt: "2026-10-26T02:00:00.000Z",
    unread: true,
    suggestedStage: "interview",
  },
  {
    id: "fake-thread-lumiere",
    company: "Lumiere",
    role: "Product intern",
    summary: "Thanks for applying. We will write if a role opens.",
    lastMessageAt: "2026-10-25T08:00:00.000Z",
    unread: true,
    suggestedStage: null,
  },
  {
    id: "fake-thread-harbor",
    company: "Harbor",
    role: "Business analyst intern",
    summary: "Please send a SQL sample before Friday.",
    lastMessageAt: "2026-10-24T09:00:00.000Z",
    unread: false,
    suggestedStage: null,
  },
  {
    id: "fake-thread-field",
    company: "Fieldnote",
    role: "Research intern",
    summary: "The hiring panel passed. Keep the research samples.",
    lastMessageAt: "2026-10-22T04:00:00.000Z",
    unread: false,
    suggestedStage: null,
  },
  {
    id: "fake-thread-kiln",
    company: "Kiln",
    role: "Design intern",
    summary: "Can you walk through one shipped experiment?",
    lastMessageAt: "2026-10-21T11:00:00.000Z",
    unread: true,
    suggestedStage: null,
  },
  {
    id: "fake-thread-atlas",
    company: "Atlas Books",
    role: "Operations intern",
    summary: "Your application is in the saved pile.",
    lastMessageAt: "2026-10-20T01:00:00.000Z",
    unread: false,
    suggestedStage: null,
  },
]

function messagesFor(thread: MailThread): MailMessage[] {
  return [
    {
      id: `${thread.id}-in`,
      direction: "in",
      fromName: thread.company,
      fromEmail: `hiring@${thread.company.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      toEmail: "you@example.com",
      bodyText: thread.summary,
      sentAt: thread.lastMessageAt,
    },
  ]
}

export function createFakeMailProvider(): MailProvider {
  const threads = FAKE_INBOX_THREADS.map((thread) => ({ ...thread }))
  return {
    async listThreads() {
      return threads.map((thread) => ({ ...thread }))
    },
    async getThread(id) {
      const thread = threads.find((item) => item.id === id)
      if (!thread) return null
      return { thread: { ...thread }, messages: messagesFor(thread) }
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
