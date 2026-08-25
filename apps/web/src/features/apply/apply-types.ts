export type StageId = "inbox" | "prep" | "sent" | "live" | "closed"

export type TrackKind = "interview" | "deadline" | "followup" | "applied"

export type ApplyCard = {
  id: string
  title: string
  company: string
  companyShort: string
  fit: number
  note: string
  stage: StageId
  starred?: boolean
  updated: string
  jobUrl?: string
  trackDate: string
  trackKind: TrackKind
}

export const STAGES: { id: StageId; label: string; dot: string }[] = [
  { id: "inbox", label: "Inbox", dot: "bg-muted-foreground/40" },
  { id: "prep", label: "Prep", dot: "bg-chart-3" },
  { id: "sent", label: "Sent", dot: "bg-chart-2" },
  { id: "live", label: "Live", dot: "bg-foreground/70" },
  { id: "closed", label: "Closed", dot: "bg-muted-foreground/25" },
]

export const APPLY_DRAG_TYPE = "application/x-openpath-apply-card"

/**
 * Seed Apply cards for the placeholder User (dev profile).
 * Never the "Eric Nguyen" demo persona (PRODUCT.md open question 4).
 * `fit` stays on the shape for when PRODUCT.md open q. 1 is decided;
 * the workspace does not render the number.
 */
export const SEED_CARDS: ApplyCard[] = [
  {
    id: "1",
    title: "Associate PM intern",
    company: "Local startup",
    companyShort: "LS",
    fit: 68,
    note: "JD wants discovery notes + 1 shipped experiment.",
    stage: "inbox",
    starred: true,
    updated: "Updated today",
    jobUrl: "https://jobs.example.com/associate-pm-intern",
    trackDate: "2026-08-26",
    trackKind: "followup",
  },
  {
    id: "2",
    title: "Product intern",
    company: "Fintech scale-up",
    companyShort: "FS",
    fit: 74,
    note: "Interview Thu, prep onboarding Proof.",
    stage: "inbox",
    updated: "Updated today",
    trackDate: "2026-08-26",
    trackKind: "interview",
  },
  {
    id: "3",
    title: "Business analyst intern",
    company: "Regional bank",
    companyShort: "RB",
    fit: 61,
    note: "Emphasize SQL + flow mapping.",
    stage: "prep",
    updated: "Updated yesterday",
    trackDate: "2026-08-15",
    trackKind: "followup",
  },
  {
    id: "4",
    title: "Product analyst intern",
    company: "E-commerce co.",
    companyShort: "EC",
    fit: 79,
    note: "Checkout Proof is a strong hook.",
    stage: "sent",
    updated: "Updated Mon",
    trackDate: "2026-08-20",
    trackKind: "applied",
  },
  {
    id: "5",
    title: "UX research intern",
    company: "Agency",
    companyShort: "AG",
    fit: 48,
    note: "Passed, need more research samples.",
    stage: "closed",
    updated: "Updated last week",
    trackDate: "2026-08-10",
    trackKind: "applied",
  },
]

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
