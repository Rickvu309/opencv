#!/usr/bin/env node
// verify-landing: measures the landing page against the mechanical checks in SKILL.md.
//   pnpm --filter web verify:landing        (PORT=4399 by default)
//   VERIFY_LANDING_SHOTS=<dir> also writes the review screenshots (first view and full page, both viewports).
// Starts the Vite dev server on PORT unless something already answers there, drives headless
// Chromium over the DevTools protocol, prints one PASS or FAIL line per property, and exits 1
// when any property fails. It never edits the app. Exit 2 means the page did not render.
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { launchBrowser } from "./lib/cdp.mjs"
import { pageChecks } from "./lib/page-checks.mjs"
import { penProbeSource } from "./lib/pen-probe.mjs"
import { probeSource } from "./lib/probe.mjs"
import { textRules } from "./lib/text-rules.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const port = process.env.PORT ?? "4399"
const url = `http://127.0.0.1:${port}/`
const shots = process.env.VERIFY_LANDING_SHOTS
if (shots) mkdirSync(shots, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function answers() {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok
  } catch {
    return false
  }
}

async function startServer() {
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "web",
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      port,
      "--strictPort",
    ],
    { cwd: repo, stdio: "ignore", detached: true }
  )
  for (let i = 0; i < 120; i++) {
    if (await answers()) return child
    await sleep(1000)
  }
  process.kill(-child.pid, "SIGKILL")
  throw new Error(`dev server did not answer on ${url} within 120s`)
}

async function visit(
  browser,
  { width, height, mobile, reducedMotion },
  wanted
) {
  const keep = shots && wanted.shot
  const page = await browser.openPage({
    width,
    height,
    mobile,
    reducedMotion,
    url,
  })
  try {
    const snap = {}
    snap.first = await page.evaluate(probeSource("first"))
    await sleep(1500)
    if (wanted.top) snap.top = await page.evaluate(probeSource("top"))
    if (keep)
      await page.screenshot(`${shots}/${wanted.shot}-first-view.png`, false)
    if (wanted.deep || keep) {
      // Headless Chromium delivers IntersectionObserver callbacks about 300 ms after a scroll; at
      // 120 ms a step the scroll reveals never fired and the text stayed hidden for 21 and 23.
      await page.evaluate(`(async () => {
        for (let y = 0; y <= document.documentElement.scrollHeight; y += innerHeight * 0.7) {
          scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 400))
        }
      })()`)
      await sleep(1500)
      if (wanted.deep) snap.deep = await page.evaluate(probeSource("deep"))
      if (keep) {
        await page.evaluate("scrollTo(0, 0)")
        await page.screenshot(`${shots}/${wanted.shot}-full.png`, true)
      }
    }
    if (wanted.menu) {
      await page.evaluate("scrollTo(0, 0)")
      const clicked = await page.evaluate(`(() => {
        const b = [...document.querySelectorAll('header button[aria-expanded="false"]')].find((n) => n.getBoundingClientRect().width > 0)
        if (b) b.click()
        return Boolean(b)
      })()`)
      if (clicked) {
        await sleep(600)
        snap.topOpen = await page.evaluate(probeSource("top"))
      }
    }
    if (wanted.pen) {
      snap.pen = await page.evaluate(`(async () => {
        await document.fonts.ready
        return ${penProbeSource}
      })()`)
    }
    return snap
  } finally {
    await page.close()
  }
}

let server = null
let browser = null
let exit = 0
try {
  if (await answers()) {
    if (!process.env.VERIFY_LANDING_REUSE) {
      throw new Error(
        `something already answers on ${url}; it may be another tree. Stop it, pick another PORT, or set VERIFY_LANDING_REUSE=1`
      )
    }
  } else {
    server = await startServer()
  }
  browser = await launchBrowser()
  const desktop = await visit(
    browser,
    { width: 1440, height: 900, mobile: false, reducedMotion: false },
    { top: true, deep: true, shot: "desktop", pen: true }
  )
  const mobile = await visit(
    browser,
    { width: 390, height: 844, mobile: true, reducedMotion: false },
    { top: true, shot: "mobile", menu: true }
  )
  const reduced = await visit(
    browser,
    { width: 1440, height: 900, mobile: false, reducedMotion: true },
    { deep: true }
  )
  if (!desktop.top.blocks.some((b) => b.tag === "h1"))
    throw new Error(`no H1 rendered at ${url}`)
  const results = [
    ...textRules(desktop.top),
    ...pageChecks({
      desktop: desktop.top,
      mobile: mobile.top,
      mobileOpen: mobile.topOpen ?? null,
      first: desktop.first,
      mobileFirst: mobile.first,
      reduced: reduced.first,
      deep: desktop.deep,
      reducedDeep: reduced.deep,
      penSections: desktop.pen,
    }),
  ]
  const failed = results.filter((r) => !r.pass)
  console.log(`verify-landing ${url} (1440x900, 390x844, reduced motion)`)
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
  console.error(`verify-landing error: ${error.message}`)
  exit = 2
} finally {
  if (browser) await browser.quit()
  if (server) process.kill(-server.pid, "SIGTERM")
}
process.exit(exit)
