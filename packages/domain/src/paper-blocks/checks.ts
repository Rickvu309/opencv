import { makeIds, type CvBlockDocument } from "./document.js"
import { plainTextOf } from "./registry.js"

export const IMPORT_PAGES_MESSAGE =
  "Pages files aren't supported. Try a PDF or Word file."
export const IMPORT_GOOGLE_MESSAGE =
  "Google Docs aren't supported. Download a PDF or Word file."
export const IMPORT_LINKEDIN_MESSAGE =
  "LinkedIn links aren't supported. Download a PDF or Word file."
export const IMPORT_PHONE_MESSAGE = "No phone number in your file."
export const IMPORT_DATES_MESSAGE = "Add when you did this role."

export type CvImportCheck = {
  id: string
  kind: "phone" | "dates"
  blockId: string
  message: string
  resolved: boolean
}

/**
 * A year range such as 2019-2024 is eight digits with a hyphen, which a
 * plain digit scan would call a phone. Strip ranges before the scan.
 */
const YEAR_RANGE = /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:19|20)\d{2}\b/gi

const PHONE_RUN = /(?:\+?\d[\s().+-]*){6}\d/g

export function hasPhoneRun(text: string): boolean {
  const stripped = text.replace(new RegExp(YEAR_RANGE.source, "gi"), " ")
  const runs = stripped.matchAll(new RegExp(PHONE_RUN.source, "g"))
  for (const match of runs) {
    const digits = match[0].replace(/\D/g, "")
    if (digits.length >= 7) return true
  }
  return false
}

function collectedText(document: CvBlockDocument) {
  const parts = [
    document.header.name,
    document.header.email,
    document.header.phone,
    document.header.city,
    document.header.linkedin,
    document.header.photo ?? "",
  ]
  for (const section of document.sections) {
    for (const block of section.blocks) parts.push(plainTextOf(block))
  }
  return parts.join("\n")
}

function datesCheck(document: CvBlockDocument): CvImportCheck | null {
  const experience = document.sections.find(
    (section) => section.kind === "experience"
  )
  if (!experience) return null
  const entry = experience.blocks.find(
    (block) => block.type === "experience-entry"
  )
  if (entry && entry.type === "experience-entry") {
    if (entry.period.includes("20")) return null
    return {
      id: "dates",
      kind: "dates",
      blockId: entry.id,
      message: IMPORT_DATES_MESSAGE,
      resolved: false,
    }
  }
  const headingIndex = experience.blocks.findIndex(
    (block) => block.type === "heading"
  )
  if (headingIndex < 0) return null
  const heading = experience.blocks[headingIndex]
  if (!heading) return null
  const following = experience.blocks[headingIndex + 1]
  const period =
    following && (following.type === "text" || following.type === "heading")
      ? plainTextOf(following)
      : ""
  if (period.includes("20")) return null
  return {
    id: "dates",
    kind: "dates",
    blockId: following?.id ?? heading.id,
    message: IMPORT_DATES_MESSAGE,
    resolved: false,
  }
}

export function findImportChecks(document: CvBlockDocument): CvImportCheck[] {
  const checks: CvImportCheck[] = []
  if (!document.header.phone.trim() && !hasPhoneRun(collectedText(document))) {
    checks.push({
      id: "phone",
      kind: "phone",
      blockId: "header.phone",
      message: IMPORT_PHONE_MESSAGE,
      resolved: false,
    })
  }
  const dates = datesCheck(document)
  if (dates) checks.push(dates)
  return checks
}

function hostIs(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`)
}

function linkHost(value: string) {
  const match = /^https?:\/\/([^/?#]+)/i.exec(value.trim())
  const host = match?.[1]?.replace(/:\d+$/, "").toLowerCase()
  return host || null
}

export function unreadableImportLink(value: string): string | null {
  const host = linkHost(value)
  if (!host) return null
  if (hostIs(host, "docs.google.com")) return IMPORT_GOOGLE_MESSAGE
  if (hostIs(host, "linkedin.com")) return IMPORT_LINKEDIN_MESSAGE
  return null
}

export function paragraphsToBlockDocument(text: string): CvBlockDocument {
  const id = makeIds()
  const paragraphs = text
    .split(/\n\s*\n|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  const blocks =
    paragraphs.length > 0
      ? paragraphs.map((paragraph) => ({
          id: id(),
          type: "text" as const,
          text: paragraph,
        }))
      : [{ id: id(), type: "text" as const, text: "" }]
  return {
    version: 2,
    header: {
      name: "",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    sections: [{ id: id(), kind: "summary", blocks }],
  }
}
