#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { createConnection } from "node:net"

import {
  faintPenColour,
  LAYOUT_EXCEPTIONS,
  MARKS_NOT_DRAWN,
  NOT_SHOWN,
} from "./lib/apply-pen-gaps.mjs"
import { HELPERS } from "./lib/apply-pen-page.mjs"
import { must, seed } from "./lib/apply-pen-seed.mjs"
import { signInThrowaway } from "./lib/session.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import { repo } from "./lib/check-util.mjs"
import { comparePen, penProbeSource, stylesPath } from "./lib/pen-parity.mjs"
import {
  colorMatches,
  comparePenLayout,
  formatMismatch,
  TEXT_TOKENS,
} from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"
import { startStack, stopStack } from "./lib/stack.mjs"

const base = Number(process.env.PORT ?? 4454)
const shots = process.env.VERIFY_APP_UI_SHOTS
if (shots) mkdirSync(shots, { recursive: true })

const taken = (port) =>
  new Promise((done) => {
    const socket = createConnection({ port, host: "127.0.0.1" })
    socket.on("connect", () => (socket.destroy(), done(true)))
    socket.on("error", () => done(false))
  })

const LINK = "topcv.vn/viec-lam/junior-marketing-lumiere"
const DESCRIPTION =
  "Plan and run social campaigns for three skincare brands. Write short posts and TikTok scripts, and report weekly reach."
const MAIN = "#app-main"
const DIALOG = "[role=dialog],[role=alertdialog]"

async function main() {
  for (const port of [base, base + 1])
    if (await taken(port))
      throw new Error(`port ${port} is in use; pick another PORT`)
  const run = `apply-pen-${process.pid}`
  const stack = startStack({ apiPort: base, webPort: base + 1, run })
  const browser = await launchBrowser()
  const results = []
  try {
    const page = await browser.openPage({
      width: 1440,
      height: 900,
      mobile: false,
      reducedMotion: true,
      timezone: "Asia/Ho_Chi_Minh",
      now: "2026-10-25T09:00:00+07:00",
    })
    const web = stack.webUrl
    const ui = (expression) => page.evaluate(`${HELPERS}; ${expression}`)
    const open = async (path, ready) => {
      await page.goto(`${web}${path}`)
      must(await page.waitFor(ready, 90000), `${path} rendered`)
      await page.sleep(500)
    }
    const step = async (expression, what) => {
      must(await ui(expression), what)
      await page.sleep(400)
    }
    const openNewJob = async () => {
      await open(
        "/apply",
        "document.querySelector('[data-slot=board-lane], h2')"
      )
      await step(`__pen.click("New job")`, "open New job")
      must(
        await page.waitFor("document.querySelector('[role=dialog]')"),
        "New job dialog"
      )
    }
    const typeLink = async (url) => {
      await step(
        `__pen.set("Paste the job link", ${JSON.stringify(url)})`,
        "type the link"
      )
      await step(`__pen.blur("Paste the job link")`, "leave the link")
      await page.sleep(2500)
    }
    const fillRole = async (company) => {
      await step(
        `__pen.set("Role title", "Junior Marketing")`,
        "type the title"
      )
      await step(
        `__pen.set("Company", ${JSON.stringify(company)})`,
        "type the company"
      )
    }
    const setDeadline = async () => {
      await step(`__pen.click(/^Deadline/)`, "open Deadline")
      await step(`__pen.set("Deadline", "2026-11-15")`, "set the deadline")
      await page.key("Escape")
      await page.sleep(300)
    }
    const setLocation = async (value) => {
      if (!(await ui(`__pen.click(/^(Location|Hanoi|HCMC)/)`))) return
      await page.sleep(300)
      await step(
        `__pen.set("Location", ${JSON.stringify(value)})`,
        "set the location"
      )
      await page.key("Escape")
      await page.sleep(300)
    }

    const capture = async (slug, root, prepare, release) => {
      await prepare()
      if (shots) await page.screenshot(`${shots}/${slug}.png`, false)
      const measured = await page.evaluate(penProbeSource(root))
      must(measured, `${slug}: ${root} on the page`)
      const notShown = NOT_SHOWN[slug] ?? {}
      const layoutFile = stylesPath(repo, "apply", slug).replace(
        /\.styles\.json$/,
        ".layout.json"
      )
      const result = comparePen(stylesPath(repo, "apply", slug), measured, {
        notShown,
        marksNotDrawn: MARKS_NOT_DRAWN[slug] ?? 0,
        penLayoutAaRuleOwnsColour: existsSync(layoutFile),
      })
      if (existsSync(layoutFile)) {
        const full = JSON.parse(readFileSync(layoutFile, "utf8"))
        const layout = {
          ...full,
          texts: full.texts.filter((text) => !(text.text in notShown)),
          boxes: [
            ...(full.boxes ?? []),
            ...full.texts.filter((text) => text.text in notShown),
          ],
        }
        const [first, ...include] = root.split(",")
        const pane = first === MAIN ? `[data-slot="app-shell"] ${MAIN}` : first
        const box = await page.evaluate(
          probeSource({
            mode: "app",
            pane,
            include,
            texts: layout.texts,
            tokens: TEXT_TOKENS,
          })
        )
        must(!box.error, `${slug}: ${box.error}`)
        const { mismatches } = comparePenLayout({
          layout,
          measured: box.measured,
          tokens: box.tokens,
          extras: box.extras,
          exceptions: LAYOUT_EXCEPTIONS,
        })
        const everyColourMissIsFaintPenGrey = (text) =>
          layout.texts.every((want, index) => {
            const got = box.measured[index]
            if (want.text !== text || !got) return true
            return (
              colorMatches(want, got, box.tokens) || faintPenColour(want, got)
            )
          })
        const kept = mismatches.filter(
          (m) =>
            m.property !== "color" || !everyColourMissIsFaintPenGrey(m.text)
        )
        result.failures.push(...kept.map((m) => formatMismatch(layout, m)))
        result.layout = layout.texts.length
      }
      results.push({ slug, ...result })
      if (release) await release()
    }

    await page.goto(`${web}/sign-in`)
    await signInThrowaway({
      page,
      apiUrl: stack.apiUrl,
      logPath: stack.logPath,
      name: "Linh Nguyen",
      prefix: "apply-pen",
    })
    await capture("w9-1-board-empty", MAIN, () =>
      open("/apply", "document.body.innerText.includes('Track your first job')")
    )
    const ids = await seed(page, stack.apiUrl)
    const apm = ids["Associate PM intern"]
    const lanes = "document.querySelector('[data-slot=board-lane]')"
    await capture("w9-3-board", MAIN, () => open("/apply", lanes))
    await capture(
      "w9-6-drag-to-stage",
      `${MAIN},[data-slot=kanban-overlay]`,
      async () => {
        await open("/apply", lanes)
        const spot = await page.evaluate(`(() => {
          const card = [...document.querySelectorAll("[data-slot=kanban-card]")].find((n) => n.textContent.includes("Business analyst intern"))
          const pane = document.querySelector("#app-main").getBoundingClientRect()
          const r = card.getBoundingClientRect()
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, dx: r.width / 2, dy: r.height / 2, left: pane.left, top: pane.top }
        })()`)
        const frameDropInBoard = { x: 536, y: 322 }
        const headerPx = 52
        const toolbarPx = 44
        const to = {
          x: spot.left + frameDropInBoard.x + spot.dx,
          y: spot.top + frameDropInBoard.y + headerPx + toolbarPx + spot.dy,
        }
        await page.mouse("mousePressed", spot.x, spot.y)
        for (let step = 1; step <= 12; step += 1)
          await page.mouse(
            "mouseMoved",
            spot.x + ((to.x - spot.x) * step) / 12,
            spot.y + ((to.y - spot.y) * step) / 12
          )
        await page.sleep(500)
        must(
          await ui(
            `Boolean(document.querySelector("[data-slot=kanban-overlay] [data-slot=card], [data-slot=kanban-overlay] *"))`
          ),
          "the lifted card"
        )
        must(
          await ui(
            `Boolean([...document.querySelectorAll("[data-slot=drop-line]")].length)`
          ),
          "the drop line"
        )
      },
      async () => {
        await page.key("Escape")
        await page.mouse("mouseReleased", 0, 0)
      }
    )
    await capture("w9-4-list", MAIN, () =>
      open(
        "/apply?view=list",
        "document.body.innerText.includes('Product analyst intern')"
      )
    )
    await capture("w9-7-calendar-month", MAIN, () =>
      open(
        "/apply?view=calendar&span=month",
        "document.body.innerText.includes('October 2026')"
      )
    )
    await capture("w9-8-calendar-week", MAIN, async () => {
      await open(
        "/apply?view=calendar&span=week",
        "document.body.innerText.includes('2026')"
      )
      const week = `[...document.querySelectorAll("#app-main h2")].some((h) => h.textContent.trim() === "November 2026")`
      for (let i = 0; i < 4 && !(await ui(week)); i += 1)
        await step(`__pen.click("Next week")`, "go to the next week")
      must(await ui(week), "the week of 2 November")
    })
    await capture("w9-5-filters-no-results", MAIN, async () => {
      await open("/apply", lanes)
      await step(`__pen.click("Filter")`, "open Filter")
      await step(`__pen.set("Company", "Regional bank")`, "filter by company")
      await step(`__pen.set("Location", "Hanoi")`, "filter by location")
      await page.key("Escape")
      must(
        await page.waitFor(
          `document.body.innerText.includes('No jobs match these filters')`
        ),
        "no results"
      )
    })
    await capture("w9-2-new-job", DIALOG, openNewJob)
    await capture("w10-1-filled-in", DIALOG, async () => {
      await openNewJob()
      await typeLink(LINK)
      await fillRole("Lumière Cosmetics")
      await step(
        `__pen.set("Add the job description", ${JSON.stringify(`${DESCRIPTION} Vietnamese and English.`)})`,
        "type the description"
      )
      await setDeadline()
      await setLocation("HCMC")
    })
    await capture("w10-2-company-missing", DIALOG, async () => {
      await openNewJob()
      await typeLink(LINK)
      await fillRole("")
      await step(
        `__pen.set("Add the job description", ${JSON.stringify(DESCRIPTION)})`,
        "type the description"
      )
      await setDeadline()
      await setLocation("")
      await step(`__pen.click("Add job")`, "press Add job")
      must(
        await page.waitFor(
          `document.body.innerText.includes('Add the company name to save this job.')`
        ),
        "company hint"
      )
    })
    await capture("w10-3-already-on-board", DIALOG, async () => {
      await openNewJob()
      await typeLink("https://itviec.com/it-jobs/apm-intern")
      must(await ui(`__pen.has("Already on your board")`), "duplicate row")
    })
    const detail = (id) =>
      open(`/apply/${id}`, "document.body.innerText.includes('Properties')")
    await capture("w10-4-job-detail", MAIN, () => detail(apm))
    await capture(
      "w10-5-link-from-paper",
      `${MAIN},[data-slot=popover-content]`,
      async () => {
        await detail(apm)
        await step(
          `__pen.click("Add cover letter")`,
          "open the cover letter picker"
        )
        must(
          await page.waitFor(
            `document.body.innerText.includes('Cover letter, Lumière')`
          ),
          "the letters"
        )
      }
    )
    await capture("w10-6-closed-job", MAIN, () => detail(ids["Content intern"]))
    await capture("w10-7-delete-job", DIALOG, async () => {
      await detail(apm)
      await step(`__pen.click("More")`, "open More")
      await step(`__pen.click("Delete job", "menuitem")`, "choose Delete job")
      must(
        await page.waitFor(
          "document.querySelector('[role=dialog],[role=alertdialog]')"
        ),
        "delete dialog"
      )
    })
  } finally {
    await browser.quit()
    stopStack(run)
  }
  return results
}

let exit = 0
try {
  const results = await main()
  for (const r of results) {
    const pass = r.failures.length === 0
    if (!pass) exit = 1
    if (process.env.VERIFY_APPLY_PEN_ALL)
      for (const line of r.failures) console.log(`  ${r.slug} ${line}`)
    console.log(
      `${pass ? "PASS" : "FAIL"} ${r.slug}: ${r.compared}/${r.texts} texts, ${r.marks - r.missingMarks}/${r.marks} marks${pass ? "" : `; ${r.failures.slice(0, 3).join("; ").slice(0, 400)}`}`
    )
  }
  const failed = results.filter((r) => r.failures.length).length
  console.log(`${results.length - failed} PASS, ${failed} FAIL`)
} catch (error) {
  console.error(`verify-apply-pen error: ${error.message}`)
  exit = 2
}
process.exit(exit)
