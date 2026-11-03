import { readFileSync } from "node:fs"

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

export const TEXT_TOKENS = [
  "--foreground",
  "--muted-foreground",
  "--card-foreground",
  "--primary",
  "--primary-foreground",
  "--background",
]

export const PEN_LAYOUT_EXCEPTIONS = []

export const EXTRA_KINDS = ["heading", "control"]

const pending = JSON.parse(
  readFileSync(
    new URL("pen-layout-extras.pending.json", import.meta.url),
    "utf8"
  )
)

export const PENDING_EXTRAS = pending.entries.map((entry) => ({
  ...entry,
  property: "extra",
  approvedBy: `pending ${entry.issue}`,
}))

export function pendingExtraProblems({ entries, frameIds, today }) {
  const known = new Set(frameIds)
  return entries.flatMap((entry) => {
    const name = `${entry.frameId} "${entry.text ?? entry.textStartsWith}"`
    const problems = []
    if (!known.has(entry.frameId))
      problems.push(`${name}: frame is not in design-frames.json`)
    if (entry.until < today)
      problems.push(`${name}: pending until ${entry.until} (${entry.issue})`)
    return problems
  })
}

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

const WHITE = "rgba(255, 255, 255, 1)"

const over = (css, under = WHITE) => {
  const top = parseRgba(css)
  const base = parseRgba(under)
  return [top.r, top.g, top.b].map(
    (v, i) => v * top.a + [base.r, base.g, base.b][i] * (1 - top.a)
  )
}

const luminance = (rgb) => {
  const lin = (v) => {
    const unit = v / 255
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = rgb.map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(color, background = WHITE) {
  const base = `rgba(${over(background).join(", ")}, 1)`
  const pair = [luminance(over(color, base)), luminance(over(base))]
  return (Math.max(...pair) + 0.05) / (Math.min(...pair) + 0.05)
}

const WCAG_AA = Object.freeze({
  largeTextPx: 24,
  largeBoldTextPx: 18.66,
  boldWeight: 700,
  largeTextRatio: 3,
  bodyTextRatio: 4.5,
})
const contrastNeed = ({ fontSize, fontWeight }) =>
  fontSize >= WCAG_AA.largeTextPx ||
  (fontSize >= WCAG_AA.largeBoldTextPx && fontWeight >= WCAG_AA.boldWeight)
    ? WCAG_AA.largeTextRatio
    : WCAG_AA.bodyTextRatio

export function colorMatches(want, got, tokens = {}) {
  const need = contrastNeed(want)
  const shipped = contrast(got.color, got.background)
  if (shipped < need) return false
  const penColourTooFaintToShipAsDrawn =
    contrast(want.color, want.background) < need
  if (penColourTooFaintToShipAsDrawn)
    return (
      shipped <= need * TOLERANCE.contrastHeadroom &&
      colorDistance(want.color, got.color) <= TOLERANCE.contrastFloor
    )
  if (colorDistance(want.color, got.color) <= TOLERANCE.color) return true
  const nearest = Object.values(tokens)
    .map((token) => ({ token, away: colorDistance(want.color, token) }))
    .sort((left, right) => left.away - right.away)[0]
  return Boolean(
    nearest &&
    nearest.away <= TOLERANCE.token &&
    colorDistance(got.color, nearest.token) <= 0.01
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

const drawnMarks = (layout, measured) => [
  ...(layout.icons ?? []).map((icon) => ({
    ...icon,
    width: icon.size,
    height: icon.size,
  })),
  ...(layout.boxes ?? []),
  ...layout.texts.filter((_, index) => !measured[index]),
]

const accountedByDrawing = (extra, layout, measured) =>
  extra.kind === "control" &&
  drawnMarks(layout, measured).some((mark) => {
    const centre = { x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 }
    return (
      centre.x >= extra.x - TOLERANCE.position &&
      centre.x <= extra.x + extra.width + TOLERANCE.position &&
      centre.y >= extra.y - TOLERANCE.position &&
      centre.y <= extra.y + extra.height + TOLERANCE.position
    )
  })

const sameLetters = (left, right) => left.toLowerCase() === right.toLowerCase()

function extraMismatch(extra, layout) {
  const twin = layout.texts.find(
    (want) => want.text !== extra.text && sameLetters(want.text, extra.text)
  )
  return {
    text: extra.text,
    property: "extra",
    pen: twin ? `"${twin.text}"` : "absent",
    app: `${extra.kind} at ${Math.round(extra.x)},${Math.round(extra.y)}`,
  }
}

export function comparePenLayout({
  layout,
  measured,
  tokens = {},
  extras = [],
  extraKinds = EXTRA_KINDS,
  reportStale = true,
  exceptions = PEN_LAYOUT_EXCEPTIONS,
  pendingExtras = PENDING_EXTRAS,
  today = new Date().toISOString().slice(0, 10),
}) {
  const mine = [...exceptions, ...pendingExtras].filter(
    (entry) => entry.frameId === layout.frameId
  )
  const used = new Set()
  const mismatches = []
  const report = (text, found, index) => {
    const entry = mine.find(
      (candidate) =>
        candidate.property === found.property &&
        (candidate.text === text ||
          (candidate.textStartsWith &&
            text.startsWith(candidate.textStartsWith))) &&
        (candidate.index === undefined || candidate.index === index)
    )
    if (entry) {
      used.add(entry)
      if (entry.until >= today) return
      mismatches.push({
        text,
        property: "exception",
        pen: `${found.property} excepted until ${entry.until}`,
        app: "expired",
      })
    }
    mismatches.push({ text, ...found })
  }
  layout.texts.forEach((want, index) => {
    for (const found of textMismatches(want, measured[index] ?? null, tokens))
      report(want.text, found, index)
  })
  for (const extra of extras) {
    if (
      extraKinds.includes(extra.kind) &&
      !accountedByDrawing(extra, layout, measured)
    )
      report(extra.text, extraMismatch(extra, layout))
  }
  for (const entry of mine) {
    if (used.has(entry)) continue
    const text = entry.text ?? entry.textStartsWith
    if (entry.until < today)
      mismatches.push({
        text,
        property: "exception",
        pen: `${entry.property} excepted until ${entry.until}`,
        app: "expired",
      })
    else if (reportStale)
      mismatches.push({
        text,
        property: "exception",
        pen: `${entry.property} excepted`,
        app:
          entry.property === "extra"
            ? "stale, the app no longer shows it"
            : "stale, the property now matches",
      })
  }
  return { texts: layout.texts.length, mismatches }
}

export const formatMismatch = (layout, m) =>
  `FAIL ${layout.frameId} ${layout.route} "${m.text}" ${m.property}: pen ${shown(m.pen)} app ${shown(m.app)}`
