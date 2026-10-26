import { DEFAULT_TIME_ZONE } from "@workspace/domain"

export type CoachAttachment = {
  kind: "paper" | "job" | "file" | "link"
  id: string
  label: string
}

export type CoachUiPart =
  | { kind: "text"; text: string }
  | { kind: "step"; label: string }
  | {
      kind: "confirm"
      pendingActionId: string
      command: string
      summary: string
      decided?: "approved" | "denied"
    }
  | {
      kind: "result"
      activityId?: string
      name: string
      summary: string
      changes?: number
      docId?: string
      undone?: boolean
    }

export type CoachUiMessage = {
  id: string
  role: "person" | "coach"
  parts: CoachUiPart[]
  status: "final" | "error" | "aborted" | "awaiting"
  workedMs?: number
  startedAt?: number
}

export type CoachUsageView = {
  plan: "free" | "pro"
  mode: "free" | "light" | "max"
  caps: { free: number; light: number; max: number }
  day: {
    capped: boolean
    remaining?: number
    cap?: number
    resetsAt: string
  }
}

export type CoachListItem = {
  id: string
  title: string
  updatedAt: string
  focusKind?: string | null
  focusId?: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string) {
  return UUID_RE.test(value)
}

export function isFullLink(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function calendarDay(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

function shiftDay(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number)
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export type HistoryGroup = "Today" | "Yesterday" | "Last 7 days"

export function groupChats(
  chats: readonly CoachListItem[],
  timeZone = DEFAULT_TIME_ZONE,
  now = new Date()
) {
  const today = calendarDay(now.toISOString(), timeZone)
  const yesterday = shiftDay(today, -1)
  const older = new Set(
    Array.from({ length: 6 }, (_, index) => shiftDay(today, -(index + 2)))
  )
  const groups: Record<HistoryGroup, CoachListItem[]> = {
    Today: [],
    Yesterday: [],
    "Last 7 days": [],
  }
  for (const chat of chats) {
    const day = calendarDay(chat.updatedAt, timeZone)
    if (day === today) groups.Today.push(chat)
    else if (day === yesterday) groups.Yesterday.push(chat)
    else if (older.has(day)) groups["Last 7 days"].push(chat)
  }
  return groups
}

export function formatResetTime(iso: string, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00"
  return `${hour}:${minute}`
}

export function secondsBetween(start: number, end: number) {
  return Math.max(0, Math.round((end - start) / 1000))
}
