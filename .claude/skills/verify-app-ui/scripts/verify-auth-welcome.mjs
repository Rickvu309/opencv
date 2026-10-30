#!/usr/bin/env node
// Run against an owned verify-opencv stack. API_LOG is its OTP log; no paid services.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { launchBrowser } from "./lib/cdp.mjs"
import { comparePenLayout, TEXT_TOKENS } from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"
import { signUpThrowaway } from "./lib/session.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const output = process.argv[2]
const { WEB_URL: webUrl, API_URL: apiUrl, API_LOG: logPath } = process.env
if (!output || !webUrl || !apiUrl || !logPath) {
  throw new Error(
    "Usage: WEB_URL=... API_URL=... API_LOG=... node verify-auth-welcome.mjs <evidence-dir>"
  )
}
mkdirSync(output, { recursive: true })
const design = "apps/web/src/features/auth/design"
const files = [
  "apps/web/src/features/auth/welcome-screen.tsx",
  "apps/web/src/features/auth/auth-copy.ts",
  `${design}/welcome.pen.css`,
  `${design}/w1-5-welcome.layout.json`,
  `${design}/w1-5-welcome.snapshot.json`,
  `${design}/w1-5-welcome.styles.json`,
  ".claude/skills/verify-app-ui/scripts/verify-auth-welcome.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/pen-layout-probe.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/pen-layout-compare.mjs",
]
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex")
const sourceHashes = () =>
  Object.fromEntries(files.map((file) => [file, hash(join(repo, file))]))
const before = sourceHashes()
const layout = JSON.parse(
  readFileSync(join(repo, design, "w1-5-welcome.layout.json"), "utf8")
)
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim(),
  sourceHashes: before,
  method:
    "One real throwaway OTP sign-in reused across viewport tabs and real profile.update. Hold profile.update for pending, then profile.markWelcomed for completed. Neither hold changes product code.",
  limits:
    "Source geometry, not native Pencil pixels. Lowercase opencv maps the source brand to the product invariant. Strict comparison keeps source geometry and contrast requirements; no similarity percentage is inferred.",
  captures: [],
}
const browser = await launchBrowser()
let failed = false
try {
  const signIn = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: false,
    intercept: (request) =>
      request.method !== "OPTIONS" &&
      request.url.includes("profile.markWelcomed")
        ? "hold"
        : null,
  })
  await signUpThrowaway({ page: signIn, webUrl, apiUrl, logPath })
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [360, 740],
    [320, 640],
  ]) {
    let phase = "pending"
    let captureReady = false
    const page = await browser.openPage({
      width,
      height,
      mobile: width < 600,
      reducedMotion: false,
      intercept: (request) => {
        if (request.method === "OPTIONS") return null
        if (request.url.includes("profile.markWelcomed")) return "hold"
        if (!captureReady) return null
        if (phase === "pending" && request.url.includes("profile.update"))
          return "hold"
        return null
      },
    })
    await page.goto(`${webUrl}/favicon.ico`)
    await page.evaluate('sessionStorage.setItem("opencv.language", "vi")')
    captureReady = true
    await page.goto(`${webUrl}/apply`)
    if (
      !(await page.waitFor(
        `document.querySelector('[data-welcome-step="pending"]')`,
        15000
      ))
    ) {
      throw new Error(`Pending Welcome not reached at ${width}`)
    }
    await page.evaluate("document.fonts.ready")
    for (const state of ["pending", "complete"]) {
      if (state === "complete") {
        phase = "complete"
        await page.release()
        if (
          !(await page.waitFor(
            `document.querySelectorAll('[data-welcome-step="done"]').length === 3`,
            15000
          ))
        ) {
          throw new Error(`Completed Welcome not reached at ${width}`)
        }
      }
      await page.evaluate(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
      )
      const runtime = await page.evaluate(`(() => {
        const root = document.querySelector('[data-slot="welcome"]');
        const rect = element => { const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height} };
        return { viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
          fontLoaded:document.fonts.check('14.5px "Inter Variable"'), fontFamily:getComputedStyle(root).fontFamily,
          overflow:document.documentElement.scrollWidth>innerWidth,
          heading:root.querySelector('h1').textContent, mark:rect(root.querySelector('[data-welcome-mark]')),
          steps:[...root.querySelectorAll('[data-welcome-step]')].map(element=>({state:element.dataset.welcomeStep,text:element.textContent,...rect(element)})) };
      })()`)
      if (
        !runtime.fontLoaded ||
        runtime.overflow ||
        runtime.heading !== "Welcome to opencv"
      )
        failed = true
      let comparison = null
      if (width === layout.viewport.width && state === "pending") {
        const texts = layout.texts.map((text) => ({
          ...text,
          text: text.text.replace("OpenCV", "opencv"),
        }))
        const measured = await page.evaluate(
          probeSource({
            mode: "app",
            pane: "body",
            texts,
            tokens: TEXT_TOKENS,
          })
        )
        if (measured.error) throw new Error(measured.error)
        comparison = {
          ...comparePenLayout({ layout: { ...layout, texts }, ...measured }),
          measured: measured.measured,
        }
        if (comparison.mismatches.length) failed = true
      }
      const screenshot = `${state}-${width}.png`
      await page.screenshot(join(output, screenshot), false)
      report.captures.push({
        state,
        capturedAt: new Date().toISOString(),
        screenshot,
        screenshotSha256: hash(join(output, screenshot)),
        runtime,
        comparison,
      })
    }
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
