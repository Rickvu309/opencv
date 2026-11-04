import {
  API,
  JOBS_PATH,
  PATHS,
  SEL,
  TOURED,
  apiMatches,
  commandPath,
} from "./assumes.mjs"
import { colorsSource } from "./probe-colors.mjs"
import { probeSource } from "./probe.mjs"
import { signInThrowaway } from "./session.mjs"

const CV_NAME = "Live Check CV"
const ROUTES = {
  coach: [PATHS.coach, "document.querySelector('h1')"],
  paper: [
    PATHS.paper,
    `document.body.innerText.includes(${JSON.stringify(CV_NAME)})`,
  ],
  apply: [PATHS.apply, `document.querySelector(${JSON.stringify(SEL.card)})`],
  pitch: [PATHS.pitch, "document.querySelector('h1')"],
  inbox: [PATHS.inbox, "document.querySelector('h1')"],
}
const EMPTY_BOARD = "document.body.innerText.includes('Track your first job')"
const must = (ok, what) => {
  if (!ok) throw new Error(`tour step did not happen: ${what}`)
}
async function openDockCoach(page) {
  const already = await page.evaluate(
    "Boolean(document.querySelector('textarea'))"
  )
  if (already) return
  must(
    await clickByText(page, "button", "Coach"),
    "the dock Coach button was not found"
  )
  must(
    await page.waitFor("document.querySelector('textarea')", 6000),
    "the dock Coach panel did not open"
  )
}
const clickByText = (page, selector, text) =>
  page.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => {
      const r = n.getBoundingClientRect()
      return r.width > 0 && ((n.getAttribute('aria-label') || n.textContent).trim() === ${JSON.stringify(text)} || (${JSON.stringify(text)}.length > 12 && n.textContent.includes(${JSON.stringify(text)})))
    })
    if (e) e.click()
    return Boolean(e)
  })()`)
const typeInto = (page, text) =>
  page.evaluate(`(() => {
    const t = [...document.querySelectorAll('textarea')].find((n) => n.getBoundingClientRect().width > 0)
    t.focus()
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(text)})
    t.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)

async function tabWalk(page) {
  await page.evaluate("document.activeElement && document.activeElement.blur()")
  for (let i = 1; i <= 60; i++) {
    await page.key("Tab")
    const hit = await page.evaluate(`(() => {
      const a = document.activeElement
      const l = (a.getAttribute('aria-label') || a.placeholder || a.textContent || '').trim()
      return { label: l, primary: Boolean(a.closest(${JSON.stringify(SEL.primary)})) }
    })()`)
    if (hit.primary) return { reached: i, label: hit.label.slice(0, 30) }
  }
  return { reached: null }
}

export async function runTour({ browser, webUrl, apiUrl, logPath, shots }) {
  const d = { timing: {}, tabs: {}, logs: [] }
  const shot = (page, name) =>
    shots ? page.screenshot(`${shots}/${name}.png`, false) : null
  const snap = async (page) => ({
    ...(await page.evaluate(probeSource)),
    ...(await page.evaluate(colorsSource)),
  })
  const send = async (page, text) => {
    must(
      await page.waitFor("document.querySelector('textarea')", 15000),
      "the composer did not render"
    )
    await typeInto(page, text)
    await page.sleep(300)
    must(
      await clickByText(page, "button", "Send"),
      "the Send button was not found"
    )
  }

  const a = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: false,
  })
  await signInThrowaway({
    page: a,
    webUrl,
    apiUrl,
    logPath,
    name: "Live Check",
    prefix: "tour",
  })
  const prepared = await a.evaluate(`(async () => {
    const post = (path, body) => fetch(${JSON.stringify(apiUrl)} + path, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const createdRes = await post(${JSON.stringify(commandPath("paper.create"))}, {
      kind: 'cv',
      templateId: 'simple',
      name: ${JSON.stringify(CV_NAME)},
    })
    const createdBody = await createdRes.json()
    const paper = createdBody && createdBody.data
    const replaced = paper && paper.id
      ? await post(${JSON.stringify(commandPath("paper.edit"))}, {
          docId: paper.id,
          basedOn: paper.contentVersion,
          edits: [{ op: 'setHeader', fields: { name: 'Live Check', email: 'tour@verify.local' } }],
        })
      : { ok: false }
    const card = await post(${JSON.stringify(commandPath("job.create"))}, {
      title: 'Associate PM intern',
      company: 'Local startup',
      stage: 'interview',
    })
    return { cv: Boolean(createdRes.ok && replaced.ok), card: card.ok }
  })()`)
  must(
    prepared.cv === true && prepared.card === true,
    `creating the tour CV and card failed (${JSON.stringify(prepared)})`
  )
  await a.goto(`${webUrl}${PATHS.coach}`)
  must(
    await a.waitFor("document.querySelector('textarea')", 20000),
    "welcome did not finish"
  )

  const visit = async (key) => {
    const [path, ready] = ROUTES[key]
    const t0 = Date.now()
    await a.goto(`${webUrl}${path}`)
    const ok = await a.waitFor(ready, 20000)
    d.timing[key] = ok ? Date.now() - t0 : null
    return ok
  }
  for (const key of Object.keys(ROUTES)) await visit(key)

  for (const key of TOURED) {
    must(await visit(key), `${key} did not render at ${ROUTES[key][0]}`)
    d.tabs[key] = await tabWalk(a)
    await a.sleep(1200)
    if (key === "coach") {
      const hasComposer = await a.evaluate(
        "Boolean(document.querySelector('textarea'))"
      )
      if (!hasComposer) await openDockCoach(a)
    }
    d[key] = await snap(a)
    await shot(a, `desktop-${key}`)
    if (key === "coach") {
      await a.key("k", { ctrl: true })
      must(
        await a.waitFor("document.querySelector('[role=dialog]')", 4000),
        "Ctrl-K did not open a dialog"
      )
      await a.sleep(500)
      d.palette = await snap(a)
      await a.key("Escape")
      await a.sleep(300)
      await send(a, "Review my CV")
      must(
        await a.waitFor(
          "document.body.innerText.includes('Listed your')",
          10000
        ),
        "the scripted Coach turn did not finish"
      )
      await a.sleep(800)
      d.thread = await snap(a)
      await shot(a, "desktop-thread")
    }
    if (key === "paper") {
      must(
        await clickByText(a, "button", CV_NAME),
        "the created CV card was not found"
      )
      must(
        await a.waitFor(
          `document.querySelector(${JSON.stringify(SEL.paperEditor)})`,
          10000
        ),
        "the CV did not open"
      )
      await a.sleep(1500)
      d.cv = await snap(a)
      await shot(a, "desktop-paper-cv")
      must(
        await clickByText(a, "button", "Coach"),
        "the Coach button was not found"
      )
      must(
        await a.waitFor("document.querySelector('textarea')", 6000),
        "the Coach panel did not open"
      )
      await a.sleep(1200)
      d.cvCoach = await snap(a)
      await shot(a, "desktop-paper-cv-coach")
    }
    if (key === "pitch") {
      d.pitchEdit = d.pitch
      d.pitchStory = d.pitch
    }
  }
  must(await visit("inbox"), "inbox did not render")
  await a.sleep(1200)
  d.inbox = await snap(a)
  await shot(a, "desktop-inbox")
  await a.goto(`${webUrl}${PATHS.settings}`)
  must(
    await a.waitFor("document.body.innerText.includes('Preferences')", 20000),
    "settings did not render"
  )
  await a.sleep(1200)
  d.settings = await snap(a)
  await shot(a, "desktop-settings")
  d.logs.push(...a.logs.splice(0))
  await a.close()

  const b = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: false,
  })
  b.setIntercept((r) => (apiMatches(r, API.paperList) ? "hold" : null))
  await b.goto(`${webUrl}${PATHS.paper}`)
  await b.sleep(2500)
  d.paperLoading = await snap(b)
  d.paperLoading.stubHits = b.interceptHits()
  b.setIntercept(null)
  await b.release()

  b.setIntercept((r) =>
    apiMatches(r, API.paperList)
      ? { status: 200, body: { ok: true, data: [] } }
      : null
  )
  await b.goto(`${webUrl}${PATHS.paper}`)
  await b.waitFor("document.body.innerText.includes('Start a document')", 10000)
  await b.sleep(800)
  d.paperEmpty = await snap(b)
  d.paperEmpty.stubHits = b.interceptHits()
  b.setIntercept(null)

  const coachCall = (r) => apiMatches(r, API.coachTurn)
  b.setIntercept((r) =>
    coachCall(r)
      ? {
          status: 404,
          body: {
            ok: false,
            error: { code: "USER_NOT_FOUND", message: "User not found." },
          },
        }
      : null
  )
  await b.goto(`${webUrl}${PATHS.coach}`)
  must(
    await b.waitFor("document.querySelector('textarea')", 15000),
    "the start page did not render"
  )
  await send(b, "hello")
  await b.waitFor("document.querySelector('[role=alert]')", 8000)
  await b.sleep(800)
  d.coachError = await snap(b)
  d.coachError.stubHits = b.interceptHits()
  await shot(b, "desktop-coach-error")

  b.setIntercept((r) => (coachCall(r) ? "fail" : null))
  await b.goto(`${webUrl}${PATHS.coach}`)
  must(
    await b.waitFor("document.querySelector('textarea')", 15000),
    "the start page did not render"
  )
  await send(b, "hello again")
  await b.waitFor("document.querySelector('[role=alert]')", 8000)
  await b.sleep(800)
  d.coachNet = await snap(b)
  d.coachNet.stubHits = b.interceptHits()
  b.setIntercept(null)
  await b.close()

  const r = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  d.reduced = {}
  for (const key of Object.keys(ROUTES)) {
    await r.goto(`${webUrl}${ROUTES[key][0]}`)
    must(
      await r.waitFor(ROUTES[key][1], 20000),
      `${key} did not render (reduced motion)`
    )
    await r.sleep(1200)
    d.reduced[key] = await snap(r)
  }
  await r.goto(`${webUrl}${PATHS.settings}`)
  must(
    await r.waitFor("document.body.innerText.includes('Preferences')", 20000),
    "settings did not render (reduced motion)"
  )
  await r.sleep(1200)
  d.settingsReduced = await snap(r)
  d.logs.push(...r.logs.splice(0))
  await r.close()

  const m = await browser.openPage({
    width: 390,
    height: 844,
    mobile: true,
    reducedMotion: false,
  })
  d.mobile = {}
  for (const key of Object.keys(ROUTES)) {
    await m.goto(`${webUrl}${ROUTES[key][0]}`)
    must(
      await m.waitFor(ROUTES[key][1], 20000),
      `${key} did not render at 390px`
    )
    await m.sleep(400)
    must(
      await clickByText(m, "button", "Menu"),
      `${key} Menu was not found at 390px`
    )
    must(
      await m.waitFor("document.querySelector('[role=dialog]')", 4000),
      `${key} drawer did not open`
    )
    await m.sleep(400)
    d.mobile[key] = await snap(m)
    await shot(m, `mobile-${key}`)
  }
  await m.goto(`${webUrl}${PATHS.settings}`)
  must(
    await m.waitFor("document.body.innerText.includes('Preferences')", 20000),
    "settings did not render at 390px"
  )
  await m.sleep(1200)
  d.settingsMobile = await snap(m)
  await shot(m, "mobile-settings")
  d.logs.push(...m.logs.splice(0))
  await m.close()

  const lastPageDeletesTheTourCard = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: false,
  })
  await lastPageDeletesTheTourCard.goto(`${webUrl}${PATHS.apply}`)
  must(
    await lastPageDeletesTheTourCard.waitFor(
      `document.querySelector(${JSON.stringify(SEL.card)})`,
      15000
    ),
    "the created board did not render"
  )
  const deleted = await lastPageDeletesTheTourCard.evaluate(`(async () => {
    const o = { credentials: 'include' }
    const list = await (await fetch(${JSON.stringify(`${apiUrl}${JOBS_PATH}`)}, o)).json()
    let n = 0
    for (const c of list.data ?? []) {
      const res = await fetch(${JSON.stringify(`${apiUrl}${commandPath("job.delete")}`)}, { ...o, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobId: c.id }) })
      if (res.ok) n++
    }
    return { total: list.data.length, deleted: n }
  })()`)
  must(
    deleted.total > 0 && deleted.deleted === deleted.total,
    `deleting the created cards (${JSON.stringify(deleted)})`
  )
  await lastPageDeletesTheTourCard.goto(`${webUrl}${PATHS.apply}`)
  await lastPageDeletesTheTourCard.waitFor(EMPTY_BOARD, 15000)
  await lastPageDeletesTheTourCard.sleep(1000)
  d.applyEmpty = await snap(lastPageDeletesTheTourCard)
  d.applyEmpty.deleted = deleted
  await shot(lastPageDeletesTheTourCard, "desktop-apply-empty")
  await lastPageDeletesTheTourCard.close()
  return d
}
