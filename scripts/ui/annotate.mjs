import { SIDES } from "./before-after.mjs"
import { ZOOM, calloutZooms } from "./zoom.mjs"

export const CALLOUTS_PER_SECTION = 5
export const CANVAS = Object.freeze({
  width: 960,
  scale: 1.5,
  pad: 24,
  gap: 24,
})
export const MARK = Object.freeze({
  radius: 13,
  reach: 64,
  clearance: 4,
  spacing: 6,
  inset: 2,
})
const DIRECTIONS = Object.freeze([
  ["up-left", -1, -1],
  ["up-right", 1, -1],
  ["left", -1, 0],
  ["right", 1, 0],
  ["down-left", -1, 1],
  ["down-right", 1, 1],
  ["up", 0, -1],
  ["down", 0, 1],
])
export const PLACEMENT_ORDER = DIRECTIONS.map(([name]) => name)
const REACHES = Object.freeze([1, 1.75, 2.5])
const OPTIONS = REACHES.flatMap((stretch, ring) =>
  DIRECTIONS.map(([name, dx, dy]) => ({ name, dx, dy, stretch, ring }))
)
const PENALTY = Object.freeze({
  crowded: 1000,
  outside: 100,
  covered: 10,
  ring: 1,
})

const isText = (value) => typeof value === "string" && value.trim().length > 0
const isNumber = (value) => typeof value === "number" && Number.isFinite(value)

const isPerSide = (target) =>
  !!target && typeof target === "object" && SIDES.some((side) => side in target)

export function sideTarget(target, side) {
  if (!isPerSide(target)) return target
  return target[side] ?? null
}

function plainTargetProblem(target) {
  if (!target || typeof target !== "object") return "needs a target"
  if (isText(target.selector)) return null
  if (isNumber(target.x) && isNumber(target.y)) return null
  return "target needs a selector or numeric x and y"
}

function targetProblem(target) {
  if (!isPerSide(target)) return plainTargetProblem(target)
  const given = SIDES.filter((side) => target[side])
  if (given.length === 0) return "a per-side target needs a before or an after"
  for (const side of given) {
    const problem = plainTargetProblem(target[side])
    if (problem) return `${side} ${problem}`
  }
  return null
}

const usesSelector = (target) =>
  isPerSide(target)
    ? SIDES.some((side) => isText(target[side]?.selector))
    : isText(target.selector)

export function validateSpec(spec) {
  const problems = []
  if (!spec || !Array.isArray(spec.sections) || spec.sections.length === 0)
    return ["the spec needs a non-empty sections list"]
  spec.sections.forEach((section, at) => {
    const label = `section ${at + 1}`
    if (!isText(section.title)) problems.push(`${label} needs a title`)
    const fromManifest = isText(section.screen) && isNumber(section.width)
    for (const side of ["before", "after"])
      if (!isText(section[side]) && !fromManifest)
        problems.push(
          `${label} needs a ${side} image, or a screen and width from the manifest`
        )
    const callouts = section.callouts ?? []
    if (!Array.isArray(callouts)) {
      problems.push(`${label} callouts must be a list`)
      return
    }
    if (callouts.length > CALLOUTS_PER_SECTION)
      problems.push(
        `${label} has ${callouts.length} callouts; keep at most ${CALLOUTS_PER_SECTION}`
      )
    const numbers = new Set()
    callouts.forEach((callout, index) => {
      const where = `${label} callout ${index + 1}`
      if (!Number.isInteger(callout.n) || callout.n < 1)
        problems.push(`${where} needs a whole number n from 1`)
      else if (numbers.has(callout.n))
        problems.push(`${where} repeats number ${callout.n}`)
      else numbers.add(callout.n)
      if (!isText(callout.note)) problems.push(`${where} needs a note`)
      const bad = targetProblem(callout.target)
      if (bad) problems.push(`${where} ${bad}`)
      else if (usesSelector(callout.target) && !fromManifest)
        problems.push(
          `${where} uses a selector, so the section needs a screen and width from the manifest`
        )
      else if (usesSelector(callout.target) && !isText(spec.manifest))
        problems.push(`${where} uses a selector, so the spec needs a manifest`)
    })
  })
  return problems
}

export function findCapture(manifest, screen, width) {
  return (
    manifest?.captures?.find(
      (capture) => capture.screen === screen && capture.width === width
    ) ?? null
  )
}

export function resolveTarget(target, side, scale = 1) {
  if (!target) return null
  if (!target.selector)
    return { x: target.x * scale, y: target.y * scale, width: 0, height: 0 }
  const element = side?.elements?.find(
    (item) => item.selector === target.selector || item.key === target.selector
  )
  if (!element) return null
  return {
    x: element.x * scale,
    y: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
  }
}

export function pngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47]
  if (!signature.every((byte, at) => bytes[at] === byte))
    throw new Error("not a PNG file")
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

export function displaySize(natural, column, scale = CANVAS.scale) {
  const width = Math.min(natural.width / scale, column)
  return {
    width: Math.round(width * 100) / 100,
    height: Math.round(((natural.height * width) / natural.width) * 100) / 100,
  }
}

export function sectionArrangement(display, column, gap = CANVAS.gap) {
  return display.width * 2 + gap <= column ? "side-by-side" : "stacked"
}

const overlaps = (a, b) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

const contains = (outer, inner) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height

const circleBox = (center, radius) => ({
  x: center.x - radius,
  y: center.y - radius,
  width: radius * 2,
  height: radius * 2,
})

export function anchorFor(box, dx, dy) {
  return {
    x: box.x + (box.width * (dx + 1)) / 2,
    y: box.y + (box.height * (dy + 1)) / 2,
  }
}

function candidate(box, { name, dx, dy, stretch }) {
  const anchor = anchorFor(box, dx, dy)
  const length = Math.hypot(dx, dy)
  const reach = MARK.reach * stretch
  const center = {
    x: anchor.x + (dx / length) * reach,
    y: anchor.y + (dy / length) * reach,
  }
  return { direction: name, anchor, center }
}

function arrowFor(center, anchor, box) {
  const length = Math.hypot(anchor.x - center.x, anchor.y - center.y) || 1
  const ux = (anchor.x - center.x) / length
  const uy = (anchor.y - center.y) / length
  const inset = box.width > 0 && box.height > 0 ? MARK.inset : 0
  return {
    from: {
      x: center.x + ux * MARK.radius,
      y: center.y + uy * MARK.radius,
    },
    to: { x: anchor.x + ux * inset, y: anchor.y + uy * inset },
  }
}

function scoreDirections(mark, marks, placed, bounds) {
  const obstacles = marks
    .filter((other) => other === mark || !contains(other.box, mark.box))
    .map((other) => other.box)
  return OPTIONS.map((direction) => {
    const option = candidate(mark.box, direction)
    const ring = circleBox(option.center, MARK.radius + MARK.clearance)
    const outside =
      option.center.x - MARK.radius < 0 ||
      option.center.y - MARK.radius < 0 ||
      option.center.x + MARK.radius > bounds.width ||
      option.center.y + MARK.radius > bounds.height
    const covered = obstacles.filter((box) => overlaps(ring, box)).length
    const crowded = placed.filter((done) =>
      overlaps(
        circleBox(option.center, MARK.radius + MARK.spacing),
        circleBox(done.center, MARK.radius)
      )
    ).length
    const blocked =
      (outside ? PENALTY.outside : 0) +
      covered * PENALTY.covered +
      crowded * PENALTY.crowded
    return {
      ...option,
      blocked,
      penalty: blocked + direction.ring * PENALTY.ring,
    }
  })
}

export function placeCallouts(sides) {
  const placed = sides.map(() => [])
  const numbers = [
    ...new Set(sides.flatMap((side) => side.marks.map((mark) => mark.n))),
  ]
  for (const n of numbers) {
    const scored = sides.map((side, at) => {
      const mark = side.marks.find((item) => item.n === n)
      return mark
        ? {
            mark,
            options: scoreDirections(mark, side.marks, placed[at], side.bounds),
          }
        : null
    })
    const totals = OPTIONS.map((_, index) =>
      scored.reduce(
        (sum, side) => sum + (side ? side.options[index].penalty : 0),
        0
      )
    )
    const best = totals.indexOf(Math.min(...totals))
    scored.forEach((side, at) => {
      if (!side) return
      const option = side.options[best]
      placed[at].push({
        n,
        direction: option.direction,
        center: option.center,
        clear: option.blocked === 0,
        ...arrowFor(option.center, option.anchor, side.mark.box),
      })
    })
  }
  return placed
}

export function legendRows(callouts, columns = 2, zooms = new Map()) {
  const sorted = [...callouts].sort((a, b) => a.n - b.n)
  const rows = []
  let row = []
  const flush = () => {
    if (row.length) rows.push(row)
    row = []
  }
  for (const { n, note } of sorted) {
    if (zooms.has(n)) {
      flush()
      rows.push([{ n, note, zoom: zooms.get(n) }])
      continue
    }
    row.push({ n, note })
    if (row.length === columns) flush()
  }
  flush()
  return rows
}

export function layoutSection(section, sides, column) {
  const natural = sides.before.size
  const display = displaySize(natural, column)
  const arrangement = sectionArrangement(display, column)
  const ratio = display.width / natural.width
  const shrink = (box) => ({
    x: box.x * ratio,
    y: box.y * ratio,
    width: box.width * ratio,
    height: box.height * ratio,
  })
  const sideMarks = (side) =>
    section.callouts
      .map((callout) => ({
        n: callout.n,
        box: sides[side].boxes.get(callout.n),
      }))
      .filter((mark) => mark.box)
      .map((mark) => ({ ...mark, box: shrink(mark.box) }))
  const sizes = {
    before: displaySize(sides.before.size, column),
    after: displaySize(sides.after.size, column),
  }
  const [beforeMarks, afterMarks] = placeCallouts([
    { marks: sideMarks("before"), bounds: sizes.before },
    { marks: sideMarks("after"), bounds: sizes.after },
  ])
  const panel = (side, callouts) => ({
    image: sides[side].image,
    size: sizes[side],
    callouts,
    missing: section.callouts
      .filter((callout) => !sides[side].boxes.get(callout.n))
      .map((callout) => callout.n),
  })
  return {
    title: section.title,
    arrangement,
    before: panel("before", beforeMarks),
    after: panel("after", afterMarks),
    legend: legendRows(
      section.callouts,
      2,
      zoomViews(calloutZooms(section.callouts, sides), sides)
    ),
  }
}

function zoomViews(zooms, sides) {
  const views = new Map()
  for (const [n, { rects, targets }] of zooms)
    views.set(
      n,
      Object.fromEntries(
        SIDES.map((side) => {
          const scale = sides[side].scale ?? 1
          const factor = ZOOM.factor
          const target = targets[side]
          const rect = rects[side]
          return [
            side,
            {
              image: sides[side].image,
              crop: {
                width: rect.width * factor,
                height: rect.height * factor,
              },
              shown: {
                width: (sides[side].size.width / scale) * factor,
                height: (sides[side].size.height / scale) * factor,
                left: -rect.x * factor,
                top: -rect.y * factor,
              },
              outline: {
                left: (target.x - rect.x) * factor,
                top: (target.y - rect.y) * factor,
                width: target.width * factor,
                height: target.height * factor,
              },
            },
          ]
        })
      )
    )
  return views
}

const escapeHtml = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

const round = (value) => Math.round(value * 100) / 100

function arrowHead(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const size = 9
  const point = (turn) => ({
    x: to.x - size * Math.cos(angle + turn),
    y: to.y - size * Math.sin(angle + turn),
  })
  const left = point(0.45)
  const right = point(-0.45)
  return `${round(to.x)},${round(to.y)} ${round(left.x)},${round(left.y)} ${round(right.x)},${round(right.y)}`
}

function overlaySvg(panel) {
  const marks = panel.callouts
    .map((mark) => {
      const length =
        Math.hypot(mark.to.x - mark.from.x, mark.to.y - mark.from.y) || 1
      const shaft = {
        x: mark.to.x - ((mark.to.x - mark.from.x) / length) * 7,
        y: mark.to.y - ((mark.to.y - mark.from.y) / length) * 7,
      }
      return [
        `<line x1="${round(mark.from.x)}" y1="${round(mark.from.y)}" x2="${round(shaft.x)}" y2="${round(shaft.y)}" stroke="var(--mark)" stroke-width="3" stroke-linecap="round"/>`,
        `<polygon points="${arrowHead(mark.from, mark.to)}" fill="var(--mark)"/>`,
        `<circle cx="${round(mark.center.x)}" cy="${round(mark.center.y)}" r="${MARK.radius}" fill="var(--mark)" stroke="#fff" stroke-width="2"/>`,
        `<text x="${round(mark.center.x)}" y="${round(mark.center.y)}" dy="0.36em" text-anchor="middle">${mark.n}</text>`,
      ].join("")
    })
    .join("")
  return `<svg width="${panel.size.width}" height="${panel.size.height}" viewBox="0 0 ${panel.size.width} ${panel.size.height}">${marks}</svg>`
}

const px = (box) =>
  Object.entries(box)
    .map(([key, value]) => `${key}:${round(value)}px`)
    .join(";")

function zoomHtml(label, view) {
  return `<figure class="zoom"><div class="crop" style="${px(view.crop)}"><img src="${view.image}" style="${px(view.shown)}" alt=""><i style="${px(view.outline)}"></i></div><figcaption>${escapeHtml(label)}</figcaption></figure>`
}

function legendItemHtml(item) {
  const zoom = item.zoom
    ? `<div class="zooms">${zoomHtml(`Before ${ZOOM.factor}x`, item.zoom.before)}${zoomHtml(`After ${ZOOM.factor}x`, item.zoom.after)}</div>`
    : ""
  return `<span class="${item.zoom ? "zoomed" : ""}"><b>${item.n}</b><div>${escapeHtml(item.note)}${zoom}</div></span>`
}

function panelHtml(label, panel) {
  return `<figure><figcaption>${escapeHtml(label)}</figcaption><div class="shot" style="width:${panel.size.width}px;height:${panel.size.height}px"><img src="${panel.image}" width="${panel.size.width}" height="${panel.size.height}" alt="">${overlaySvg(panel)}</div></figure>`
}

export function compositeHtml(layouts, labels) {
  const sections = layouts
    .map(
      (layout) =>
        `<section><h2>${escapeHtml(layout.title)}</h2><div class="pair ${layout.arrangement}">${panelHtml(labels.before, layout.before)}${panelHtml(labels.after, layout.after)}</div><ol class="legend">${layout.legend
          .map((row) => `<li>${row.map(legendItemHtml).join("")}</li>`)
          .join("")}</ol></section>`
    )
    .join("")
  return `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--mark:#f0407a;--canvas:#0d0d0f;--ink:#ececef;--muted:#9b9ba3;--line:#2b2b31}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${CANVAS.width}px;background:var(--canvas);color:var(--ink);font:500 14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;padding:${CANVAS.pad}px}
section+section{margin-top:36px}
h2{font-size:17px;font-weight:650;margin-bottom:10px}
figure{display:flex;flex-direction:column;gap:6px}
figcaption{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.pair{display:flex;gap:${CANVAS.gap}px}
.pair.stacked{flex-direction:column;gap:16px}
.shot{position:relative;outline:1px solid var(--line);border-radius:4px;overflow:hidden}
.shot img,.shot svg{position:absolute;inset:0;display:block}
svg text{fill:#fff;font:800 14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.legend{list-style:none;margin-top:14px;display:flex;flex-direction:column;gap:8px}
.legend li{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.legend span{display:flex;gap:10px;align-items:flex-start;font-size:14.5px}
.legend span.zoomed{grid-column:1 / -1}
.zooms{display:flex;gap:16px;margin-top:8px}
.zoom figcaption{margin-top:4px}
.crop{position:relative;overflow:hidden;outline:1px solid var(--line);border-radius:4px;background:#fff}
.crop img{position:absolute;max-width:none;image-rendering:pixelated}
.crop i{position:absolute;outline:2px dashed var(--mark);outline-offset:1px}
.legend b{flex:none;width:22px;height:22px;border-radius:50%;background:var(--mark);color:#fff;font-size:12.5px;font-weight:800;display:grid;place-items:center;border:1.5px solid #fff}
</style></head><body>${sections}</body></html>`
}

export function sectionColumn() {
  return CANVAS.width - CANVAS.pad * 2
}
