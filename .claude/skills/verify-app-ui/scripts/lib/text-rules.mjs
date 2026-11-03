import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const copy = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "copy.json"),
    "utf8"
  )
)

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
const EMPLOYMENT_SENSE =
  /\b(part-time|full-time|first|dream|summer)\s+jobs?\b/gi
const GOAL_CHIP = /^an?\s/i
const CONNECTOR = /^(connect email(, optional)?|.+, profile and settings)$/i
const OLD_PAPER_EMPTY_SENTENCE_KEPT_EXEMPT =
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
const INBOX_EXEMPT = new Set([
  copy.inboxConnectTitle,
  copy.inboxConnectPromise,
  copy.inboxEmptyTitle,
  copy.inboxScanTitle,
])
const INBOX_COUNT = /^\d+ emails from \d+ companies so far$/
export function nounViolations(labels) {
  const out = []
  for (const label of labels) {
    const trimmed = label.trim()
    if (
      CONNECTOR.test(trimmed) ||
      OLD_PAPER_EMPTY_SENTENCE_KEPT_EXEMPT.test(trimmed) ||
      PAPER_LINES.has(trimmed) ||
      LEGACY_NOUNS.has(trimmed) ||
      inboxExempt(trimmed)
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

function inboxExempt(label) {
  if (INBOX_EXEMPT.has(label)) return true
  if (label.startsWith(copy.inboxEmptyTitle)) return true
  return INBOX_COUNT.test(label)
}

export function emptyActionLabels(labels) {
  return labels.filter((l) =>
    /^(click here|here|learn more|read more|more info|submit|ok|okay)$/i.test(
      l.trim()
    )
  )
}

export function otherProductNames(text) {
  return [
    ...text.matchAll(
      /instagram|tiktok|snapchat|facebook|twitter|youtube|pinterest|whatsapp|linktree/gi
    ),
  ].map((m) => m[0])
}

export function metricClaims(text) {
  return [
    ...text.matchAll(/\d+(?:\.\d+)?\s?(?:%|percent\b)/gi),
    ...text.matchAll(/add-to-cart/gi),
  ].map((m) => m[0])
}
export function hasBasisSentence(text) {
  return /\b(because|based on|from your|matches your)\b/i.test(text)
}

export function showsRawMessage(pageText, raw) {
  return pageText.includes(raw)
}

const MOTION_MICRO_TOKEN_MS = 150
const MOTION_PANEL_TOKEN_MS = 280
export const ALLOWED_MS = new Set([
  0,
  MOTION_MICRO_TOKEN_MS,
  MOTION_PANEL_TOKEN_MS,
])
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

export function chroma([r, g, b]) {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255
}

const TAILWIND_HALF_STEPS_PX = new Set([2, 6, 10, 14])
export function onSpacingScale(px) {
  return px === 0 || px % 4 === 0 || TAILWIND_HALF_STEPS_PX.has(px)
}

export function brandViolations(labels) {
  return labels
    .filter((label) => label.includes(copy.brandForbidden))
    .map((label) => ({ label, why: `write ${copy.brandWord}` }))
}

export function extraGlowPrimaries(counts) {
  return counts.filter((count) => count > 1)
}

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

export function chromeCopy(labels, extras = []) {
  return [
    ...new Set(
      [...labels, ...extras].filter((s) => typeof s === "string" && s.trim())
    ),
  ]
}

export function dashViolations(labels) {
  return labels.filter((label) =>
    copy.dashes.some((dash) => label.includes(dash))
  )
}

export function toggleViolations(labels) {
  const bad = new Set(copy.toggleBad.map((word) => word.toLowerCase()))
  return labels.filter((label) => bad.has(label.trim().toLowerCase()))
}

export function titleBeforeCompany(labels) {
  return labels.filter((label) => /^at\s+\S/i.test(label.trim()))
}

export function exclamationViolations(labels) {
  const oops = new RegExp(copy.oops, "i")
  return labels.filter((label) => label.includes("!") || oops.test(label))
}

export const badFixture = [
  {
    name: "a retired noun in chrome",
    fails: () => nounViolations(["Open my threads"]).length > 0,
  },
  {
    name: "a label that gives no action",
    fails: () => emptyActionLabels(["Click here"]).length > 0,
  },
  {
    name: "another product's name",
    fails: () => otherProductNames("Share on Instagram").length > 0,
  },
  {
    name: "a metric claim with no basis",
    fails: () =>
      metricClaims("Boosts offers by 40%").length > 0 &&
      !hasBasisSentence("Boosts offers by 40%"),
  },
  {
    name: "the raw api message on the page",
    fails: () => showsRawMessage("Error: User not found.", "User not found."),
  },
  {
    name: "a duration off the motion tokens",
    fails: () => offTokenDurations("300ms").length > 0,
  },
  { name: "an off-scale spacing", fails: () => !onSpacingScale(5) },
  {
    name: "the brand spelled with capitals",
    fails: () => brandViolations(["OpenCV home"]).length > 0,
  },
  {
    name: "two glow primaries inside a nested mobile view",
    fails: () =>
      extraGlowPrimaries(
        capturedGlowViews({ mobile: { apply: { glowCount: 2 } } }).map(
          (view) => view.count
        )
      ).length > 0,
  },
  {
    name: "an em dash in copy",
    fails: () => dashViolations(["Saved — done"]).length > 0,
  },
  {
    name: "a toggle that reads On",
    fails: () => toggleViolations(["On"]).length > 0,
  },
  {
    name: "a job line that leads with the company",
    fails: () => titleBeforeCompany(["at Acme"]).length > 0,
  },
  {
    name: "an exclamation mark",
    fails: () => exclamationViolations(["Saved!"]).length > 0,
  },
]
