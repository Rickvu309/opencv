// Pure text and colour rules. No browser, no DOM. Each export is one decision the checks call.
// Sources are the APPUI research section 5 checks (numbers in the comments are those check ids).

// 01. CONTEXT.md nouns. A button, placeholder, empty line or banner must not call a product object
// "job", "email", "document" or "profile". Heuristic: a word list, so a legitimate use needs a note here.
const BANNED_NOUNS = [
  [/\bjobs?\b/i, "job (say Opportunity)"],
  [/\bemails?\b/i, "email (say Letter)"],
  [/\bdocuments?\b/i, "document (say CV, Letter or Proof)"],
  [/\bprofile\b/i, "profile (say Pitch)"],
]
// "A café or part-time job" and "A first full-time job" are goal chips, not the Opportunity object: a short
// label that starts with A or An. "Connect email, optional" is the mail connector row, and the account menu label "<name>, profile and settings", and the Paper empty sentence check 29 demands. Nothing else is exempt.
const EMPLOYMENT_SENSE =
  /\b(part-time|full-time|first|dream|summer)\s+jobs?\b/gi
const GOAL_CHIP = /^an?\s/i
const CONNECTOR = /^(connect email(, optional)?|.+, profile and settings)$/i
// Check 29 requires the Paper empty sentence to start "No documents yet", so check 01 cannot flag it.
const PAPER_EMPTY =
  /^No documents yet\. Create a CV, Letter, or Proof to start\.$/
export function nounViolations(labels) {
  const out = []
  for (const label of labels) {
    if (CONNECTOR.test(label.trim()) || PAPER_EMPTY.test(label.trim())) continue
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
