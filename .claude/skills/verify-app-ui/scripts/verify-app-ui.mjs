#!/usr/bin/env node
// verify-app-ui: measures the signed-in app (Home and Coach, Paper, Apply, Pitch) against the mechanical
// checks in SKILL.md.
//   pnpm --filter web verify:app-ui        (api on PORT, web on PORT+1; 4450 and 4451 by default)
//   VERIFY_APP_UI_SHOTS=<dir> also writes the review screenshots.
//   VERIFY_APP_UI_DATA=<file> writes the raw measurements as JSON for inspection.
// Starts the api (PGlite, scripted Coach) and the web dev server through the verify-opencv skill's
// launch.sh, signs up a throwaway account, drives headless Chromium over the DevTools protocol, prints
// one PASS or FAIL line per property, tears everything down, and exits 1 when any property fails.
// It never edits the app. Exit 2 means the stack, the browser or a screen did not work (an error, not a verdict).
import { mkdirSync, writeFileSync } from "node:fs"
import { createConnection } from "node:net"

import { launchBrowser } from "./lib/cdp.mjs"
import { runChecks } from "./lib/checks.mjs"
import { startStack, stopStack } from "./lib/stack.mjs"
import { runTour } from "./lib/tour.mjs"

const base = Number(process.env.PORT ?? 4450)
if (!(base >= 4450 && base <= 4458)) {
  console.error(
    "verify-app-ui error: PORT must be 4450 to 4458 (api uses PORT, web PORT+1)"
  )
  process.exit(2)
}
const shots = process.env.VERIFY_APP_UI_SHOTS
if (shots) mkdirSync(shots, { recursive: true })

const taken = (port) =>
  new Promise((done) => {
    const s = createConnection({ port, host: "127.0.0.1" })
    s.on("connect", () => (s.destroy(), done(true)))
    s.on("error", () => done(false))
  })

const run = `app-ui-${process.pid}`
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
  for (const port of [base, base + 1]) {
    if (await taken(port))
      throw new Error(
        `port ${port} is in use; stop whatever holds it or pick another PORT`
      )
  }
  const stack = startStack({ apiPort: base, webPort: base + 1, run })
  browser = await launchBrowser()
  const data = await runTour({ browser, ...stack, shots })
  if (process.env.VERIFY_APP_UI_DATA)
    writeFileSync(process.env.VERIFY_APP_UI_DATA, JSON.stringify(data, null, 1))
  const results = runChecks(data)
  const failed = results.filter((r) => !r.pass)
  console.log(
    `verify-app-ui api=${stack.apiUrl} web=${stack.webUrl} (1440x900, 390x844, reduced motion)`
  )
  for (const r of results) {
    console.log(
      `${r.pass ? "PASS" : "FAIL"} ${r.id} ${r.name}: ${r.measured.slice(0, 230)} | rule: ${r.rule}`
    )
  }
  console.log(
    `${results.length - failed.length} PASS, ${failed.length} FAIL${failed.length ? `: ${failed.map((r) => r.id).join(" ")}` : ""}`
  )
  if (failed.length) exit = 1
} catch (error) {
  console.error(`verify-app-ui error: ${error.message}`)
  exit = 2
} finally {
  if (browser) await browser.quit()
  stopStack(run)
}
process.exit(exit)
