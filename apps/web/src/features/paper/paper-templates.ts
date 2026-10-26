import { PAPER_TEMPLATE_IDS, type CvTemplateId } from "@workspace/domain"

export const PAPER_TEMPLATE_LABELS: { id: string; label: string }[] =
  PAPER_TEMPLATE_IDS.map((id) => ({
    id,
    label: templateLabel(id),
  }))

function templateLabel(id: string) {
  if (id === "with-photo") return "With photo"
  if (id === "two-column") return "Two column"
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/** Design id, or a codec id already stored on the document, to a print layout. */
export function printLayout(templateId: string): CvTemplateId {
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

/** Gallery `data-template`. Unsupported ids reuse simple. */
export function previewTemplate(templateId: string) {
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

export function editorEditedLabel(iso: string, now = Date.now()) {
  if (paperEditedLabel(iso, now) === "just now") return "Edited just now"
  return paperEditedLabel(iso, now)
}

export function validatePaperSearch(search: Record<string, unknown>) {
  void search
  return {}
}
