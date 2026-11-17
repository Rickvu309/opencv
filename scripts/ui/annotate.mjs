import { SIDES } from "./before-after.mjs"
import {
  CANVAS_COLORS,
  MARK_OUTLINE,
  MARK_RED,
  NUMBER_INK,
  markSizes,
} from "./annotate-marks.mjs"
import { placeCallouts } from "./annotate-place.mjs"
import { ZOOM, calloutZooms } from "./zoom.mjs"

export { PLACEMENT_ORDER, placeCallouts } from "./annotate-place.mjs"

export const CALLOUTS_PER_SECTION = 25
export const CANVAS = Object.freeze({
  width: 960,
  narrowest: 480,
  oneColumnBelow: 700,
  scale: 1.5,
  pad: 24,
  gap: 24,
})
export const TAGS = Object.freeze({ after: "new", before: "removed" })
const SINGLE_SIDES = Object.freeze(["before", "after"])

const isText = (value) => typeof value === "string" && value.trim().length > 0
const isNumber = (value) => typeof value === "number" && Number.isFinite(value)

const isPerSide = (target) =>
  !!target && typeof target === "object" && SIDES.some((side) => side in target)

export function sideTarget(target, side) {
  if (!isPerSide(target)) return target
  return target[side] ?? null
}

export function onlyOn(target) {
  if (!isPerSide(target)) return null
  const named = SIDES.filter((side) => target[side])
  return named.length === 1 ? named[0] : null
}

export const isSingle = (section) =>
  isText(section.image) || SINGLE_SIDES.includes(section.side)

function plainTargetProblem(target) {
  if (!target || typeof target !== "object") return "needs a target"
  if (isText(target.selector)) return null
  if (isNumber(target.x) && isNumber(target.y)) {
    const sized = [target.width, target.height].filter((v) => v !== undefined)
    if (sized.length && !sized.every((v) => isNumber(v) && v >= 0))
      return "target width and height must be numbers from 0"
    return null
  }
  return "target needs a selector or numeric x and y"
}

function targetProblem(target, single) {
  if (!isPerSide(target)) return plainTargetProblem(target)
  if (single) return "a single image takes a plain target, not before and after"
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

function imageProblems(section, label, fromManifest) {
  if (!isSingle(section))
    return ["before", "after"]
      .filter((side) => !isText(section[side]) && !fromManifest)
      .map(
        (side) =>
          `${label} needs a ${side} image, or a screen and width from the manifest`
      )
  if (isText(section.image)) return []
  return fromManifest
    ? []
    : [
        `${label} names a side, so it needs a screen and width from the manifest`,
      ]
}

export function validateSpec(spec) {
  const problems = []
  if (!spec || !Array.isArray(spec.sections) || spec.sections.length === 0)
    return ["the spec needs a non-empty sections list"]
  spec.sections.forEach((section, at) => {
    const label = `section ${at + 1}`
    if (!isText(section.title)) problems.push(`${label} needs a title`)
    const fromManifest = isText(section.screen) && isNumber(section.width)
    const single = isSingle(section)
    problems.push(...imageProblems(section, label, fromManifest))
    if (
      section.also !== undefined &&
      !(Array.isArray(section.also) && section.also.every(isText))
    )
      problems.push(`${label} also must be a list of text lines`)
    const callouts = section.callouts ?? []
    if (!Array.isArray(callouts)) {
      problems.push(`${label} callouts must be a list`)
      return
    }
    if (callouts.length > CALLOUTS_PER_SECTION)
      problems.push(
        `${label} has ${callouts.length} callouts; keep at most ${CALLOUTS_PER_SECTION} and list the rest under also`
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
      const bad = targetProblem(callout.target, single)
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
    return {
      x: target.x * scale,
      y: target.y * scale,
      width: (target.width ?? 0) * scale,
      height: (target.height ?? 0) * scale,
    }
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

export function canvasWidth(sections) {
  if (sections.some((section) => !section.single)) return CANVAS.width
  const widest = Math.max(
    ...sections.map(
      (section) =>
        displaySize(section.size, CANVAS.width - CANVAS.pad * 2).width
    )
  )
  return Math.min(
    CANVAS.width,
    Math.max(CANVAS.narrowest, Math.ceil(widest + CANVAS.pad * 2))
  )
}

export function legendRows(callouts, columns = 2, zooms = new Map()) {
  const sorted = [...callouts].sort((a, b) => a.n - b.n)
  const rows = []
  let row = []
  const flush = () => {
    if (row.length) rows.push(row)
    row = []
  }
  for (const { n, note, tag } of sorted) {
    const item = tag ? { n, note, tag } : { n, note }
    if (zooms.has(n)) {
      flush()
      rows.push([{ ...item, zoom: zooms.get(n) }])
      continue
    }
    row.push(item)
    if (row.length === columns) flush()
  }
  flush()
  return rows
}

const shrinkBy = (ratio) => (box) => ({
  x: box.x * ratio,
  y: box.y * ratio,
  width: box.width * ratio,
  height: box.height * ratio,
})

function legendColumns(width) {
  return width < CANVAS.oneColumnBelow ? 1 : 2
}

export function layoutSingle(
  section,
  side,
  column,
  sizes = markSizes(CANVAS.width, CANVAS.scale),
  width = CANVAS.width
) {
  const display = displaySize(side.size, column)
  const shrink = shrinkBy(display.width / side.size.width)
  const marks = section.callouts
    .map((callout) => ({ n: callout.n, box: side.boxes.get(callout.n) }))
    .filter((mark) => mark.box)
    .map((mark) => ({ ...mark, box: shrink(mark.box) }))
  const [callouts] = placeCallouts([{ marks, bounds: display }], sizes)
  return {
    title: section.title,
    single: true,
    label: section.label ?? null,
    panel: {
      image: side.image,
      size: display,
      callouts,
      targets: marks,
      missing: section.callouts
        .filter((callout) => !side.boxes.get(callout.n))
        .map((callout) => callout.n),
    },
    legend: legendRows(section.callouts, legendColumns(width)),
    also: section.also ?? [],
  }
}

export function layoutSection(
  section,
  sides,
  column,
  sizes = markSizes(CANVAS.width, CANVAS.scale),
  width = CANVAS.width
) {
  const sizesOf = {
    before: displaySize(sides.before.size, column),
    after: displaySize(sides.after.size, column),
  }
  const arrangement = sectionArrangement(sizesOf.before, column)
  const shrink = Object.fromEntries(
    SIDES.map((side) => [
      side,
      shrinkBy(sizesOf[side].width / sides[side].size.width),
    ])
  )
  const tagged = section.callouts.map((callout) => {
    const only = onlyOn(callout.target)
    return only ? { ...callout, tag: TAGS[only], only } : callout
  })
  const sideMarks = (side) =>
    tagged
      .map((callout) => {
        const own = sides[side].boxes.get(callout.n)
        if (own) return { n: callout.n, box: shrink[side](own) }
        if (!callout.only || callout.only === side) return null
        const there = sides[callout.only].boxes.get(callout.n)
        return there
          ? { n: callout.n, box: shrink[callout.only](there), ghost: true }
          : null
      })
      .filter(Boolean)
  const marks = { before: sideMarks("before"), after: sideMarks("after") }
  const [beforeMarks, afterMarks] = placeCallouts(
    [
      { marks: marks.before, bounds: sizesOf.before },
      { marks: marks.after, bounds: sizesOf.after },
    ],
    sizes
  )
  const panel = (side, callouts) => ({
    image: sides[side].image,
    size: sizesOf[side],
    callouts,
    targets: marks[side],
    missing: tagged
      .filter(
        (callout) =>
          !sides[side].boxes.get(callout.n) &&
          !(callout.only && callout.only !== side)
      )
      .map((callout) => callout.n),
  })
  return {
    title: section.title,
    arrangement,
    before: panel("before", beforeMarks),
    after: panel("after", afterMarks),
    legend: legendRows(
      tagged,
      legendColumns(width),
      zoomViews(calloutZooms(tagged, sides), sides)
    ),
    also: section.also ?? [],
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

export function arrowShape(mark, sizes) {
  const dx = mark.to.x - mark.from.x
  const dy = mark.to.y - mark.from.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const head = Math.min(sizes.head, length)
  const base = { x: mark.to.x - ux * head, y: mark.to.y - uy * head }
  const half = sizes.headWidth / 2
  return {
    shaft: { from: mark.from, to: { x: base.x + ux, y: base.y + uy } },
    head: [
      mark.to,
      { x: base.x - uy * half, y: base.y + ux * half },
      { x: base.x + uy * half, y: base.y - ux * half },
    ],
  }
}

const points = (list) =>
  list.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")

function markSvg(mark, sizes) {
  const { shaft, head } = arrowShape(mark, sizes)
  const line = (stroke, width) =>
    `<line x1="${round(shaft.from.x)}" y1="${round(shaft.from.y)}" x2="${round(shaft.to.x)}" y2="${round(shaft.to.y)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`
  const outline = sizes.outline * 2
  return [
    line(MARK_OUTLINE, sizes.shaft + outline),
    `<polygon points="${points(head)}" fill="${MARK_OUTLINE}" stroke="${MARK_OUTLINE}" stroke-width="${outline}" stroke-linejoin="round"/>`,
    line(MARK_RED, sizes.shaft),
    `<polygon points="${points(head)}" fill="${MARK_RED}"/>`,
    `<circle cx="${round(mark.center.x)}" cy="${round(mark.center.y)}" r="${round(sizes.radius)}" fill="${MARK_RED}" stroke="${MARK_OUTLINE}" stroke-width="${sizes.ring}"/>`,
    `<text x="${round(mark.center.x)}" y="${round(mark.center.y)}" dy="0.36em" text-anchor="middle">${mark.n}</text>`,
  ].join("")
}

function ghostSvg(target, sizes) {
  const box = target.box
  return `<rect x="${round(box.x)}" y="${round(box.y)}" width="${round(Math.max(box.width, 1))}" height="${round(Math.max(box.height, 1))}" fill="none" stroke="${MARK_RED}" stroke-width="${round(sizes.outline)}" stroke-dasharray="${round(sizes.shaft * 1.5)} ${round(sizes.shaft)}"/>`
}

function overlaySvg(panel, sizes) {
  const ghosts = panel.targets
    .filter((target) => target.ghost)
    .map((target) => ghostSvg(target, sizes))
    .join("")
  const marks = panel.callouts.map((mark) => markSvg(mark, sizes)).join("")
  return `<svg width="${panel.size.width}" height="${panel.size.height}" viewBox="0 0 ${panel.size.width} ${panel.size.height}">${ghosts}${marks}</svg>`
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
  const tag = item.tag ? `<em>${escapeHtml(item.tag)}</em>` : ""
  return `<span class="${item.zoom ? "zoomed" : ""}"><b>${item.n}</b><div>${tag}${escapeHtml(item.note)}${zoom}</div></span>`
}

function panelHtml(label, panel, sizes) {
  const caption = label ? `<figcaption>${escapeHtml(label)}</figcaption>` : ""
  return `<figure>${caption}<div class="shot" style="width:${panel.size.width}px;height:${panel.size.height}px"><img src="${panel.image}" width="${panel.size.width}" height="${panel.size.height}" alt="">${overlaySvg(panel, sizes)}</div></figure>`
}

function legendHtml(layout) {
  const rows = layout.legend
    .map((row) => `<li>${row.map(legendItemHtml).join("")}</li>`)
    .join("")
  const also = layout.also.length
    ? `<p class="also">Also: ${layout.also.map(escapeHtml).join("; ")}</p>`
    : ""
  return `<ol class="legend">${rows}</ol>${also}`
}

function sectionHtml(layout, labels, sizes) {
  const body = layout.single
    ? panelHtml(layout.label, layout.panel, sizes)
    : `<div class="pair ${layout.arrangement}">${panelHtml(labels.before, layout.before, sizes)}${panelHtml(labels.after, layout.after, sizes)}</div>`
  return `<section><h2>${escapeHtml(layout.title)}</h2>${body}${legendHtml(layout)}</section>`
}

export function compositeHtml(
  layouts,
  labels,
  { width = CANVAS.width, sizes = markSizes(width, CANVAS.scale) } = {}
) {
  const sections = layouts
    .map((layout) => sectionHtml(layout, labels, sizes))
    .join("")
  const columns = legendColumns(width) === 1 ? "1fr" : "1fr 1fr"
  const badge = round(sizes.badge * 0.85)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--mark:${MARK_RED};--canvas:${CANVAS_COLORS.canvas};--ink:${CANVAS_COLORS.ink};--muted:${CANVAS_COLORS.muted};--line:${CANVAS_COLORS.line}}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${width}px;background:var(--canvas);color:var(--ink);font:500 14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;padding:${CANVAS.pad}px}
section+section{margin-top:36px}
h2{font-size:17px;font-weight:650;margin-bottom:10px}
figure{display:flex;flex-direction:column;gap:6px}
figcaption{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.pair{display:flex;gap:${CANVAS.gap}px}
.pair.stacked{flex-direction:column;gap:16px}
.shot{position:relative;outline:1px solid var(--line);border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgb(0 0 0 / 0.12)}
.shot img,.shot svg{position:absolute;inset:0;display:block}
svg text{fill:${NUMBER_INK};font:800 ${round(sizes.number)}px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.legend{list-style:none;margin-top:14px;display:flex;flex-direction:column;gap:8px}
.legend li{display:grid;grid-template-columns:${columns};gap:24px}
.legend span{display:flex;gap:10px;align-items:flex-start;font-size:14.5px}
.legend span.zoomed{grid-column:1 / -1}
.legend em{font-style:normal;font-weight:700;color:var(--mark);background:#fff;border-radius:4px;padding:0 5px;margin-right:6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.also{margin-top:10px;color:var(--muted);font-size:13.5px}
.zooms{display:flex;gap:16px;margin-top:8px}
.zoom figcaption{margin-top:4px}
.crop{position:relative;overflow:hidden;outline:1px solid var(--line);border-radius:4px;background:#fff}
.crop img{position:absolute;max-width:none;image-rendering:pixelated}
.crop i{position:absolute;outline:2px dashed var(--mark);outline-offset:1px}
.legend b{flex:none;width:${badge}px;height:${badge}px;border-radius:50%;background:var(--mark);color:${NUMBER_INK};font-size:${round(sizes.number * 0.9)}px;font-weight:800;display:grid;place-items:center;border:${round(sizes.ring * 0.75)}px solid ${MARK_OUTLINE}}
</style></head><body>${sections}</body></html>`
}

export function sectionColumn(width = CANVAS.width) {
  return width - CANVAS.pad * 2
}
