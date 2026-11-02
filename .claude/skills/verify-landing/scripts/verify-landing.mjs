#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  gate,
  selectTier,
  tierFromEnv,
} from "../../verify-app-ui/scripts/lib/tier.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import { designProbeSource } from "./lib/design-probe.mjs"
import { KINDS } from "./lib/kinds.mjs"
import { pageChecks } from "./lib/page-checks.mjs"
import { penProbeSource } from "./lib/pen-probe.mjs"
import { probeSource } from "./lib/probe.mjs"
import { loadSpecOrError } from "./lib/spec.mjs"
import { textRules } from "./lib/text-rules.mjs"
import { summarize } from "./lib/verdict.mjs"

const REVEAL_SCROLL_STEP_MS = 400

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const port = process.env.PORT ?? "4399"
const url = `http://127.0.0.1:${port}/`
const portOwner = resolve(
  repo,
  ".claude/skills/verify-opencv/scripts/port-owner.sh"
)
const tier = tierFromEnv()
const want = gate(KINDS, tier)
let spec = null
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
    if (await answers()) {
      const owner = spawnSync("bash", [portOwner, port, String(child.pid)], {
        encoding: "utf8",
      })
      if (owner.status === 0) return child
      process.kill(-child.pid, "SIGKILL")
      throw new Error(
        owner.stderr.trim() ||
          `port ${port} is in use by a server this run did not start`
      )
    }
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
    if (wanted.touch) snap.touch = await page.evaluate(probeSource("touch"))
    if (wanted.design && spec)
      snap.design = await page.evaluate(designProbeSource(spec))
    if (keep)
      await page.screenshot(`${shots}/${wanted.shot}-first-view.png`, false)
    if (wanted.deep || keep) {
      await page.evaluate(`(async () => {
        for (let y = 0; y <= document.documentElement.scrollHeight; y += innerHeight * 0.7) {
          scrollTo(0, y)
          await new Promise((r) => setTimeout(r, ${REVEAL_SCROLL_STEP_MS}))
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
    if (wanted.pen && tier !== "invariant") {
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
const bail = (code) => async () => {
  try {
    if (browser) await browser.quit()
  } catch {}
  if (server) process.kill(-server.pid, "SIGTERM")
  process.exit(code)
}
process.on("SIGINT", bail(130))
process.on("SIGTERM", bail(143))
try {
  if (tier !== "invariant") {
    spec = loadSpecOrError()
    if (spec.error) throw new Error(spec.error)
  }
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
    { top: true, deep: true, shot: "desktop", pen: true, design: true }
  )
  const mobile = await visit(
    browser,
    { width: 390, height: 844, mobile: true, reducedMotion: false },
    { top: true, touch: true, shot: "mobile", menu: true }
  )
  const reduced = await visit(
    browser,
    { width: 1440, height: 900, mobile: false, reducedMotion: true },
    { deep: true }
  )
  if (!desktop.top.blocks.some((b) => b.tag === "h1"))
    throw new Error(`no H1 rendered at ${url}`)
  const results = selectTier(KINDS, tier, [
    ...textRules(desktop.top, want),
    ...pageChecks({
      desktop: { ...desktop.top, ...desktop.design },
      mobile: mobile.top,
      mobileOpen: mobile.topOpen ?? null,
      touch: mobile.touch,
      first: desktop.first,
      mobileFirst: mobile.first,
      reduced: reduced.first,
      deep: desktop.deep,
      reducedDeep: reduced.deep,
      penSections: desktop.pen,
      design: spec,
      want,
    }),
  ])
  const { lines, exit: code } = summarize(results, tier)
  console.log(`verify-landing ${url} (1440x900, 390x844, reduced motion)`)
  for (const line of lines) console.log(line)
  exit = code
} catch (error) {
  console.error(`verify-landing error: ${error.message}`)
  exit = 2
} finally {
  if (browser) await browser.quit()
  if (server) process.kill(-server.pid, "SIGTERM")
}
process.exit(exit)
