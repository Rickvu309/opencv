#!/usr/bin/env node
import { mkdirSync } from "node:fs"
import { join } from "node:path"

import { launchBrowser } from "./lib/cdp.mjs"
import {
  coveredTextProbe,
  ILLUSTRATION,
  judgeCoveredText,
  plantCover,
} from "./lib/covered-text.mjs"
import { signInThrowaway } from "./lib/session.mjs"
import { COLLAPSED_KEY } from "./lib/sidebar-resize-shared.mjs"

const output = process.argv[2]
const { WEB_URL: webUrl, API_URL: apiUrl, API_LOG: logPath } = process.env
if (!output || !webUrl || !apiUrl || !logPath)
  throw new Error(
    "Usage: WEB_URL=... API_URL=... API_LOG=... node verify-decoration-cover.mjs <evidence-dir>"
  )
mkdirSync(output, { recursive: true })

const ROUTES = ["/pitch"]
const SCENES = [
  { name: "1440-expanded", width: 1440, height: 900, collapsed: false },
  { name: "1440-collapsed", width: 1440, height: 900, collapsed: true },
  { name: "1280-expanded", width: 1280, height: 800, collapsed: false },
  { name: "1024-expanded", width: 1024, height: 1800, collapsed: false },
  {
    name: "390-phone",
    width: 390,
    height: 2200,
    collapsed: false,
    mobile: true,
  },
]

const browser = await launchBrowser()
let failed = 0
let code = 0
try {
  const first = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  await signInThrowaway({ page: first, webUrl, apiUrl, logPath })
  for (const scene of SCENES) {
    const page = await browser.openPage({
      width: scene.width,
      height: scene.height,
      mobile: Boolean(scene.mobile),
      reducedMotion: true,
    })
    await page.goto(webUrl)
    await page.evaluate(
      `localStorage.setItem(${JSON.stringify(COLLAPSED_KEY)}, ${scene.collapsed ? '"1"' : '"0"'})`
    )
    for (const route of ROUTES) {
      const tag = `${scene.name} ${route}`
      await page.goto(`${webUrl}${route}`)
      await page.waitFor(
        `!!document.querySelector(${JSON.stringify(ILLUSTRATION)})`,
        20000
      )
      await page.evaluate("document.fonts.ready.then(() => true)")
      await page.sleep(500)
      const planted = await page.evaluate(plantCover(coveredTextProbe()))
      if (!planted || planted.covered.length === 0)
        throw new Error(
          `${tag}: the probe did not see a card planted on a text`
        )
      const result = await page.evaluate(coveredTextProbe())
      await page.screenshot(
        join(output, `${route.slice(1)}-${scene.name}.png`),
        false
      )
      const lines = judgeCoveredText({ tag, result })
      for (const line of lines) console.log(`FAIL ${line}`)
      console.log(
        `${lines.length ? "FAIL" : "PASS"} ${tag}: ${result.texts - result.clipped} readable texts, ${result.clipped} clipped, ${result.covered.length} covered`
      )
      if (lines.length) failed += 1
    }
  }
  if (failed) code = 1
} catch (error) {
  console.error(`verify-decoration-cover error: ${error.message}`)
  code = 2
} finally {
  await browser.quit()
}
process.exit(code)
