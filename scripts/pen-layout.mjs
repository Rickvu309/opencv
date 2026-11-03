#!/usr/bin/env node
// Records where every visible text of a pen frame sits when the frame is rendered at 1440x900 with the
// app's Inter, so a browser check can hold the built page to the same layout.
//   node scripts/pen-layout.mjs <pen file> <frame id> <out.json> --route <path> [--pane <node id>] [--png <file>] [--driver <script>]
// --pane defaults to GIhbq, the app shell's main panel. Positions are relative to that panel's top-left.
// --driver names the check that sets the state up (seeded data, an open dialog); verify-pen-layout
// skips such a layout and that script measures it.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { launchBrowser } from "../.claude/skills/verify-app-ui/scripts/lib/cdp.mjs"
import { probeSource } from "../.claude/skills/verify-app-ui/scripts/lib/pen-layout-probe.mjs"
import { expandPenRefs, findPenNode, penFrameToDocument } from "./pen-html.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const USAGE =
  "usage: node scripts/pen-layout.mjs <pen file> <frame id> <out.json> --route <path> [--pane <node id>] [--png <file>] [--driver <script>]"

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
    driver: flags.driver ?? null,
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
    letterSpacing: Math.round(entry.letterSpacing * 100) / 100,
    lineHeight: entry.lineHeight == null ? null : round(entry.lineHeight),
    color: entry.color,
    background: entry.background,
    textAlign: entry.textAlign,
  }
}

const inlineEntries = (entries) =>
  entries.length
    ? `[\n${entries
        .map((entry) =>
          `    ${JSON.stringify(entry)}`
            .replace(/"([^"]+)":/g, '"$1": ')
            .replace(/^( *)\{/, "$1{ ")
            .replace(/\}$/, " }")
        )
        .join(",\n")}\n  ]`
    : "[]"

const layoutJson = ({ icons, boxes, ...rest }) =>
  `${JSON.stringify({ ...rest, icons: "@icons", boxes: "@boxes" }, null, 2)
    .replace('"@icons"', () => inlineEntries(icons))
    .replace('"@boxes"', () => inlineEntries(boxes))}\n`

const holds = (box, inner) =>
  inner.x + inner.width / 2 >= box.x &&
  inner.x + inner.width / 2 <= box.x + box.width &&
  inner.y + inner.height / 2 >= box.y &&
  inner.y + inner.height / 2 <= box.y + box.height

const placed = ({ x, y, width, height, ...name }) => ({
  ...name,
  x: round(x),
  y: round(y),
  width: round(width),
  height: round(height),
})

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
      ...(args.driver ? { driver: args.driver } : {}),
      viewport,
      pane: {
        width: round(result.pane.width),
        height: round(result.pane.height),
      },
      texts: result.texts.map(shape),
      icons: result.icons
        .filter((icon) => !result.boxes.some((box) => holds(box, icon)))
        .map(({ icon, ...box }) => {
          const { x, y, width } = placed(box)
          return { icon, x, y, size: width }
        }),
      boxes: result.boxes.map(placed),
    }
    mkdirSync(dirname(args.out), { recursive: true })
    writeFileSync(args.out, layoutJson(layout))
    console.log(
      `pen-layout ${args.frameId} ${args.route}: ${layout.texts.length} texts, ${layout.icons.length} icons, ${layout.boxes.length} boxes -> ${args.out}`
    )
  } finally {
    await browser.quit()
  }
}

main().catch((error) => {
  console.error(`pen-layout error: ${error.message}`)
  process.exit(1)
})
