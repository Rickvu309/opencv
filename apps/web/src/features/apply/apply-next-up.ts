import type { JobView } from "@workspace/domain/apply"
import type { JobId } from "@workspace/domain/kernel"

import { deadlineInstant, monthDay, zonedYmd } from "./apply-stages.ts"

export type NextUpKind = "interview" | "deadline" | "offer" | "follow_up"

export type NextUpItem = {
  jobId: JobId
  company: string
  kind: NextUpKind
  label: string
}

export const NEXT_UP_LIMIT = 4
export const FOLLOW_UP_AFTER_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

type Ranked = NextUpItem & { group: number; at: number }

function interviewLabel(iso: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? ""
  return `Interview ${part("weekday")} ${part("month")} ${part("day")}, ${Number(part("hour"))}:${part("minute")}`
}

function ranked(job: JobView, now: Date, zone: string): Ranked | null {
  const base = { jobId: job.id, company: job.company }
  if (job.stage === "interview" && job.interviewAt) {
    const at = new Date(job.interviewAt).getTime()
    if (at < now.getTime()) return null
    return {
      ...base,
      kind: "interview",
      label: interviewLabel(job.interviewAt, zone),
      group: 0,
      at,
    }
  }
  if (job.stage === "saved" && job.deadline) {
    if (job.deadline < zonedYmd(now, zone)) return null
    const at = deadlineInstant(job.deadline).getTime()
    return {
      ...base,
      kind: "deadline",
      label: `Apply by ${monthDay(deadlineInstant(job.deadline), "UTC")}`,
      group: 0,
      at,
    }
  }
  if (job.stage === "offer") {
    return {
      ...base,
      kind: "offer",
      label: "Answer the offer",
      group: 1,
      at: new Date(job.updatedAt).getTime(),
    }
  }
  if (job.stage === "applied") {
    const at = new Date(job.updatedAt).getTime()
    const days = Math.floor((now.getTime() - at) / DAY_MS)
    if (days < FOLLOW_UP_AFTER_DAYS) return null
    return {
      ...base,
      kind: "follow_up",
      label: `Follow up, applied ${days} days ago`,
      group: 2,
      at,
    }
  }
  return null
}

export function nextUp(
  jobs: readonly JobView[],
  now: Date,
  zone: string,
  limit = NEXT_UP_LIMIT
): NextUpItem[] {
  return jobs
    .flatMap((job) => {
      const item = ranked(job, now, zone)
      return item ? [item] : []
    })
    .sort((a, b) => a.group - b.group || a.at - b.at)
    .slice(0, limit)
    .map(({ jobId, company, kind, label }) => ({ jobId, company, kind, label }))
}
