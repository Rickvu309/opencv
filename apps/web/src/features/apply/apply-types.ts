import type {
  ApplyCard,
  ApplyStage,
  ApplyTrackKind,
} from "@workspace/domain"

export type { ApplyCard }
export type StageId = ApplyStage
export type TrackKind = ApplyTrackKind

export const STAGES: { id: StageId; label: string; dot: string }[] = [
  { id: "inbox", label: "Inbox", dot: "bg-chart-1" },
  { id: "prep", label: "Prep", dot: "bg-chart-2" },
  { id: "sent", label: "Sent", dot: "bg-chart-3" },
  { id: "live", label: "Live", dot: "bg-chart-4" },
  { id: "closed", label: "Closed", dot: "bg-chart-5" },
]

export const APPLY_DRAG_TYPE = "application/x-openpath-apply-card"

const STAGE_ORDER: Record<StageId, number> = {
  inbox: 0,
  prep: 1,
  sent: 2,
  live: 3,
  closed: 4,
}

export function sortApplyCards(cards: ApplyCard[]): ApplyCard[] {
  return [...cards].sort((a, b) => {
    const stage = STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
    if (stage !== 0) return stage
    if (a.position !== b.position) return a.position < b.position ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

export function companyShort(company: string) {
  const words = company.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase()
}

export function formatApplyUpdated(iso: string, now = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso

  const deltaMs = now - then
  if (deltaMs < 45_000) return "Updated just now"
  if (deltaMs < 50 * 60_000) {
    const minutes = Math.max(1, Math.round(deltaMs / 60_000))
    return minutes === 1 ? "Updated 1 minute ago" : `Updated ${minutes} minutes ago`
  }

  const today = new Date(now)
  const date = new Date(then)
  const startOfToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  )
  const startOfThen = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  )
  const dayDiff = Math.round((startOfToday - startOfThen) / 86_400_000)
  if (dayDiff === 0) return "Updated today"
  if (dayDiff === 1) return "Updated yesterday"

  return `Updated ${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Browser-local calendar date, same clock Home's greeting uses. */
export function localIsoDate(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatTrackDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function trackKindLabel(kind: TrackKind) {
  switch (kind) {
    case "interview":
      return "Interview"
    case "deadline":
      return "Deadline"
    case "followup":
      return "Follow-up"
    default:
      return "Applied"
  }
}
