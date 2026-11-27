import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/sweep-browser-launch.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SWEEP = "scripts/ui/sweep"
const LAUNCHER = `${SWEEP}/launch-browser.mjs`
const PROBE = `${SWEEP}/probe.test.mjs`

const MISTAKE = `import { chromium } from "playwright-core"

export async function textAt200() {
  const browser = await chromium.launch({ headless: true })
  await browser.close()
}
`

const CLEAN = `import { launchBrowser } from "./launch-browser.mjs"

export async function textAt200() {
  const browser = await launchBrowser()
  await browser.close()
}
`

test("a sweep probe that launches Chromium directly is reported", () => {
  assert.equal(detect(MISTAKE, PROBE).length, 1)
})

test("a sweep probe that uses the shared launcher stays quiet", () => {
  assert.deepEqual(detect(CLEAN, PROBE), [])
})

test("the shared launcher is the one file that may call Chromium directly", () => {
  const launcher = readFileSync(path.join(root, LAUNCHER), "utf8")
  assert.match(launcher, /chromium\.launch\(/)
  assert.deepEqual(detect(launcher, LAUNCHER), [])
})

test("every sweep file uses the shared launcher", () => {
  const files = readdirSync(path.join(root, SWEEP)).filter((name) =>
    name.endsWith(".mjs")
  )
  const problems = files.flatMap((name) =>
    detect(
      readFileSync(path.join(root, SWEEP, name), "utf8"),
      `${SWEEP}/${name}`
    )
  )
  assert.deepEqual(problems, [])
})
