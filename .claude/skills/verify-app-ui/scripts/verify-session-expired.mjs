#!/usr/bin/env node
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { launchBrowser } from "./lib/cdp.mjs"
import { comparePenLayout, TEXT_TOKENS } from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"
import { signInThrowaway } from "./lib/session.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const output = process.argv[2]
const { WEB_URL: webUrl, API_URL: apiUrl, API_LOG: logPath } = process.env
if (!output || !webUrl || !apiUrl || !logPath) {
  throw new Error(
    "Usage: WEB_URL=... API_URL=... API_LOG=... node verify-session-expired.mjs <evidence-dir>"
  )
}
mkdirSync(output, { recursive: true })
const design = "apps/web/src/features/auth/design"
const files = [
  "apps/web/src/features/auth/session-expired-dialog.tsx",
  `${design}/session-expired.pen.css`,
  `${design}/session-expired.layout.json`,
  `${design}/session-expired.snapshot.json`,
  `${design}/session-expired.styles.json`,
  ".claude/skills/verify-app-ui/scripts/verify-session-expired.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/pen-layout-probe.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/pen-layout-compare.mjs",
]
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex")
const sourceHashes = () =>
  Object.fromEntries(files.map((file) => [file, hash(join(repo, file))]))
const before = sourceHashes()
const PEN_EMAIL = "linh.nguyen@gmail.com"
const layout = JSON.parse(
  readFileSync(join(repo, design, "session-expired.layout.json"), "utf8")
)
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim(),
  sourceHashes: before,
  method:
    "Real throwaway OTP session, followed by an intercepted profile 401. Tab and Escape use native keyboard events.",
  limits:
    "Geometry only, not native Pencil pixels. Comparison is scoped to the source dialog; the Apply background is outside this unit. Continue uses the actual saved email, not the source fixture. Google artwork is omitted because the action sends an email code. Source Log out contrast is below AA. Hover is checked separately with desktop pointer support.",
  captures: [],
}
const browser = await launchBrowser()
let failed = false
try {
  const signIn = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
  })
  const email = await signInThrowaway({
    page: signIn,
    webUrl,
    apiUrl,
    logPath,
    name: "Pen Layout",
    prefix: "pen-layout",
  })
  await signIn.goto(`${webUrl}/apply`)
  if (
    !(await signIn.waitFor(
      "document.querySelector('[data-slot=app-shell]')",
      15000
    ))
  ) {
    throw new Error("Signed-in app did not load")
  }
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [360, 740],
    [320, 640],
  ]) {
    const page = await browser.openPage({
      width,
      height,
      mobile: width < 600,
      reducedMotion: true,
    })
    await page.goto(`${webUrl}/apply`)
    if (
      !(await page.waitFor(
        "document.querySelector('[data-slot=app-shell]')",
        15000
      ))
    )
      throw new Error(`Signed-in app did not load at ${width}`)
    page.setIntercept((request) =>
      request.method !== "OPTIONS" && request.url.includes("/api/profile")
        ? {
            status: 401,
            body: {
              ok: false,
              error: {
                code: "UNAUTHORIZED",
                message: "Authentication required",
              },
            },
          }
        : null
    )
    await page.evaluate(
      "import('/src/lib/api.ts').then(module => module.apiRequest('/api/profile')).catch(error => ({code: error.code, status: error.status}))"
    )
    if (!(await page.waitFor("document.querySelector('[role=dialog]')", 15000)))
      throw new Error(`No dialog at ${width}`)
    await page.evaluate("document.fonts.ready")
    await page.evaluate(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
    )
    const runtime = await page.evaluate(`(() => {
      const d=document.querySelector('[role=dialog]'), r=d.getBoundingClientRect();
      return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
        fontLoaded:document.fonts.check('14px "Inter Variable"'),fontFamily:getComputedStyle(d).fontFamily,
        overflow:document.documentElement.scrollWidth>innerWidth,dialog:{x:r.x,y:r.y,width:r.width,height:r.height},
        buttons:[...d.querySelectorAll('button')].map(b=>b.textContent.trim())};
    })()`)
    await page.evaluate(
      "document.querySelector('[data-slot=session-continue]').focus()"
    )
    const focus = []
    for (let index = 0; index < 4; index++) {
      focus.push(
        await page.evaluate(
          `(() => { const a=document.activeElement; return {text:a.textContent.trim(),inside:document.querySelector('[role=dialog]').contains(a)} })()`
        )
      )
      await page.key("Tab")
      await page.evaluate(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
      )
    }
    await page.key("Escape")
    const escapeKeptDialog = await page.evaluate(
      "Boolean(document.querySelector('[role=dialog]'))"
    )
    const trapped =
      focus.every((item) => item.inside) && focus[0].text === focus[3].text
    if (
      !runtime.fontLoaded ||
      runtime.overflow ||
      !trapped ||
      !escapeKeptDialog
    )
      failed = true
    let comparison = null
    const signedInTexts = layout.texts.map((entry) => ({
      ...entry,
      text: entry.text.replace(PEN_EMAIL, email),
    }))
    if (width === layout.viewport.width) {
      const measured = await page.evaluate(
        probeSource({
          mode: "app",
          pane: "[role=dialog]",
          texts: signedInTexts,
          tokens: TEXT_TOKENS,
        })
      )
      if (measured.error) throw new Error(measured.error)
      comparison = comparePenLayout({
        layout: { ...layout, texts: signedInTexts },
        ...measured,
      })
      if (comparison.mismatches.length) failed = true
    }
    const screenshot = `session-expired-${width}.png`
    await page.screenshot(join(output, screenshot), false)
    report.captures.push({
      capturedAt: new Date().toISOString(),
      screenshot,
      screenshotSha256: hash(join(output, screenshot)),
      runtime,
      focus,
      trapped,
      escapeKeptDialog,
      comparison,
    })
  }
} catch (error) {
  report.error = String(error)
  process.exitCode = 2
} finally {
  await browser.quit()
  report.sourceUnchanged =
    JSON.stringify(before) === JSON.stringify(sourceHashes())
  if (!report.sourceUnchanged) process.exitCode = 2
  report.passed = !failed && !report.error && report.sourceUnchanged
  writeFileSync(
    join(output, "result.json"),
    JSON.stringify(report, null, 2) + "\n"
  )
}
if (!process.exitCode && failed) process.exitCode = 1
console.log(
  JSON.stringify({
    passed: report.passed,
    captures: report.captures.length,
    result: join(output, "result.json"),
    exitCode: process.exitCode ?? 0,
  })
)
