#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { launchBrowser } from "./lib/cdp.mjs"
import { judgeRoutes, offScreen, spills } from "./lib/overflow-390.mjs"
import {
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

const collect = (needle) => `(() => {
  const needle = ${JSON.stringify(needle)}
  const offScreen = ${offScreen.toString()}
  const innerWidth = window.innerWidth
  const scrollWidth = document.documentElement.scrollWidth
  const signature = (el) => {
    const parts = []
    let node = el
    while (node && node !== document.body && parts.length < 8) {
      const slot = node.getAttribute("data-slot")
      if (slot) {
        parts.unshift('[data-slot="' + slot + '"]')
        break
      }
      const tag = node.tagName.toLowerCase()
      const parent = node.parentElement
      const same = parent
        ? [...parent.children].filter((child) => child.tagName === node.tagName)
        : []
      const nth = same.indexOf(node) + 1
      parts.unshift(same.length > 1 ? tag + ":nth-of-type(" + nth + ")" : tag)
      node = node.parentElement
    }
    return parts.join(" > ")
  }
  const textBox = (el) => {
    const range = document.createRange()
    let left = Infinity
    let right = -Infinity
    let top = Infinity
    let bottom = -Infinity
    let any = false
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      if (box.width < 1 || box.height < 1) continue
      any = true
      left = Math.min(left, box.left)
      right = Math.max(right, box.right)
      top = Math.min(top, box.top)
      bottom = Math.max(bottom, box.bottom)
    }
    if (!any) return null
    return { left, right, top, bottom, width: right - left, height: bottom - top }
  }
  const nodes = []
  for (const el of document.body.querySelectorAll("*")) {
    const style = getComputedStyle(el)
    if (style.display === "none" || style.visibility === "hidden") continue
    if (style.overflowX !== "visible") continue
    const rect = textBox(el)
    if (!rect || offScreen(rect, innerWidth)) continue
    let parent = el.parentElement
    let hit = null
    while (parent && parent !== document.body) {
      const parentStyle = getComputedStyle(parent)
      if (parentStyle.overflowX !== "visible") break
      const box = parent.getBoundingClientRect()
      if (rect.right > box.right + 1 || rect.left < box.left - 1) {
        hit = box
        break
      }
      parent = parent.parentElement
    }
    if (!hit) continue
    nodes.push({
      overflow: "visible",
      parentOverflow: "visible",
      left: rect.left,
      right: rect.right,
      parentLeft: hit.left,
      parentRight: hit.right,
      selector: signature(el),
      text: (el.textContent || "").trim().slice(0, 48),
    })
  }
  return {
    scrollWidth,
    innerWidth,
    nodes,
    marked: needle ? (document.body.textContent || "").includes(needle) : true,
  }
})()`

async function openCoachJob(page, needle) {
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
    `(document.body.textContent || "").includes(${JSON.stringify(needle)})`,
    8000
  )
}

async function openExpired(page, email, path) {
  await page.goto(`${webUrl}${path}`)
  await page.waitFor("document.querySelector('[data-slot=app-shell]')", 15000)
  await page.evaluate(
    `sessionStorage.setItem("opencv.signedOutEmail", ${JSON.stringify(email)})`
  )
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
    `import("/src/lib/api.ts").then((module) => module.apiRequest("/api/profile")).catch(() => null)`
  )
  page.setIntercept(null)
  return page.waitFor(
    `document.querySelector('[role=dialog]') && (document.body.textContent || "").includes(${JSON.stringify(email)})`,
    15000
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
    if (route.openExpired) {
      await openExpired(page, route.needle, route.path)
    } else {
      await page.goto(`${webUrl}${route.path}`)
      await page.waitFor(
        "document.querySelector('[data-slot=app-shell]')",
        15000
      )
      await page.sleep(400)
      if (route.openJob) await openCoachJob(page, route.needle)
    }
    await page.sleep(300)
    const shot = await page.evaluate(collect(route.needle ?? ""))
    const hits = spills(shot)
    const result = {
      id: route.id,
      path: route.path,
      needle: route.needle ?? null,
      marked: Boolean(shot.marked),
      hits,
      spills: hits.length,
      scrollWidth: shot.scrollWidth,
      innerWidth: shot.innerWidth,
      sample: hits
        .slice(0, 4)
        .map((hit) =>
          hit.selector ? `${hit.selector} ${hit.text}` : hit.kind
        ),
    }
    results.push(result)
    const problems = judgeRoutes(
      [result],
      pending.filter((entry) => entry.route === route.id),
      today
    )
    const ok = problems.length === 0
    if (!ok) failed = true
    console.log(
      `${ok ? "PASS" : "FAIL"} ${route.id} spills=${result.spills} marked=${result.marked} width=${shot.scrollWidth}/${shot.innerWidth}${problems.length ? ` ${problems.join("; ")}` : ""}${result.sample.length ? ` sample=${result.sample.join(" | ")}` : ""}`
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
