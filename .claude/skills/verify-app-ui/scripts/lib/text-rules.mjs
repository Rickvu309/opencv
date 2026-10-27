// Pure text and colour rules. No browser, no DOM. Each export is one decision the checks call.
// Sources are the APPUI research section 5 checks (numbers in the comments are those check ids).
// Properties 39 to 44 read the pinned phrases in copy.json.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const copy = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "copy.json"),
    "utf8"
  )
)

// 01. ADR-0002 nouns. Chrome may say Job. Opportunity and Thread fail. Email, document, and profile
// stay banned. Heuristic: a word list, so a legitimate use needs a note here.
function retiredPattern(word) {
  if (word === "Opportunity") return /\bopportunit(?:y|ies)\b/i
  if (word === "Thread") return /\bthreads?\b/i
  return new RegExp(`\\b${word}\\b`, "i")
}
const BANNED_NOUNS = [
  ...(copy.retiredNouns ?? []).map((word) => [
    retiredPattern(word),
    `${word} (say ${word === "Thread" ? "Chat" : "Job"})`,
  ]),
  [/\bemails?\b/i, "email (say Letter)"],
  [/\bdocuments?\b/i, "document (say CV, Letter or Proof)"],
  [/\bprofile\b/i, "profile (say Pitch)"],
]
const LEGACY_NOUNS = new Set(copy.legacyNounLabels ?? [])
// Goal chips that start with A or An, the Connect email row, the account menu label, the Paper empty
// sentence, and legacyNounLabels (Paper and Home strings #378 and #380 still own) are exempt.
const EMPLOYMENT_SENSE =
  /\b(part-time|full-time|first|dream|summer)\s+jobs?\b/gi
const GOAL_CHIP = /^an?\s/i
const CONNECTOR = /^(connect email(, optional)?|.+, profile and settings)$/i
// Check 29 requires the Paper empty sentence "Start a document", so check 01 cannot flag it.
// The old sentence stays exempt so a leftover string is not a new noun failure.
const PAPER_EMPTY =
  /^No documents yet\. Create a CV, Letter, or Proof to start\.$/
const PAPER_LINES = new Set(
  [
    copy.paperEmptyTitle,
    copy.paperEmptyBody,
    copy.paperNoResults,
    copy.paperOnePage,
    "Loading documents",
    "Could not load documents. Refresh the page.",
    "This link does not open a document.",
    "This document changed. Reload it and try again.",
    "Document changed",
  ].filter((line) => typeof line === "string" && line.length > 0)
)
export function nounViolations(labels) {
  const out = []
  for (const label of labels) {
    const trimmed = label.trim()
    if (
      CONNECTOR.test(trimmed) ||
      PAPER_EMPTY.test(trimmed) ||
      PAPER_LINES.has(trimmed) ||
      LEGACY_NOUNS.has(trimmed)
    )
      continue
    const chip = GOAL_CHIP.test(label) && label.split(/\s+/).length <= 6
    const text = chip ? label.replace(EMPLOYMENT_SENSE, "") : label
    for (const [re, why] of BANNED_NOUNS) {
      if (re.test(text)) out.push({ label, why })
    }
  }
  return out
}

// 03. A label that gives no action. Heuristic: only the named bad labels, a joke label cannot be decided.
export function emptyActionLabels(labels) {
  return labels.filter((l) =>
    /^(click here|here|learn more|read more|more info|submit|ok|okay)$/i.test(
      l.trim()
    )
  )
}

// 05. Another product's name in this product's chrome.
export function otherProductNames(text) {
  return [
    ...text.matchAll(
      /instagram|tiktok|snapchat|facebook|twitter|youtube|pinterest|whatsapp|linktree/gi
    ),
  ].map((m) => m[0])
}

// 07 and 13. A percentage or a metric claim with no stated basis.
export function metricClaims(text) {
  return [
    ...text.matchAll(/\d+(?:\.\d+)?\s?(?:%|percent\b)/gi),
    ...text.matchAll(/add-to-cart/gi),
  ].map((m) => m[0])
}
export function hasBasisSentence(text) {
  return /\b(because|based on|from your|matches your)\b/i.test(text)
}

// 04. The page text still holds the raw message the api sent.
export function showsRawMessage(pageText, raw) {
  return pageText.includes(raw)
}

// 24. Allowed durations in milliseconds: none, the micro token (150) and the panel token (280).
export const ALLOWED_MS = new Set([0, 150, 280])
export function parseDurations(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000))
}
export function offTokenDurations(value) {
  return parseDurations(value).filter((ms) => !ALLOWED_MS.has(ms))
}

// 20. WCAG relative luminance and contrast ratio over [r, g, b] in 0..255.
export function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
export function contrastNeeded(fontPx, weight) {
  const large = fontPx >= 24 || (fontPx >= 18.66 && weight >= 700)
  return large ? 3 : 4.5
}

// 19. Chroma of an sRGB colour (max minus min, 0..1) and its hue in degrees.
export function chroma([r, g, b]) {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255
}

// 25a. Spacing scale. Tailwind steps of 4px, plus its half steps (2, 6, 10, 14).
const ON_SCALE = new Set([2, 6, 10, 14])
export function onSpacingScale(px) {
  return px === 0 || px % 4 === 0 || ON_SCALE.has(px)
}

// 39. Chrome spells the brand as the mark plus lowercase opencv.
export function brandViolations(labels) {
  return labels
    .filter((label) => label.includes(copy.brandForbidden))
    .map((label) => ({ label, why: `write ${copy.brandWord}` }))
}

// 40. At most one glow primary on a view. counts is one number per view.
export function extraGlowPrimaries(counts) {
  return counts.filter((count) => count > 1)
}

// Every captured snap, including nested mobile and reduced passes and the empty board.
export function capturedGlowViews(record) {
  const views = []
  for (const [name, value] of Object.entries(record ?? {})) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    if (typeof value.glowCount === "number") {
      views.push({ name, count: value.glowCount })
      continue
    }
    for (const [child, snap] of Object.entries(value)) {
      if (snap && typeof snap.glowCount === "number")
        views.push({ name: `${name}-${child}`, count: snap.glowCount })
    }
  }
  return views
}

// 39 and 41. Control names plus the document title and any other chrome string.
export function chromeCopy(labels, extras = []) {
  return [
    ...new Set(
      [...labels, ...extras].filter((s) => typeof s === "string" && s.trim())
    ),
  ]
}

// 41. No em dash, en dash, or middle dot in copy.
export function dashViolations(labels) {
  return labels.filter((label) =>
    copy.dashes.some((dash) => label.includes(dash))
  )
}

// 42. A toggle reads Enabled or Disabled, never On, Off, or Connected.
export function toggleViolations(labels) {
  const bad = new Set(copy.toggleBad.map((word) => word.toLowerCase()))
  return labels.filter((label) => bad.has(label.trim().toLowerCase()))
}

// 43. A job line leads with the title. "at Company" with no title fails.
export function titleBeforeCompany(labels) {
  return labels.filter((label) => /^at\s+\S/i.test(label.trim()))
}

// 44. No exclamation mark and no Oops.
export function exclamationViolations(labels) {
  const oops = new RegExp(copy.oops, "i")
  return labels.filter((label) => label.includes("!") || oops.test(label))
}
