import { brandName } from "@workspace/ui/lib/brand"

export const THREAD_STORAGE_KEY = "openpath.home.threads.v1"
export const COACH_THINKING_MS = 700
export const HISTORY_PREVIEW_COUNT = 4

export const STUB_COACH_REPLY =
  "I hear you. I haven't edited Paper or Apply, and I haven't run any Commands. I'm a stub Coach until those exist — we can keep talking here, or you can open those surfaces yourself."

export type MessageRole = "coach" | "user"

export type HomeMessage = {
  id: string
  role: MessageRole
  text: string
  workedMs?: number
}

export type HomeThread = {
  id: string
  title: string
  messages: HomeMessage[]
}

export type PersistedThreads = {
  threads: HomeThread[]
  activeThreadId: string | null
  messages: HomeMessage[]
}

function message(
  id: string,
  role: MessageRole,
  text: string,
  workedMs?: number
): HomeMessage {
  return workedMs == null ? { id, role, text } : { id, role, text, workedMs }
}

export const SEED_THREADS: HomeThread[] = [
  {
    id: "t1",
    title: "CV vs internship first",
    messages: [
      message(
        "t1-1",
        "coach",
        `Hey. I'm your ${brandName} Coach. Ask anything about direction or your next step.`
      ),
      message(
        "t1-2",
        "user",
        "I don't know if I should chase internships or finish my CV first."
      ),
      message(
        "t1-3",
        "coach",
        "Evidence over panic: open Paper when you're ready, or dump what's on your mind here. I haven't changed anything for you."
      ),
    ],
  },
  {
    id: "t2",
    title: "Checkout study → Proof",
    messages: [
      message(
        "t2-1",
        "user",
        "Can you turn my checkout study into a Proof in Paper?"
      ),
      message(
        "t2-2",
        "coach",
        "I can't write that Proof yet — I haven't edited Paper or run a Command. Open Paper when you want to draft it; we can talk through the story here."
      ),
    ],
  },
  {
    id: "t3",
    title: "Is this role a fit?",
    messages: [
      message(
        "t3-1",
        "user",
        "Is this internship a fit, and can you add it to Apply?"
      ),
      message(
        "t3-2",
        "coach",
        "I haven't scored Fit or added an Opportunity in Apply. I can help you think it through here until those Commands exist."
      ),
    ],
  },
  {
    id: "t4",
    title: "What should I do this week?",
    messages: [
      message("t4-1", "user", "What should I do this week?"),
      message(
        "t4-2",
        "coach",
        "Pick one concrete move you can finish — I won't pretend I scheduled it or updated Apply for you."
      ),
    ],
  },
  {
    id: "t5",
    title: "Talking about my internship",
    messages: [
      message(
        "t5-1",
        "user",
        "How do I talk about my internship without overselling it?"
      ),
      message(
        "t5-2",
        "coach",
        "Stick to what you did and what changed. I haven't touched your CV or Pitch."
      ),
    ],
  },
]

export function emptyThreadState(): PersistedThreads {
  return {
    threads: SEED_THREADS,
    activeThreadId: null,
    messages: [],
  }
}

export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= 36) return clean
  return `${clean.slice(0, 36)}…`
}

function isMessage(value: unknown): value is HomeMessage {
  if (!value || typeof value !== "object") return false
  const candidate = value as HomeMessage
  return (
    typeof candidate.id === "string" &&
    (candidate.role === "coach" || candidate.role === "user") &&
    typeof candidate.text === "string" &&
    (candidate.workedMs === undefined || typeof candidate.workedMs === "number")
  )
}

function isThread(value: unknown): value is HomeThread {
  if (!value || typeof value !== "object") return false
  const candidate = value as HomeThread
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every(isMessage)
  )
}

export function readPersistedThreads(): PersistedThreads | null {
  if (typeof sessionStorage === "undefined") return null

  try {
    const raw = sessionStorage.getItem(THREAD_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PersistedThreads>
    if (!Array.isArray(parsed.threads) || !parsed.threads.every(isThread)) {
      return null
    }
    if (!Array.isArray(parsed.messages) || !parsed.messages.every(isMessage)) {
      return null
    }
    if (
      parsed.activeThreadId !== null &&
      typeof parsed.activeThreadId !== "string"
    ) {
      return null
    }

    return {
      threads: parsed.threads,
      activeThreadId: parsed.activeThreadId,
      messages: parsed.messages,
    }
  } catch {
    return null
  }
}

export function writePersistedThreads(state: PersistedThreads) {
  if (typeof sessionStorage === "undefined") return

  try {
    sessionStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private mode / quota — in-memory state still works.
  }
}
