#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { launchBrowser } from "./lib/cdp.mjs"
import { judgeRoutes, spills } from "./lib/overflow-390.mjs"
import {
  MARK,
  routesFor,
  seedWorstCase,
  signInWorstCase,
} from "./lib/worst-case-seed.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const output = process.argv[2]
const { WEB_URL: webUrl, API_URL: apiUrl, API_LOG: logPath } = process.env
if (!output || !webUrl || !apiUrl || !logPath) {
  throw new Error(
    "Usage: WEB_URL=... API_URL=... API_LOG=... node verify-overflow-390.mjs <evidence-dir>"
  )
}
mkdirSync(output, { recursive: true })

const pending = JSON.parse(
  readFileSync(join(repo, "scripts/overflow-390.pending.json"), "utf8")
)
const today = new Date().toISOString().slice(0, 10)

const collect = (mark) => `(() => {
  const mark = ${JSON.stringify(mark)}
  const innerWidth = window.innerWidth
  const scrollWidth = document.documentElement.scrollWidth
  const nodes = []
  for (const el of document.body.querySelectorAll("*")) {
    const style = getComputedStyle(el)
    if (style.display === "none" || style.visibility === "hidden") continue
    if (style.overflowX !== "visible") continue
    const hasText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())
    if (!hasText) continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) continue
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue
    if (rect.right < 0 || rect.left > innerWidth) continue
    const parent = el.parentElement
    if (!parent) continue
    const parentOverflow = getComputedStyle(parent).overflowX
    const box = parent.getBoundingClientRect()
    if (rect.right <= box.right + 1 && rect.left >= box.left - 1) continue
    nodes.push({
      overflow: "visible",
      parentOverflow,
      left: rect.left,
      right: rect.right,
      parentLeft: box.left,
      parentRight: box.right,
      text: (el.textContent || "").trim().slice(0, 48),
    })
  }
  return {
    scrollWidth,
    innerWidth,
    nodes,
    marked: (document.body.textContent || "").includes(mark),
  }
})()`

async function openCoachJob(page) {
  const opened = await page.evaluate(`(() => {
    const add = document.querySelector('[aria-label="Add"]')
    if (!add) return "no-add"
    add.click()
    return "clicked"
  })()`)
  if (opened !== "clicked") return false
  const menu = await page.waitFor(
    `document.body.innerText.includes("Add a job from Apply")`,
    8000
  )
  if (!menu) return false
  await page.evaluate(`(() => {
    const row = [...document.querySelectorAll("[data-add-label]")].find((el) => el.textContent.includes("Add a job from Apply"))
    row?.click()
  })()`)
  return page.waitFor(
    `(document.body.textContent || "").includes(${JSON.stringify(MARK)})`,
    8000
  )
}

const browser = await launchBrowser()
const results = []
let failed = false
try {
  const page = await browser.openPage({
    width: 390,
    height: 844,
    mobile: true,
    timezone: "Asia/Ho_Chi_Minh",
  })
  await signInWorstCase({ page, webUrl, apiUrl, logPath })
  const { jobId } = await seedWorstCase({ page, apiUrl })
  for (const route of routesFor(jobId)) {
    await page.goto(`${webUrl}${route.path}`)
    await page.waitFor("document.querySelector('[data-slot=app-shell]')", 15000)
    await page.sleep(400)
    if (route.openJob) await openCoachJob(page)
    await page.sleep(300)
    const shot = await page.evaluate(collect(MARK))
    const hits = spills(shot)
    const result = {
      id: route.id,
      path: route.path,
      mark: route.mark,
      marked: Boolean(shot.marked),
      spills: hits.length,
      scrollWidth: shot.scrollWidth,
      innerWidth: shot.innerWidth,
      sample: hits.slice(0, 4).map((hit) => hit.text ?? hit.kind),
    }
    results.push(result)
    const problems = judgeRoutes(
      [result],
      pending.filter((entry) => entry.id === route.id),
      today
    )
    const ok = problems.length === 0
    if (!ok) failed = true
    console.log(
      `${ok ? "PASS" : "FAIL"} ${route.id} spills=${result.spills} marked=${result.marked} width=${shot.scrollWidth}/${shot.innerWidth}${problems.length ? ` ${problems.join("; ")}` : ""}`
    )
  }
  await page.close()
} finally {
  await browser.quit()
}

const problems = judgeRoutes(results, pending, today)
writeFileSync(
  join(output, "overflow-390.json"),
  `${JSON.stringify({ today, problems, results }, null, 2)}\n`
)
if (problems.length > 0 || failed) process.exit(1)
