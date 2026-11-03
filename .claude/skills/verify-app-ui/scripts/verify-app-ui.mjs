#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs"
import { createConnection } from "node:net"

import { launchBrowser } from "./lib/cdp.mjs"
import { runChecks } from "./lib/checks.mjs"
import { EXIT_CODE, summarize } from "./lib/check-util.mjs"
import { KINDS } from "./lib/kinds.mjs"
import { startStack, stopStack } from "./lib/stack.mjs"
import { gate, selectTier, tierFromEnv } from "./lib/tier.mjs"
import { runTour } from "./lib/tour.mjs"

const base = Number(process.env.PORT ?? 4450)
if (!(base >= 4450 && base <= 4458)) {
  console.error(
    "verify-app-ui error: PORT must be 4450 to 4458 (api uses PORT, web PORT+1)"
  )
  process.exit(EXIT_CODE.stackBrowserOrScreenBroken)
}
const tier = tierFromEnv()
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
  const { lines, exit: code } = summarize(
    selectTier(KINDS, tier, runChecks(data, gate(KINDS, tier))),
    tier
  )
  console.log(
    `verify-app-ui api=${stack.apiUrl} web=${stack.webUrl} (1440x900, 390x844, reduced motion)`
  )
  for (const line of lines) console.log(line)
  exit = code
} catch (error) {
  console.error(`verify-app-ui error: ${error.message}`)
  exit = 2
} finally {
  if (browser) await browser.quit()
  stopStack(run)
}
process.exit(exit)
