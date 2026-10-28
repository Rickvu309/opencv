#!/usr/bin/env node
// verify-apply-pen: measures every Apply state against its opencv.pen frame (W9.1 to W10.7) in
// headless Chromium at 1440x900, with the frame's clock (Sunday 25 October 2026, 09:00) and zone
// (Asia/Ho_Chi_Minh).
//   pnpm --filter web verify:apply-pen          (api on PORT, web on PORT+1; 4454 and 4455 by default)
//   VERIFY_APP_UI_SHOTS=<dir> also writes one screenshot per state.
// Signs up Linh Nguyen on a fresh PGlite stack, saves the frames' jobs through the api, opens each
// state, and compares each pen text's colour, size, weight, line height and tracking, plus the
// size of each drawn icon, with apps/web/src/features/apply/design/<slug>.styles.json.
// Exit 1 when a state fails, 2 when the stack, browser or a state did not work.
import { mkdirSync, readFileSync } from "node:fs"
import { createConnection } from "node:net"

import { launchBrowser } from "./lib/cdp.mjs"
import { repo } from "./lib/check-util.mjs"
import { comparePen, penProbeSource, stylesPath } from "./lib/pen-parity.mjs"
import { startStack, stopStack } from "./lib/stack.mjs"

const base = Number(process.env.PORT ?? 4454)
const shots = process.env.VERIFY_APP_UI_SHOTS
if (shots) mkdirSync(shots, { recursive: true })

// Texts the live stack cannot draw, with the reason. Dates a frame draws from a job's created or
// updated time come from the server clock, which the check cannot move; the unit test
// apply-design-parity.test.tsx checks those with fixed data.
const SERVER_DATES = "server time, checked by apply-design-parity.test.tsx"
const NOT_SHOWN = {
  "w9-3-board": dates(["Oct 25", "Oct 22", "Oct 14", "Oct 21", "Oct 12", "Oct 2"]),
  "w9-4-list": {
    ...dates(["Oct 25", "Oct 22", "Oct 14", "Oct 21", "Oct 12", "Oct 2"]),
    "Saved today": "the frame's JM has no deadline here but one in W9.7",
    "Applied Oct 14": SERVER_DATES,
    "Applied Oct 21": SERVER_DATES,
    "Round 2 on Nov 3": "JobView has no interview round",
  },
  "w9-7-calendar-month": {
    "Content intern": "the Oct 9 closed date is not stored",
    "Business analyst": "applied dates and inbox follow-ups are not stored",
    "Product analyst": "the frame's Oct 19 interview contradicts W9.8",
    "Marketing intern": "the Oct 21 applied date is not stored",
    "10:00 Associate PM": "the chip truncates the full title with an ellipsis",
  },
  "w9-8-calendar-week": {
    "Product analyst": "the block shows the full title",
    "Round 2 interview": "JobView has no interview round",
    "UX research due": "the deadline chip shows the full title",
  },
  "w10-4-job-detail": detailGaps(),
  "w10-5-link-from-paper": {
    ...detailGaps(),
    "Draft, edited Oct 21": SERVER_DATES,
    "Edited Oct 18": SERVER_DATES,
  },
  "w10-6-closed-job": {
    ...dates(["Sep 20", "Oct 6", "Oct 9"]),
    Subscribe: "the product has no activity subscription",
    "Added from TopCV": "the api writes You added this job from topcv.vn",
    "Round 2 interview": "JobView has no interview round",
    "Round 2 on Oct 6": "JobView has no interview round",
  },
}
// Icons a frame draws for data or controls the product does not have.
const MARKS_NOT_DRAWN = {
  "w9-4-list": 6, // company logos; rows show the initials tile
  "w9-7-calendar-month": 2, // the follow-up reply icon and a chip of a date in NOT_SHOWN
  "w10-4-job-detail": 1, // header link, panel and note paperclip buttons have no behavior
  "w10-6-closed-job": 1,
}

function dates(list) {
  return Object.fromEntries(list.map((text) => [text, SERVER_DATES]))
}
function detailGaps() {
  return {
    ...dates(["Oct 10", "Oct 12", "Oct 20", "Oct 21"]),
    Subscribe: "the product has no activity subscription",
    "1 / 7": "the pager counts the board order, which puts this job 5th",
    "You added this job from ITviec":
      "the api writes You added this job from itviec.com",
    "You linked Junior Marketing CV": "job.linkPaper writes no activity row",
    "You moved it to Interview": "the job is saved straight into Interview",
  }
}

const taken = (port) =>
  new Promise((done) => {
    const socket = createConnection({ port, host: "127.0.0.1" })
    socket.on("connect", () => (socket.destroy(), done(true)))
    socket.on("error", () => done(false))
  })
const must = (ok, what) => {
  if (!ok) throw new Error(`step did not happen: ${what}`)
}

// In-page helpers, by accessible name like the unit tests.
const HELPERS = `
  window.__pen = {
    named(name, roles) {
      const wanted = roles.split(",")
      return [...document.querySelectorAll("button,a,[role=button],[role=menuitem],[role=radio],input,textarea")].find((el) => {
        const role = el.getAttribute("role") || (el.tagName === "BUTTON" ? "button" : el.tagName === "A" ? "link" : "textbox")
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim()
        return wanted.includes(role) && el.getBoundingClientRect().width > 0 && (name instanceof RegExp ? name.test(label) : label === name)
      })
    },
    click(name, roles = "button") {
      const el = this.named(name, roles)
      if (el) el.click()
      return Boolean(el)
    },
    set(label, value) {
      const byFor = [...document.querySelectorAll("label")].find((n) => n.textContent.trim() === label && n.htmlFor)
      const el = [...document.querySelectorAll("input,textarea")].find((n) => (n.getAttribute("aria-label") === label || (byFor && n.id === byFor.htmlFor)) && n.getBoundingClientRect().width > 0)
      if (!el) return false
      el.focus()
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value)
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    },
    blur(label) {
      const el = document.querySelector('[aria-label="' + label + '"]')
      if (!el) return false
      el.focus()
      el.blur()
      return true
    },
    has(text) {
      return document.body.textContent.replace(/\s+/g, " ").includes(text)
    },
  }`

async function signUp(page, apiUrl, logPath) {
  const email = `apply-pen-${Date.now()}@verify.local`
  const post = (path, body) =>
    page.evaluate(`fetch(${JSON.stringify(apiUrl + path)}, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: ${JSON.stringify(JSON.stringify(body))},
    }).then((r) => r.status)`)
  must(
    (await post("/api/auth/email-otp/send-verification-otp", {
      email,
      type: "sign-in",
    })) === 200,
    "send the sign-in code"
  )
  let otp = null
  for (let attempt = 0; attempt < 50 && !otp; attempt += 1) {
    const line = readFileSync(logPath, "utf8")
      .split("\n")
      .reverse()
      .map((l) => /\[auth\] email code for (.+) type sign-in: ([0-9]{6})/.exec(l))
      .find((m) => m && m[1] === email)
    otp = line?.[2] ?? null
    if (!otp) await page.sleep(100)
  }
  must(otp, "read the sign-in code from api.log")
  must(
    (await post("/api/auth/sign-in/email-otp", {
      email,
      otp,
      name: "Linh Nguyen",
    })) === 200,
    "sign in"
  )
}

async function command(page, apiUrl, name, input) {
  const body = await page.evaluate(`fetch(${JSON.stringify(`${apiUrl}/api/commands/${name}`)}, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: ${JSON.stringify(input)}, idempotencyKey: crypto.randomUUID() }),
  }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }))`)
  must(body.ok, `${name} returned ${body.status}`)
  return body.body?.data?.result ?? body.body?.data ?? body.body
}

const at = (iso) => new Date(iso).toISOString()
const posting = (about, duties, requirements, details) => ({
  about,
  duties: duties.join("\n"),
  requirements: requirements.join("\n"),
  details: details.join("\n"),
})
const JOBS = [
  ["Junior Marketing", "Lumière Cosmetics", "saved", "HCMC", { deadline: "2026-10-25" }, { priority: "high" }],
  ["UX research intern", "Agency", "saved", "Hanoi", { deadline: "2026-11-08" }, { priority: "normal" }],
  ["Business analyst intern", "Regional bank", "applied", "HCMC", {}, { priority: "high" }],
  ["Marketing intern", "E-commerce co.", "applied", "Remote", {}, { priority: "low" }],
  [
    "Associate PM intern",
    "Local startup",
    "interview",
    "Hanoi",
    { jobUrl: "https://itviec.com/it-jobs/apm-intern", sourceHost: "itviec.com" },
    {
      priority: "high",
      interviewAt: at("2026-10-29T10:00:00+07:00"),
      recruiterName: "Minh Tran",
      posting: posting(
        "Join a 12-person team building a savings app for students. You will own small features from idea to launch.",
        ["Run user interviews and turn notes into clear problems", "Write short specs with two engineers", "Track what changed after each release"],
        ["Final-year student or recent graduate", "Clear writing in English and Vietnamese", "Curious about how people manage money"],
        ["6-month internship, starting January", "Hybrid in Hanoi, 3 days in the office", "Paid, 6 to 8 million VND a month"]
      ),
    },
  ],
  ["Product analyst intern", "E-commerce co.", "interview", "Remote", {}, { priority: "low", interviewAt: at("2026-11-03T14:00:00+07:00") }],
  [
    "Content intern",
    "Agency",
    "closed",
    "Hanoi",
    { jobUrl: "https://topcv.vn/viec-lam/content-intern", sourceHost: "topcv.vn" },
    {
      priority: "low",
      recruiterName: "Lan Pham",
      posting: posting(
        "Write for agency clients in beauty and food, from blog posts to social captions.",
        ["Draft two blog posts a week", "Write captions for client social channels", "Join client calls and take notes"],
        ["Strong writing in Vietnamese", "A few published samples", "Comfortable with short deadlines"],
        ["4-month internship", "On site in Hanoi", "Paid, 5 million VND a month"]
      ),
    },
  ],
]

async function seed(page, apiUrl) {
  const ids = {}
  const run = (name, input) => command(page, apiUrl, name, input)
  for (const [title, company, stage, location, create, patch] of JOBS) {
    const made = await run("job.create", {
      title,
      company,
      location,
      stage: stage === "closed" ? "saved" : stage,
      ...create,
    })
    ids[title] = made.id
    await run("job.update", { jobId: made.id, patch })
    if (stage === "closed") await run("job.move", { jobId: made.id, stage: "closed" })
  }
  const apm = ids["Associate PM intern"]
  const steps = []
  for (const label of ["Read about their savings app", "Practise three PM questions", "Bring the checkout study"])
    steps.push(await run("job.addChecklistItem", { jobId: apm, label }))
  await run("job.setChecklistItem", { jobId: apm, itemId: steps[0].id, done: true })
  const cv = await run("paper.create", { kind: "cv", name: "Junior Marketing CV", jobId: apm })
  await run("job.linkPaper", { jobId: ids["Content intern"], docId: cv.id, kind: "cv" })
  await run("job.addNote", {
    jobId: ids["Content intern"],
    body: "What I learned: the writing test went well. Next time, bring a sharper story with numbers.",
  })
  await run("paper.create", { kind: "letter", name: "Cover letter, Local startup" })
  const ready = await run("paper.create", { kind: "letter", name: "Cover letter, Lumière" })
  await run("paper.setStatus", { docId: ready.id, status: "ready" })
  await run("job.addNote", { jobId: apm, body: "Minh likes concrete numbers. Bring the checkout study." })
  return ids
}

const LINK = "topcv.vn/viec-lam/junior-marketing-lumiere"
const DESCRIPTION =
  "Plan and run social campaigns for three skincare brands. Write short posts and TikTok scripts, and report weekly reach."
const MAIN = "#app-main"
const DIALOG = "[role=dialog],[role=alertdialog]"

async function main() {
  for (const port of [base, base + 1])
    if (await taken(port)) throw new Error(`port ${port} is in use; pick another PORT`)
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
      await open("/apply", "document.querySelector('[data-slot=board-lane], h2')")
      await step(`__pen.click("New job")`, "open New job")
      must(await page.waitFor("document.querySelector('[role=dialog]')"), "New job dialog")
    }
    const typeLink = async (url) => {
      await step(`__pen.set("Paste the job link", ${JSON.stringify(url)})`, "type the link")
      await step(`__pen.blur("Paste the job link")`, "leave the link")
      await page.sleep(2500)
    }
    const fillRole = async (company) => {
      await step(`__pen.set("Role title", "Junior Marketing")`, "type the title")
      await step(`__pen.set("Company", ${JSON.stringify(company)})`, "type the company")
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
      await step(`__pen.set("Location", ${JSON.stringify(value)})`, "set the location")
      await page.key("Escape")
      await page.sleep(300)
    }

    const capture = async (slug, root, prepare) => {
      await prepare()
      if (shots) await page.screenshot(`${shots}/${slug}.png`, false)
      const measured = await page.evaluate(penProbeSource(root))
      must(measured, `${slug}: ${root} on the page`)
      results.push({
        slug,
        ...comparePen(stylesPath(repo, "apply", slug), measured, {
          notShown: NOT_SHOWN[slug] ?? {},
          marksNotDrawn: MARKS_NOT_DRAWN[slug] ?? 0,
        }),
      })
    }

    await page.goto(`${web}/sign-in`)
    await signUp(page, stack.apiUrl, stack.logPath)
    await capture("w9-1-board-empty", MAIN, () =>
      open("/apply", "document.body.innerText.includes('Track your first job')")
    )
    const ids = await seed(page, stack.apiUrl)
    const apm = ids["Associate PM intern"]
    const lanes = "document.querySelector('[data-slot=board-lane]')"
    await capture("w9-3-board", MAIN, () => open("/apply", lanes))
    await capture("w9-4-list", MAIN, () =>
      open("/apply?view=list", "document.body.innerText.includes('Product analyst intern')")
    )
    await capture("w9-7-calendar-month", MAIN, () =>
      open("/apply?view=calendar&span=month", "document.body.innerText.includes('October 2026')")
    )
    await capture("w9-8-calendar-week", MAIN, async () => {
      await open("/apply?view=calendar&span=week", "document.body.innerText.includes('2026')")
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
      must(await page.waitFor(`document.body.innerText.includes('No jobs match these filters')`), "no results")
    })
    await capture("w9-2-new-job", DIALOG, openNewJob)
    await capture("w10-1-filled-in", DIALOG, async () => {
      await openNewJob()
      await typeLink(LINK)
      await fillRole("Lumière Cosmetics")
      await step(`__pen.set("Add the job description", ${JSON.stringify(`${DESCRIPTION} Vietnamese and English.`)})`, "type the description")
      await setDeadline()
      await setLocation("HCMC")
    })
    await capture("w10-2-company-missing", DIALOG, async () => {
      await openNewJob()
      await typeLink(LINK)
      await fillRole("")
      await step(`__pen.set("Add the job description", ${JSON.stringify(DESCRIPTION)})`, "type the description")
      await setDeadline()
      await setLocation("")
      await step(`__pen.click("Add job")`, "press Add job")
      must(await page.waitFor(`document.body.innerText.includes('Add the company name to save this job.')`), "company hint")
    })
    await capture("w10-3-already-on-board", DIALOG, async () => {
      await openNewJob()
      await typeLink("https://itviec.com/it-jobs/apm-intern")
      must(await ui(`__pen.has("Already on your board")`), "duplicate row")
    })
    const detail = (id) => open(`/apply/${id}`, "document.body.innerText.includes('Properties')")
    await capture("w10-4-job-detail", MAIN, () => detail(apm))
    await capture("w10-5-link-from-paper", `${MAIN},[data-slot=popover-content]`, async () => {
      await detail(apm)
      await step(`__pen.click("Add cover letter")`, "open the cover letter picker")
      must(await page.waitFor(`document.body.innerText.includes('Cover letter, Lumière')`), "the letters")
    })
    await capture("w10-6-closed-job", MAIN, () => detail(ids["Content intern"]))
    await capture("w10-7-delete-job", DIALOG, async () => {
      await detail(apm)
      await step(`__pen.click("More")`, "open More")
      await step(`__pen.click("Delete job", "menuitem")`, "choose Delete job")
      must(await page.waitFor("document.querySelector('[role=dialog],[role=alertdialog]')"), "delete dialog")
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
    console.log(
      `${pass ? "PASS" : "FAIL"} ${r.slug}: ${r.compared}/${r.texts} texts, ${r.marks - r.missingMarks}/${r.marks} marks${pass ? "" : `; ${r.failures.slice(0, 3).join("; ").slice(0, 400)}`}`
    )
  }
  const failed = results.filter((r) => r.failures.length).length
  console.log(`${results.length - failed} PASS, ${failed} FAIL (W9.6 Drag to stage is checked by apply-design-parity.test.tsx)`)
} catch (error) {
  console.error(`verify-apply-pen error: ${error.message}`)
  exit = 2
}
process.exit(exit)
