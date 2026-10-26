import { STAGE_LABEL, type Stage } from "@workspace/ui/components/stage-icon"

import type { Job, JobPriority, JobStage } from "./apply-api.ts"

export const PROFILE_ZONE = "Asia/Ho_Chi_Minh"

export const BOARD_STAGES: readonly JobStage[] = [
  "saved",
  "applied",
  "interview",
  "offer",
]

export const ALL_STAGES: readonly JobStage[] = [...BOARD_STAGES, "closed"]

const STAGE_ORDER: Record<JobStage, number> = {
  saved: 0,
  applied: 1,
  interview: 2,
  offer: 3,
  closed: 4,
}

export function stageLabel(stage: JobStage): string {
  return STAGE_LABEL[stage as Stage]
}

export function priorityLabel(priority: JobPriority): string {
  if (priority === "low") return "Low"
  if (priority === "high") return "High"
  return "Normal"
}

export function companyInitials(company: string): string {
  const words = company.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase()
}

export function compareJobs(a: Job, b: Job): number {
  const stage = STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
  if (stage !== 0) return stage
  if (a.position !== b.position) return a.position < b.position ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

type Zoned = {
  year: string
  month: string
  day: string
  weekday: string
  hour: string
  minute: string
}

function zonedParts(date: Date, zone = PROFILE_ZONE): Zoned {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    weekday: read("weekday"),
    hour: read("hour"),
    minute: read("minute"),
  }
}

function sameDay(a: Zoned, b: Zoned) {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/** Deadline dates are calendar dates. Noon UTC keeps Nov 8 on Nov 8. */
export function deadlineInstant(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0))
}

export function monthDay(date: Date, zone = PROFILE_ZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: zone,
  }).format(date)
}

export function listPhrase(job: Job, now = new Date()): string {
  if (job.stage === "offer") return "Offer"
  if (job.stage === "closed") return "Closed"
  if (job.stage === "interview" && job.interviewAt) {
    const parts = zonedParts(new Date(job.interviewAt))
    const hour = String(Number(parts.hour))
    return `Interview ${parts.weekday}, ${hour}:${parts.minute}`
  }
  if (job.stage === "applied") {
    return `Applied ${monthDay(new Date(job.updatedAt))}`
  }
  if (job.stage === "saved" && job.deadline) {
    return `Apply by ${monthDay(deadlineInstant(job.deadline), "UTC")}`
  }
  if (job.stage === "saved") {
    const created = zonedParts(new Date(job.createdAt))
    if (sameDay(created, zonedParts(now))) return "Saved today"
    return "Saved"
  }
  return stageLabel(job.stage)
}

export function zonedYmd(date: Date, zone = PROFILE_ZONE) {
  const parts = zonedParts(date, zone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function cardName(job: Pick<Job, "title" | "company">) {
  return `${job.title}, ${job.company}`
}
