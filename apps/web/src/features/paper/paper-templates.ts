import {
  PAPER_TEMPLATE_IDS,
  type CvTemplateId,
  type PaperTemplateId,
} from "@workspace/domain"

export const PAPER_TEMPLATE_LABELS: { id: PaperTemplateId; label: string }[] =
  PAPER_TEMPLATE_IDS.map((id) => ({
    id,
    label: templateLabel(id),
  }))

function templateLabel(id: string) {
  if (id === "with-photo") return "With photo"
  if (id === "two-column") return "Two column"
  return id.charAt(0).toUpperCase() + id.slice(1)
}

export function printLayout(templateId: string | null): CvTemplateId {
  switch (templateId) {
    case "modern":
    case "product":
      return "product"
    case "compact":
    case "service":
      return "service"
    case "academic":
      return "academic"
    case "with-photo":
    case "photo":
      return "photo"
    default:
      return "internship"
  }
}

export function previewTemplate(templateId: string | null) {
  switch (templateId) {
    case "modern":
    case "product":
      return "modern"
    case "compact":
    case "service":
      return "compact"
    case "academic":
      return "academic"
    case "with-photo":
    case "photo":
      return "with-photo"
    default:
      return "simple"
  }
}

export function paperEditedLabel(iso: string, now = Date.now()) {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ""
  const delta = Math.max(0, now - then)
  if (delta < 60_000) return "just now"
  if (delta < 3_600_000) {
    return `${Math.max(1, Math.round(delta / 60_000))}m ago`
  }
  if (delta < 86_400_000) {
    return `${Math.max(1, Math.round(delta / 3_600_000))}h ago`
  }
  const today = new Date(now)
  const date = new Date(then)
  const dayDiff = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86_400_000
  )
  if (dayDiff === 1) return "Yesterday"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export type PaperSearch = { q?: string }

export function validatePaperSearch(search: object): PaperSearch {
  const query = "q" in search ? search.q : undefined
  return typeof query === "string" && query !== "" ? { q: query } : {}
}
