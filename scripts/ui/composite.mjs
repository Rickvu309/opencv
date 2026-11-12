import { dirname, resolve } from "node:path"
import { UsageError } from "./args.mjs"
import {
  CANVAS,
  compositeHtml,
  findCapture,
  layoutSection,
  pngSize,
  resolveTarget,
  sectionColumn,
  validateSpec,
} from "./annotate.mjs"
import { SIDES } from "./before-after.mjs"

function sideOf(ctx, { section, side, specDir, capture, manifestDir }) {
  const file = section[side]
    ? resolve(specDir, section[side])
    : capture?.[side]?.file
      ? resolve(manifestDir, capture[side].file)
      : null
  if (!file)
    throw new UsageError(
      `${section.title}: no ${side} image (${capture?.[side]?.error ?? "not in the manifest"})`
    )
  const bytes = ctx.fs.readBytes(file)
  const scale = capture?.scale ?? 1
  const boxes = new Map(
    (section.callouts ?? []).map((callout) => [
      callout.n,
      resolveTarget(callout.target, capture?.[side], scale),
    ])
  )
  return {
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

export async function renderComposite(ctx, specFile, out) {
  const { spec, specDir, manifest, manifestDir } = readSpec(ctx, specFile)
  const layouts = spec.sections.map((section) => {
    const capture = section.screen
      ? findCapture(manifest, section.screen, section.width)
      : null
    if (section.screen && !capture)
      throw new UsageError(
        `${section.title}: ${section.screen} at ${section.width} is not in the manifest`
      )
    const sides = Object.fromEntries(
      SIDES.map((side) => [
        side,
        sideOf(ctx, { section, side, specDir, capture, manifestDir }),
      ])
    )
    return layoutSection(
      { ...section, callouts: section.callouts ?? [] },
      sides,
      sectionColumn()
    )
  })
  const html = compositeHtml(layouts, {
    before: `Before (${spec.labels?.before ?? "main"})`,
    after: `After (${spec.labels?.after ?? "this PR"})`,
  })
  const browser = await ctx.browser.launch()
  try {
    const context = await browser.newContext({
      viewport: { width: CANVAS.width, height: 800 },
      deviceScaleFactor: CANVAS.scale,
    })
    const page = await context.newPage()
    await page.setContent(html, { waitUntil: "load" })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: out, fullPage: true })
    await context.close()
  } finally {
    await browser.close()
  }
  return layouts.map((layout) => ({
    title: layout.title,
    missing: { before: layout.before.missing, after: layout.after.missing },
    crowded: SIDES.flatMap((side) =>
      layout[side].callouts
        .filter((mark) => !mark.clear)
        .map((mark) => `${side} ${mark.n}`)
    ),
  }))
}
