import { srgbToOklab } from "./oklch.mjs"

export const TOLERANCE = {
  position: 8,
  fontSize: 0.5,
  letterSpacing: 0.3,
  color: 0.04,
  token: 0.06,
  contrastFloor: 0.12,
  contrastHeadroom: 1.12,
}

// Stock shadcn text colours. App code may not use raw hex, so a pen colour
// that no token reaches matches when the app uses the token nearest to it.
export const TEXT_TOKENS = [
  "--foreground",
  "--muted-foreground",
  "--card-foreground",
  "--primary",
  "--primary-foreground",
  "--background",
]

// Each entry: { frameId, text, property, reason, until: "YYYY-MM-DD", approvedBy }.
// An expired entry fails, and so does one whose property now matches.
export const PEN_LAYOUT_EXCEPTIONS = []

export const normalizeText = (text) => text.replace(/\s+/g, " ").trim()

export function parseRgba(css) {
  const hit =
    /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?\s*\)/.exec(
      css
    )
  if (!hit) throw new Error(`cannot read color ${css}`)
  return {
    r: +hit[1],
    g: +hit[2],
    b: +hit[3],
    a: hit[4] === undefined ? 1 : +hit[4],
  }
}

export function colorDistance(a, b) {
  const over = ({ r, g, b, a }) => [r, g, b].map((v) => v * a + 255 * (1 - a))
  const left = srgbToOklab(...over(parseRgba(a)))
  const right = srgbToOklab(...over(parseRgba(b)))
  return Math.hypot(left.L - right.L, left.a - right.a, left.b - right.b)
}

const luminance = (css) => {
  const { r, g, b, a } = parseRgba(css)
  const lin = (v) => {
    const unit = (v * a + 255 * (1 - a)) / 255
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export const contrastOnWhite = (css) => 1.05 / (luminance(css) + 0.05)

// WCAG AA: 3:1 for large text (24px, or 18.66px at weight 700), 4.5:1 below.
const contrastNeed = ({ fontSize, fontWeight }) =>
  fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5

export function colorMatches(want, got, tokens = {}) {
  if (colorDistance(want.color, got.color) <= TOLERANCE.color) return true
  const nearest = Object.values(tokens)
    .map((token) => ({ token, away: colorDistance(want.color, token) }))
    .sort((left, right) => left.away - right.away)[0]
  if (
    nearest &&
    nearest.away <= TOLERANCE.token &&
    colorDistance(got.color, nearest.token) <= 0.01
  )
    return true
  // A pen colour too faint for AA on white must not ship as drawn. The app
  // colour passes when it is about the lightest colour that meets AA.
  const need = contrastNeed(want)
  const contrast = contrastOnWhite(got.color)
  return (
    contrastOnWhite(want.color) < need &&
    contrast >= need &&
    contrast <= need * TOLERANCE.contrastHeadroom &&
    colorDistance(want.color, got.color) <= TOLERANCE.contrastFloor
  )
}

const anchor = (box, align) =>
  align === "center"
    ? box.x + box.width / 2
    : align === "right"
      ? box.x + box.width
      : box.x

const shown = (value) =>
  typeof value === "number" ? String(Math.round(value * 100) / 100) : value

function textMismatches(want, got, tokens) {
  if (!got) return [{ property: "text", pen: "present", app: "missing" }]
  const out = []
  const add = (property, pen, app) => out.push({ property, pen, app })
  const penX = anchor(want, want.textAlign)
  const appX = anchor(got, want.textAlign)
  if (Math.abs(penX - appX) > TOLERANCE.position) add("x", penX, appX)
  if (Math.abs(want.y - got.y) > TOLERANCE.position) add("y", want.y, got.y)
  if (Math.abs(want.fontSize - got.fontSize) > TOLERANCE.fontSize)
    add("fontSize", want.fontSize, got.fontSize)
  if (want.fontWeight !== got.fontWeight)
    add("fontWeight", want.fontWeight, got.fontWeight)
  if (
    Math.abs(want.letterSpacing - got.letterSpacing) > TOLERANCE.letterSpacing
  )
    add("letterSpacing", want.letterSpacing, got.letterSpacing)
  if (!colorMatches(want, got, tokens)) add("color", want.color, got.color)
  return out
}

export function comparePenLayout({
  layout,
  measured,
  tokens = {},
  exceptions = PEN_LAYOUT_EXCEPTIONS,
  today = new Date().toISOString().slice(0, 10),
}) {
  const mine = exceptions.filter((entry) => entry.frameId === layout.frameId)
  const used = new Set()
  const mismatches = []
  layout.texts.forEach((want, index) => {
    for (const found of textMismatches(want, measured[index] ?? null, tokens)) {
      const entry = mine.find(
        (candidate) =>
          candidate.text === want.text && candidate.property === found.property
      )
      if (entry) {
        used.add(entry)
        if (entry.until >= today) continue
        mismatches.push({
          text: want.text,
          property: "exception",
          pen: `${found.property} excepted until ${entry.until}`,
          app: "expired",
        })
      }
      mismatches.push({ text: want.text, ...found })
    }
  })
  for (const entry of mine) {
    if (used.has(entry)) continue
    mismatches.push({
      text: entry.text,
      property: "exception",
      pen: `${entry.property} excepted`,
      app: "stale, the property now matches",
    })
  }
  return { texts: layout.texts.length, mismatches }
}

export const formatMismatch = (layout, m) =>
  `FAIL ${layout.frameId} ${layout.route} "${m.text}" ${m.property}: pen ${shown(m.pen)} app ${shown(m.app)}`
