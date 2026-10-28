#!/usr/bin/env node
// Records where every visible text of a pen frame sits when the frame is rendered at 1440x900 with the
// app's Inter, so a browser check can hold the built page to the same layout.
//   node scripts/pen-layout.mjs <pen file> <frame id> <out.json> --route <path> [--pane <node id>] [--png <file>]
// --pane defaults to GIhbq, the app shell's main panel. Positions are relative to that panel's top-left.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { launchBrowser } from "../.claude/skills/verify-app-ui/scripts/lib/cdp.mjs"
import { probeSource } from "../.claude/skills/verify-app-ui/scripts/lib/pen-layout-probe.mjs"
import { expandPenRefs, findPenNode, penFrameToDocument } from "./pen-html.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const USAGE =
  "usage: node scripts/pen-layout.mjs <pen file> <frame id> <out.json> --route <path> [--pane <node id>] [--png <file>]"

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i]
    else positional.push(argv[i])
  }
  const [penFile, frameId, out] = positional
  if (!penFile || !frameId || !out || !flags.route) throw new Error(USAGE)
  return {
    penFile: resolve(penFile),
    frameId,
    out: resolve(out),
    route: flags.route,
    pane: flags.pane ?? "GIhbq",
    png: flags.png ? resolve(flags.png) : null,
  }
}

function interFontFace() {
  const store = join(repo, "node_modules/.pnpm")
  const pkg = readdirSync(store).find((name) =>
    name.startsWith("@fontsource-variable+inter@")
  )
  if (!pkg) throw new Error("@fontsource-variable/inter is not installed")
  const file = join(
    store,
    pkg,
    "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"
  )
  const data = readFileSync(file).toString("base64")
  return `@font-face{font-family:'Inter';font-weight:100 900;font-style:normal;src:url(data:font/woff2;base64,${data}) format('woff2')}`
}

const round = (value) => Math.round(value * 2) / 2

function shape(entry) {
  return {
    text: entry.text,
    x: round(entry.x),
    y: round(entry.y),
    width: round(entry.width),
    height: round(entry.height),
    fontSize: round(entry.fontSize),
    fontWeight: entry.fontWeight,
    letterSpacing: round(entry.letterSpacing),
    lineHeight: entry.lineHeight == null ? null : round(entry.lineHeight),
    color: entry.color,
    textAlign: entry.textAlign,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const doc = JSON.parse(readFileSync(args.penFile, "utf8"))
  const source = findPenNode(doc, args.frameId)
  if (!source) throw new Error(`frame ${args.frameId} is not in the pen file`)
  const frame = expandPenRefs(doc, source)
  const viewport = { width: frame.width, height: frame.height }
  const html = penFrameToDocument(doc, frame, {
    assetBase: join(dirname(args.penFile), "design"),
    fontFace: interFontFace(),
  })
  const scratch = join(homedir(), "tmp", "pen-layout")
  mkdirSync(scratch, { recursive: true })
  const page = join(scratch, `${args.frameId}-${process.pid}.html`)
  writeFileSync(page, html)

  const browser = await launchBrowser()
  try {
    const tab = await browser.openPage({
      ...viewport,
      mobile: false,
      reducedMotion: true,
    })
    await tab.goto(pathToFileURL(page).href)
    const ready = await tab.waitFor(
      "document.fonts.status === 'loaded' && [...document.images].every((img) => img.complete)"
    )
    if (!ready) throw new Error("fonts or images did not load")
    await tab.waitFor(
      "document.fonts.check(\"16px 'Inter'\") && document.querySelector('[data-pen-text]')"
    )
    const result = await tab.evaluate(
      probeSource({ mode: "record", pane: `[data-id="${args.pane}"]` })
    )
    if (result.error) throw new Error(result.error)
    if (args.png) {
      mkdirSync(dirname(args.png), { recursive: true })
      await tab.screenshot(args.png, false)
    }
    const layout = {
      frameId: args.frameId,
      frameName: source.name ?? frame.name ?? args.frameId,
      route: args.route,
      viewport,
      pane: {
        width: round(result.pane.width),
        height: round(result.pane.height),
      },
      texts: result.texts.map(shape),
    }
    mkdirSync(dirname(args.out), { recursive: true })
    writeFileSync(args.out, `${JSON.stringify(layout, null, 2)}\n`)
    console.log(
      `pen-layout ${args.frameId} ${args.route}: ${layout.texts.length} texts -> ${args.out}`
    )
  } finally {
    await browser.quit()
  }
}

main().catch((error) => {
  console.error(`pen-layout error: ${error.message}`)
  process.exit(1)
})
