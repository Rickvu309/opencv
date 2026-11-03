#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { requireVerifierPorts } from "../../../../scripts/lib/worktree-port.mjs"
import { must } from "./lib/apply-pen-seed.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import { repo } from "./lib/check-util.mjs"
import {
  comparePenLayout,
  formatMismatch,
  TEXT_TOKENS,
} from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"
import { signInThrowaway } from "./lib/session.mjs"

const port = Number(process.env.PORT)
const ports = requireVerifierPorts(repo)
const web = process.env.WEB_ORIGIN ?? ports?.webOrigin ?? null
const api =
  process.env.API_ORIGIN ??
  (Number.isInteger(port) && port > 0 ? `http://localhost:${port}` : null) ??
  ports?.apiOrigin ??
  null
const log = process.env.VERIFY_API_LOG
must(
  web && api && log && process.argv[2],
  "provide PORT or API_ORIGIN, WEB_ORIGIN, VERIFY_API_LOG and evidence directory"
)
must(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(web).hostname) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(api).hostname),
  "local verification stack only"
)

const output = resolve(process.argv[2])
mkdirSync(output, { recursive: true })
const design = join(repo, "apps/web/src/features/paper/design")
const blank = JSON.parse(
  readFileSync(join(design, "cv-blank.layout.json"), "utf8")
)
const editing = JSON.parse(
  readFileSync(join(design, "cv-editing.layout.json"), "utf8")
)
const PANE = '[data-slot="cv-editor-page"]'
const CV_EXCEPTIONS = []

const report = {
  startedAt: new Date().toISOString(),
  head: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim(),
  checks: [],
  frames: [],
  status: "RUNNING",
}
const check = (pass, message) => {
  report.checks.push({ pass: Boolean(pass), message })
  must(pass, message)
}
const browser = await launchBrowser()
const command = async (page, name, input) => {
  const result = await page.evaluate(
    `fetch(${JSON.stringify(`${api}/api/commands/` + name)}, {
      method:'POST',credentials:'include',headers:{'content-type':'application/json'},
      body:JSON.stringify({input:${JSON.stringify(input)},idempotencyKey:crypto.randomUUID()})
    }).then(async r=>({ok:r.ok,status:r.status,body:await r.json()}))`
  )
  check(result.ok, `${name}: HTTP ${result.status}`)
  return result.body.data?.result ?? result.body.data ?? result.body
}
const state = async (page, expression, message) => {
  const passed = await page.waitFor(expression, 20000)
  if (!passed) {
    report.failurePage = await page.evaluate(
      `({url:location.href,text:document.body.innerText.slice(0,2000)})`
    )
    await page.screenshot(join(output, "failure.png"))
  }
  check(passed, message)
}
const compare = async (page, layout) => {
  await page.evaluate(`document.fonts.ready`)
  await page.sleep(400)
  const measured = await page.evaluate(
    probeSource({
      mode: "app",
      pane: PANE,
      texts: layout.texts,
      tokens: TEXT_TOKENS,
    })
  )
  const { mismatches } = comparePenLayout({
    layout,
    measured: measured.measured,
    tokens: measured.tokens,
    extras: measured.extras,
    exceptions: CV_EXCEPTIONS,
  })
  report.frames.push({
    frameId: layout.frameId,
    mismatches,
  })
  const layoutOk = mismatches.length === 0
  if (!layoutOk) report.layoutFailed = true
  report.checks.push({
    pass: layoutOk,
    message:
      `${layout.frameId}: pen layout, ${mismatches.length} mismatches` +
      mismatches
        .slice(0, 40)
        .map((item) => `\n  ${formatMismatch(layout, item)}`)
        .join(""),
  })
}

try {
  const page = await browser.openPage({
    intercept: false,
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  await page.goto(web)
  await signInThrowaway({
    page,
    apiUrl: api,
    logPath: log,
    name: "Linh Nguyen",
    prefix: "cv-editor",
  })
  const doc = await command(page, "paper.create", {
    kind: "cv",
    name: "New CV",
  })
  check(Boolean(doc.id), "paper.create returned a CV id")
  await page.goto(`${web}/paper/${doc.id}`)
  await state(
    page,
    `!!document.querySelector(${JSON.stringify(PANE)})`,
    "1440: the CV editor is mounted"
  )
  await state(
    page,
    `!!document.querySelector('[aria-label="Full name"]')`,
    "1440: the blank CV shows the name field"
  )
  await state(
    page,
    `document.body.innerText.includes("Edited just now")`,
    "1440: the blank CV reads Edited just now"
  )
  await compare(page, blank)

  const typed = await page.evaluate(`(() => {
    const setField = (label, value) => {
      const field = [...document.querySelectorAll("input")].find(
        (el) => el.getAttribute("aria-label") === label
      )
      if (!field) return false
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value)
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }))
      return true
    }
    const button = [...document.querySelectorAll(${JSON.stringify(PANE)} + " button")].find(
      (el) => el.textContent.trim() === "Role, company"
    )
    if (button) button.click()
    return {
      name: setField("Full name", "Linh Nguyen"),
      email: setField("Email", "linh.nguyen@gmail.com"),
      phone: setField("Phone", "090 123 4567"),
      city: setField("City", "Ho Chi Minh City"),
      added: Boolean(button),
    }
  })()`)
  check(
    typed.name && typed.email && typed.phone && typed.city && typed.added,
    "1440: header fields typed and the experience row added"
  )
  await state(
    page,
    `!!document.querySelector('[aria-label="Role"]')`,
    "1440: the experience row has Role"
  )
  const row = await page.evaluate(`(() => {
    const setField = (label, value) => {
      const field = [...document.querySelectorAll("input")].find(
        (el) => el.getAttribute("aria-label") === label
      )
      if (!field) return false
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value)
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }))
      return true
    }
    return {
      role: setField("Role", "Marketing Intern"),
      company: setField("Company", "Lumière"),
      dates: setField("Dates", "Jun 2025 to now"),
    }
  })()`)
  check(
    row.role && row.company && row.dates,
    "1440: role, company and dates typed"
  )
  await page.evaluate(`document.querySelector('[aria-label="Dates"]')?.focus()`)
  await page.key("Enter")
  await state(
    page,
    `!!document.querySelector(${JSON.stringify(PANE)} + ' .bn-inline-content')`,
    "1440: the first bullet is open"
  )
  await page.insertText(
    "Ran 12 social campaigns and grew followers by 38% in four months."
  )
  await page.key("Enter")
  await page.insertText("Wrote weekly TikTok scripts; three passed 100k views.")
  await page.sleep(500)
  await compare(page, editing)
  await page.close()

  const phone = await browser.openPage({
    intercept: false,
    width: 390,
    height: 844,
    mobile: true,
    reducedMotion: true,
  })
  await phone.goto(`${web}/paper/${doc.id}`)
  await state(
    phone,
    `!!document.querySelector('[aria-label="Full name"]')`,
    "390: the CV editor shows the name field"
  )
  const short = await phone.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(PANE)})
    return [...root.querySelectorAll("button, input")].flatMap((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return []
      const name = el.getAttribute("aria-label") || el.textContent.trim().slice(0, 40)
      if (rect.height >= 44) return []
      return [{ name, width: rect.width, height: rect.height }]
    })
  })()`)
  report.shortTargets = short
  check(
    short.length === 0,
    `390: phone hit areas are at least 44px` +
      short
        .slice(0, 12)
        .map((item) => `\n  ${item.name} ${item.width}x${item.height}`)
        .join("")
  )
  await phone.close()
  check(!report.layoutFailed, "pen layouts match")
  report.status = "PASS"
} catch (error) {
  report.status = "FAIL"
  report.error = error.stack ?? String(error)
  process.exitCode = 1
} finally {
  report.finishedAt = new Date().toISOString()
  writeFileSync(
    join(output, "cv-editor.json"),
    JSON.stringify(report, null, 2) + "\n"
  )
  await browser.quit()
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      failed: report.checks.filter((item) => !item.pass),
      frames: report.frames.map((frame) => ({
        frameId: frame.frameId,
        mismatches: frame.mismatches.length,
      })),
      error: report.error?.split("\n")[0],
      evidence: join(output, "cv-editor.json"),
    })
  )
}
