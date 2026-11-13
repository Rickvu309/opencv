import { dirname, resolve } from "node:path"
import { UsageError } from "./args.mjs"
import { markSizes } from "./annotate-marks.mjs"
import {
  CANVAS,
  canvasWidth,
  compositeHtml,
  findCapture,
  isSingle,
  layoutSection,
  layoutSingle,
  pngSize,
  resolveTarget,
  sectionColumn,
  sideTarget,
  validateSpec,
} from "./annotate.mjs"
import { SIDES } from "./before-after.mjs"

function imageFile({ section, side, specDir, capture, manifestDir }) {
  const named = side === "image" ? section.image : section[side]
  if (named) return resolve(specDir, named)
  const from = side === "image" ? section.side : side
  if (capture?.[from]?.file) return resolve(manifestDir, capture[from].file)
  throw new UsageError(
    `${section.title}: no ${from} image (${capture?.[from]?.error ?? "not in the manifest"})`
  )
}

function sideOf(ctx, where) {
  const { section, side, capture } = where
  const bytes = ctx.fs.readBytes(imageFile(where))
  const scale = capture?.scale ?? 1
  const measured = capture?.[side === "image" ? section.side : side]
  const boxes = new Map(
    (section.callouts ?? []).map((callout) => [
      callout.n,
      resolveTarget(
        side === "image" ? callout.target : sideTarget(callout.target, side),
        measured,
        scale
      ),
    ])
  )
  return {
    scale,
    size: pngSize(bytes),
    image: `data:image/png;base64,${bytes.toString("base64")}`,
    boxes,
  }
}

export function readSpec(ctx, specFile) {
  const spec = JSON.parse(ctx.fs.read(specFile))
  const problems = validateSpec(spec)
  if (problems.length) throw new UsageError(problems.join("; "))
  const specDir = dirname(specFile)
  const manifestFile = spec.manifest ? resolve(specDir, spec.manifest) : null
  const manifest = manifestFile ? JSON.parse(ctx.fs.read(manifestFile)) : null
  return {
    spec,
    specDir,
    manifest,
    manifestDir: manifestFile ? dirname(manifestFile) : specDir,
  }
}

function loadSection(ctx, section, { specDir, manifest, manifestDir }) {
  const capture = section.screen
    ? findCapture(manifest, section.screen, section.width)
    : null
  if (section.screen && !capture)
    throw new UsageError(
      `${section.title}: ${section.screen} at ${section.width} is not in the manifest`
    )
  const where = { section, specDir, capture, manifestDir }
  if (isSingle(section)) {
    const image = sideOf(ctx, { ...where, side: "image" })
    return { section, single: true, image, size: image.size }
  }
  const sides = Object.fromEntries(
    SIDES.map((side) => [side, sideOf(ctx, { ...where, side })])
  )
  return { section, single: false, sides, size: sides.before.size }
}

async function markPositions(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("section")].map((section) =>
      [...section.querySelectorAll(".shot")].map((shot) => {
        const box = shot.getBoundingClientRect()
        return { x: box.left + window.scrollX, y: box.top + window.scrollY }
      })
    )
  )
}

export function placedMarks(layout, origins, scale) {
  const panels = layout.single
    ? [["image", layout.panel]]
    : SIDES.map((side) => [side, layout[side]])
  return panels.flatMap(([side, panel], at) =>
    panel.callouts.map((mark) => {
      const toImage = (point) => ({
        x: Math.round((origins[at].x + point.x) * scale * 100) / 100,
        y: Math.round((origins[at].y + point.y) * scale * 100) / 100,
      })
      return {
        side,
        n: mark.n,
        ghost: mark.ghost,
        tip: toImage(mark.to),
        tail: toImage(mark.from),
        badge: toImage(mark.center),
      }
    })
  )
}

export function planComposite(ctx, specFile, only) {
  const read = readSpec(ctx, specFile)
  const picked = only
    ? read.spec.sections.filter((_, at) => only.includes(at))
    : read.spec.sections
  const loaded = picked.map((section) =>
    loadSection(ctx, { ...section, callouts: section.callouts ?? [] }, read)
  )
  const width = canvasWidth(loaded)
  const sizes = markSizes(width, CANVAS.scale)
  const column = sectionColumn(width)
  const layouts = loaded.map((item) =>
    item.single
      ? layoutSingle(item.section, item.image, column, sizes, width)
      : layoutSection(item.section, item.sides, column, sizes, width)
  )
  const html = compositeHtml(
    layouts,
    {
      before: `Before (${read.spec.labels?.before ?? "main"})`,
      after: `After (${read.spec.labels?.after ?? "this PR"})`,
    },
    { width, sizes }
  )
  return { layouts, width, sizes, html }
}

export async function renderComposite(ctx, specFile, out, only) {
  const { layouts, width, html } = planComposite(ctx, specFile, only)
  const browser = await ctx.browser.launch()
  let origins
  try {
    const context = await browser.newContext({
      viewport: { width, height: 800 },
      deviceScaleFactor: CANVAS.scale,
    })
    const page = await context.newPage()
    await page.setContent(html, { waitUntil: "load" })
    await page.evaluate(() => document.fonts.ready)
    origins = await markPositions(page)
    await page.screenshot({ path: out, fullPage: true })
    await context.close()
  } finally {
    await browser.close()
  }
  return layouts.map((layout, at) => {
    const panels = layout.single ? [layout.panel] : SIDES.map((s) => layout[s])
    const names = layout.single ? ["image"] : SIDES
    return {
      title: layout.title,
      missing: Object.fromEntries(
        names.map((name, index) => [name, panels[index].missing])
      ),
      crowded: names.flatMap((name, index) =>
        panels[index].callouts
          .filter((mark) => !mark.clear)
          .map((mark) => `${name} ${mark.n}`)
      ),
      marks: placedMarks(layout, origins?.[at] ?? [], CANVAS.scale),
    }
  })
}
