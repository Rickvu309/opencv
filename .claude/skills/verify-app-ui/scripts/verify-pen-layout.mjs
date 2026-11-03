#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createConnection } from "node:net"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  portError,
  requireVerifierPorts,
} from "../../../../scripts/lib/worktree-port.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import {
  comparePenLayout,
  formatMismatch,
  TEXT_TOKENS,
} from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"
import { signInThrowaway } from "./lib/session.mjs"
import { startStack, stopStack } from "./lib/stack.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const features = join(repo, "apps/web/src/features")
const PANE = '[data-slot="app-shell"] #app-main'

const ports = requireVerifierPorts(repo)
if (!ports) {
  console.error(portError("verify-pen-layout"))
  process.exit(2)
}
const base = ports.apiPort
const webPort = ports.webPort
const shots = process.env.VERIFY_PEN_LAYOUT_SHOTS
if (shots) mkdirSync(shots, { recursive: true })

const taken = (port) =>
  new Promise((done) => {
    const s = createConnection({ port, host: "127.0.0.1" })
    s.on("connect", () => (s.destroy(), done(true)))
    s.on("error", () => done(false))
  })

const layoutFiles = () =>
  readdirSync(features, { recursive: true })
    .filter((file) => /(^|[\\/])design[\\/][^\\/]+\.layout\.json$/.test(file))
    .sort()
    .map((file) => join(features, file))

const measure = (layout) =>
  probeSource({
    mode: "app",
    pane: PANE,
    texts: layout.texts,
    tokens: TEXT_TOKENS,
  })

async function measureStable(tab, layout) {
  let last = null
  let lastResult = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await tab.evaluate(measure(layout))
    if (result.error) throw new Error(result.error)
    const text = JSON.stringify(result.measured)
    if (text === last) return result
    last = text
    lastResult = result
    await tab.sleep(250)
  }
  return lastResult
}

const run = `pen-layout-${process.pid}`
let browser = null
const bail = (code) => async () => {
  try {
    if (browser) await browser.quit()
  } catch {}
  stopStack(run)
  process.exit(code)
}
process.on("SIGINT", bail(130))
process.on("SIGTERM", bail(143))

let exit = 0
try {
  const files = layoutFiles()
  if (!files.length)
    throw new Error("no *.layout.json under apps/web/src/features")
  for (const port of [base, webPort]) {
    if (await taken(port))
      throw new Error(
        `port ${port} is in use; stop whatever holds it or pick another PORT`
      )
  }
  const stack = startStack({ apiPort: base, webPort, run })
  browser = await launchBrowser()
  const tab = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  await signInThrowaway({
    page: tab,
    ...stack,
    name: "Pen Layout",
    prefix: "pen-layout",
  })

  let failed = 0
  let skipped = 0
  const raw = {}
  for (const file of files) {
    const layout = JSON.parse(readFileSync(file, "utf8"))
    if (layout.driver) {
      skipped += 1
      console.log(
        `SKIP ${layout.frameId} ${layout.route}: set up and measured by ${layout.driver}`
      )
      continue
    }
    await tab.goto(`${stack.webUrl}${layout.route}`)
    await tab.waitFor("document.fonts.status === 'loaded'", 10000)
    await tab.waitFor(
      `(${measure(layout)}).measured?.some((entry) => entry)`,
      20000
    )
    await tab.sleep(400)
    const { measured, tokens, extras } = await measureStable(tab, layout)
    raw[layout.frameId] = measured
    if (shots) {
      const slug = layout.route
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
      await tab.screenshot(join(shots, `${layout.frameId}-${slug}.png`), false)
    }
    const { texts, mismatches } = comparePenLayout({
      layout,
      measured,
      tokens,
      extras,
    })
    for (const m of mismatches) console.log(formatMismatch(layout, m))
    console.log(
      `${mismatches.length ? "FAIL" : "PASS"} ${layout.frameId} ${layout.route}: ${texts} texts, ${mismatches.length} mismatches`
    )
    if (mismatches.length) failed += 1
  }
  if (process.env.VERIFY_PEN_LAYOUT_DATA)
    writeFileSync(
      process.env.VERIFY_PEN_LAYOUT_DATA,
      JSON.stringify(raw, null, 1)
    )
  console.log(
    `${files.length - failed - skipped} PASS, ${failed} FAIL, ${skipped} SKIP of ${files.length} layouts`
  )
  if (failed) exit = 1
} catch (error) {
  console.error(`verify-pen-layout error: ${error.message}`)
  exit = 2
} finally {
  if (browser) await browser.quit()
  stopStack(run)
}
process.exit(exit)
