import { join } from "node:path"
import { openScreen } from "./capture.mjs"
import { viewportFor } from "./screens.mjs"
import { down, liveState, stateDir, up } from "./stack.mjs"

export const SIDES = Object.freeze(["before", "after"])
const INSTALL_DEADLINE_MS = 600_000
const ELEMENT_LIMIT = 400

export const sideFile = (screen, width, side) =>
  `${screen}-${width}.${side}.png`

export const compareDir = (scratchRoot, repo) =>
  join(stateDir(scratchRoot, repo), "compare")

export const baseDir = (scratchRoot, sha) =>
  join(scratchRoot, "bases", sha.slice(0, 12))

export function emptyManifest({ base, baseSha, head, widths }) {
  return { base, baseSha, head, widths, captures: [] }
}

export function captureFor(manifest, screen, width) {
  let capture = manifest.captures.find(
    (item) => item.screen === screen.id && item.width === width
  )
  if (!capture) {
    capture = {
      screen: screen.id,
      width,
      viewport: viewportFor(width),
      scale: 1,
    }
    manifest.captures.push(capture)
  }
  return capture
}

export function recordSide(manifest, screen, width, side, result) {
  captureFor(manifest, screen, width)[side] = result
}

export function manifestProblems(manifest) {
  return manifest.captures.flatMap((capture) =>
    SIDES.filter((side) => !capture[side]?.file).map(
      (side) =>
        `${capture.screen} at ${capture.width} has no ${side} image: ${capture[side]?.error ?? "not captured"}`
    )
  )
}

export async function snapshotElements(page, selectors = []) {
  return page.evaluate(
    ({ selectors, limit }) => {
      const keys = new Map()
      const elements = []
      const read = (element, key, selector) => {
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const px = (value) => Number.parseFloat(value) || 0
        const column =
          style.flexDirection.startsWith("column") || style.display === "grid"
        const parent = element.parentElement?.closest("[data-slot]")
        return {
          key,
          selector,
          slot: element.getAttribute("data-slot"),
          parent: parent ? (keys.get(parent) ?? null) : null,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          radius: px(style.borderTopLeftRadius),
          padding: [
            px(style.paddingTop),
            px(style.paddingRight),
            px(style.paddingBottom),
            px(style.paddingLeft),
          ],
          gap: px(column ? style.rowGap : style.columnGap),
          fontSize: px(style.fontSize),
          fontWeight: style.fontWeight,
          color: style.color,
          background: style.backgroundColor,
          border:
            px(style.borderTopWidth) > 0
              ? `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`
              : "none",
          opacity: style.opacity,
        }
      }
      const seen = new Map()
      for (const element of document.querySelectorAll("[data-slot]")) {
        const slot = element.getAttribute("data-slot")
        const at = seen.get(slot) ?? 0
        seen.set(slot, at + 1)
        const base = `[data-slot="${slot}"]`
        const key = at === 0 ? base : `${base} >> nth=${at}`
        keys.set(element, key)
        const box = element.getBoundingClientRect()
        if (box.width > 0 && box.height > 0 && elements.length < limit)
          elements.push(read(element, key, key))
      }
      for (const selector of selectors) {
        const element = document.querySelector(selector)
        if (element) elements.push(read(element, selector, selector))
      }
      return elements
    },
    { selectors, limit: ELEMENT_LIMIT }
  )
}

export async function prepareBase(ctx, ref) {
  const sha = ctx.git(["rev-parse", "--verify", `${ref}^{commit}`], ctx.repo)
  const dir = baseDir(ctx.scratchRoot, sha)
  ctx.fs.remove(dir)
  ctx.fs.mkdir(dir)
  const log = join(ctx.scratchRoot, "bases", `${sha.slice(0, 12)}.log`)
  ctx.fs.write(log, "")
  const tar = `${dir}.tar`
  const steps = [
    ["git", ["-C", ctx.repo, "archive", "--output", tar, sha], ctx.repo],
    ["tar", ["-xf", tar, "-C", dir], dir],
    ["pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], dir],
  ]
  try {
    for (const [command, args, cwd] of steps) {
      const code = await ctx.proc.run(command, args, {
        cwd,
        env: ctx.env,
        log,
        timeoutMs: INSTALL_DEADLINE_MS,
      })
      if (code !== 0)
        throw new Error(
          `${command} ${args[0]} failed for the base checkout (log ${log})`
        )
    }
  } finally {
    ctx.fs.remove(tar)
  }
  return { sha, dir }
}

export function baseContext(ctx, dir) {
  const env = { ...ctx.env }
  delete env.PORT
  return { ...ctx, repo: dir, env }
}

async function captureSide(
  ctx,
  { state, screens, widths, side, out, manifest, selectors }
) {
  const browser = await ctx.browser.launch()
  try {
    for (const screen of screens)
      for (const width of widths) {
        if (screen.unreachable) {
          recordSide(manifest, screen, width, side, {
            error: `unreachable: ${screen.unreachable}`,
          })
          continue
        }
        try {
          const { page, close } = await openScreen(browser, state, screen, {
            width,
          })
          const file = sideFile(screen.id, width, side)
          await page.screenshot({ path: join(out, file), fullPage: false })
          const elements = await snapshotElements(page, selectors)
          await close()
          recordSide(manifest, screen, width, side, { file, elements })
        } catch (error) {
          recordSide(manifest, screen, width, side, {
            error: error.message.split("\n")[0],
          })
        }
      }
  } finally {
    await browser.close()
  }
}

export async function runCompare(
  ctx,
  { screens, widths, base, out, selectors }
) {
  ctx.fs.mkdir(out)
  const head = ctx.git(["rev-parse", "HEAD"], ctx.repo)
  const started = []
  let checkout = null
  try {
    checkout = await prepareBase(ctx, base)
    const manifest = emptyManifest({
      base,
      baseSha: checkout.sha,
      head,
      widths,
    })
    const baseCtx = baseContext(ctx, checkout.dir)
    started.push(baseCtx)
    const before = await up(baseCtx)
    await captureSide(ctx, {
      state: before.state,
      screens,
      widths,
      side: "before",
      out,
      manifest,
      selectors,
    })
    await down(baseCtx)
    started.pop()
    const running = await liveState(ctx)
    if (!running) started.push(ctx)
    const after = running ?? (await up(ctx)).state
    await captureSide(ctx, {
      state: after,
      screens,
      widths,
      side: "after",
      out,
      manifest,
      selectors,
    })
    const file = join(out, "manifest.json")
    ctx.fs.write(file, JSON.stringify(manifest, null, 2))
    return { manifest, file }
  } finally {
    for (const stack of [...started].reverse()) await down(stack)
    if (checkout) ctx.fs.remove(checkout.dir)
  }
}
