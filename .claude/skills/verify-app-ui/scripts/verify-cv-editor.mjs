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
import { measureFilledCv } from "./verify-cv-editor-frames.mjs"

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
const slash = JSON.parse(
  readFileSync(join(design, "cv-slash.layout.json"), "utf8")
)
const blockMenu = JSON.parse(
  readFileSync(join(design, "cv-block-menu.layout.json"), "utf8")
)
const drag = JSON.parse(
  readFileSync(join(design, "cv-drag.layout.json"), "utf8")
)
const PANE = '[data-slot="cv-editor-page"]'
const UNTIL = "2026-12-03"
const ISSUE = "#1063"
const faint = (frameId, text) => ({
  frameId,
  text,
  property: "color",
  reason:
    "the pen gray is below WCAG AA, and the contrast gate rejects an exact match while no darker gray stays inside the contrast floor",
  until: UNTIL,
  approvedBy: ISSUE,
})
const kept = (frameId, text) => ({
  frameId,
  text,
  property: "extra",
  reason: "kept toolbar control the pen frame does not draw",
  until: UNTIL,
  approvedBy: ISSUE,
})
const CV_EXCEPTIONS = [
  ...[
    "Email",
    "|",
    "Phone",
    "City",
    "LinkedIn",
    "Role, company",
    "Dates",
    "•",
    "What you did, and what changed because of it",
    "School, degree",
    "Tools, software and languages",
  ].map((text) => faint("L3V6y", text)),
  ...[
    "Email",
    "|",
    "Phone",
    "City",
    "LinkedIn",
    "Role, company",
    "Dates",
    "•",
    "What you did, and what changed because of it",
    "School, degree",
    "Tools, software and languages",
    "CV sections",
    "2 to 3 lines",
    "Things you built",
    "Clubs, volunteering",
    "Prizes, scholarships",
    "With level",
    "Type to filter",
    "Blocks",
    "⌘",
    "⌥",
    "1",
    "⇧",
    "8",
    "9",
  ].map((text) => faint("pCOLZ", text)),
  ...[
    "|",
    "Jun 2025 to now",
    "School, degree",
    "Years",
    "Tools, software and languages",
  ].map((text) => faint("TtBmY", text)),
  ...["|", "Jun 2025 to now", "2024 to 2025", "2022 to 2026"].flatMap((text) =>
    ["F0BP4A", "mOKD3"].map((frameId) => faint(frameId, text))
  ),
  ...["⌘ D", "⌘ ⇧ ↑", "⌘ ⇧ ↓", "Del"].map((text) => faint("F0BP4A", text)),
  ...["L3V6y", "pCOLZ", "F0BP4A", "mOKD3"].flatMap((frameId) =>
    ["Undo", "Download PDF", "Coach"].map((text) => kept(frameId, text))
  ),
  ...["TtBmY"].flatMap((frameId) =>
    ["Undo", "Download PDF", "Coach"].map((text) => kept(frameId, text))
  ),
]

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
const compare = async (page, layout, include = []) => {
  await page.evaluate(`document.fonts.ready`)
  await page.sleep(400)
  const probe = probeSource({
    mode: "app",
    pane: PANE,
    texts: layout.texts,
    tokens: TEXT_TOKENS,
    include,
  })
  const measured = await page.evaluate(`(() => {
    return ${probe}
  })()`)
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

  await measureFilledCv({
    page,
    browser,
    web,
    doc,
    output,
    check,
    state,
    compare,
    slash,
    editing,
    blockMenu,
    drag,
    report,
    PANE,
  })
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
