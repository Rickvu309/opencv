// Drives one signed-in tour and returns raw measurements. It decides nothing.
// Sign-up no longer seeds a workspace, so the tour creates one CV and one Apply card.
// A step that does not happen throws (exit 2); it is never counted as a pass.
import { colorsSource } from "./probe-colors.mjs"
import { probeSource } from "./probe.mjs"

const CV_NAME = "Live Check CV"
const ROUTES = {
  home: ["/app", "document.querySelector('h1')"],
  paper: [
    "/app/paper",
    `document.body.innerText.includes(${JSON.stringify(CV_NAME)})`,
  ],
  apply: ["/app/apply", "document.querySelector('[data-card-id]')"],
  pitch: ["/app/pitch", "document.querySelector('h1')"],
}
// Also listed under "Constants the checks assume" in SKILL.md.
const PRIMARY = {
  home: /Message Coach|^Send$/,
  paper: /^(New|Make mine)$/,
  apply: /^Add /,
  pitch: /^(Edit|Publish)/,
}
const STAGES =
  "['Inbox','Prep','Sent','Live','Closed'].every((w) => new RegExp('\\\\b' + w + '\\\\b').test(document.body.innerText))"
const must = (ok, what) => {
  if (!ok) throw new Error(`tour step did not happen: ${what}`)
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

async function tabWalk(page, key) {
  await page.evaluate("document.activeElement && document.activeElement.blur()")
  for (let i = 1; i <= 60; i++) {
    await page.key("Tab")
    const hit = await page.evaluate(`(() => {
      const a = document.activeElement
      const l = (a.getAttribute('aria-label') || a.placeholder || a.textContent || '').trim()
      return a.tagName + '|' + l
    })()`)
    const [tag, label] = [hit.split("|")[0], hit.slice(hit.indexOf("|") + 1)]
    if (PRIMARY[key].test(label) || (key === "home" && tag === "TEXTAREA"))
      return { reached: i, label: label.slice(0, 30) }
  }
  return { reached: null }
}

export async function runTour({ browser, webUrl, apiUrl, shots }) {
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
  await a.goto(`${webUrl}/sign-up`)
  await a.sleep(1500)
  const status =
    await a.evaluate(`fetch(${JSON.stringify(`${apiUrl}/api/auth/sign-up/email`)}, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Live Check', email: 'tour-' + Date.now() + '@verify.local', password: 'Probe-pass-123' }),
  }).then((r) => r.status)`)
  must(status === 200, `sign-up returned ${status}`)
  const prepared = await a.evaluate(`(async () => {
    const post = (path, body) => fetch(${JSON.stringify(apiUrl)} + path, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const cv = await post('/api/commands/paper.createDoc', {
      kind: 'cv',
      name: ${JSON.stringify(CV_NAME)},
      content: {
        templateId: 'internship',
        name: 'Live Check',
        headline: 'Product intern',
        contact: { email: 'tour@verify.local', phone: '', location: '' },
        summary: 'A CV created for this check.',
        experience: [{ role: 'Intern', company: 'Lab', period: '2025', bullets: ['Shipped a small study.'] }],
        education: [],
        skills: [],
      },
    })
    const card = await post('/api/commands/apply.createCard', {
      title: 'Associate PM intern',
      company: 'Local startup',
      stage: 'prep',
    })
    return { cv: cv.ok, card: card.ok }
  })()`)
  must(
    prepared.cv === true && prepared.card === true,
    `creating the tour CV and card failed (${JSON.stringify(prepared)})`
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

  for (const key of ["home", "paper", "apply", "pitch"]) {
    must(await visit(key), `${key} did not render at ${ROUTES[key][0]}`)
    d.tabs[key] = await tabWalk(a, key)
    await a.sleep(1200)
    d[key] = await snap(a)
    await shot(a, `desktop-${key}`)
    if (key === "home") {
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
        await clickByText(a, "tr, a, button, [role=row]", CV_NAME),
        "the created CV row was not found"
      )
      must(
        await a.waitFor("document.querySelector('h1')", 10000),
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
        "the Coach float did not open"
      )
      await a.sleep(1200)
      d.cvCoach = await snap(a)
      await shot(a, "desktop-paper-cv-coach")
    }
    if (key === "pitch") {
      d.pitchEdit = d.pitch
    }
  }
  d.logs.push(...a.logs.splice(0))
  await a.close()

  const b = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: false,
  })
  b.setIntercept((r) =>
    r.method === "GET" && new URL(r.url).pathname === "/api/paper"
      ? "hold"
      : null
  )
  await b.goto(`${webUrl}/app/paper`)
  await b.sleep(2500)
  d.paperLoading = await snap(b)
  b.setIntercept(null)
  await b.release()

  b.setIntercept((r) =>
    r.method === "GET" && new URL(r.url).pathname === "/api/paper"
      ? { status: 200, body: { ok: true, data: [] } }
      : null
  )
  await b.goto(`${webUrl}/app/paper`)
  await b.waitFor("document.body.innerText.includes('Create a CV')", 10000)
  await b.sleep(800)
  d.paperEmpty = await snap(b)
  b.setIntercept(null)

  const coachCall = (r) =>
    r.method === "POST" &&
    /\/api\/threads\/[^/]+\/coach$/.test(new URL(r.url).pathname)
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
  await b.goto(`${webUrl}/app`)
  await send(b, "hello")
  await b.waitFor("document.querySelector('[role=alert]')", 8000)
  await b.sleep(800)
  d.coachError = await snap(b)
  await shot(b, "desktop-coach-error")

  b.setIntercept((r) => (coachCall(r) ? "fail" : null))
  await b.goto(`${webUrl}/app`)
  await send(b, "hello again")
  await b.waitFor("document.querySelector('[role=alert]')", 8000)
  await b.sleep(800)
  d.coachNet = await snap(b)
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
    await m.sleep(1200)
    d.mobile[key] = await snap(m)
    await shot(m, `mobile-${key}`)
  }
  d.logs.push(...m.logs.splice(0))
  await m.close()

  // Last, because it deletes the card this tour created to reach the zero-card state.
  const e = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: false,
  })
  await e.goto(`${webUrl}/app/apply`)
  must(
    await e.waitFor("document.querySelector('[data-card-id]')", 15000),
    "the created board did not render"
  )
  const deleted = await e.evaluate(`(async () => {
    const o = { credentials: 'include' }
    const list = await (await fetch(${JSON.stringify(`${apiUrl}/api/apply`)}, o)).json()
    let n = 0
    for (const c of list.data) {
      const res = await fetch(${JSON.stringify(`${apiUrl}/api/commands/apply.deleteCard`)}, { ...o, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId: c.id }) })
      if (res.ok) n++
    }
    return { total: list.data.length, deleted: n }
  })()`)
  must(
    deleted.total > 0 && deleted.deleted === deleted.total,
    `deleting the created cards (${JSON.stringify(deleted)})`
  )
  await e.goto(`${webUrl}/app/apply`)
  await e.waitFor(STAGES, 15000)
  await e.sleep(1000)
  d.applyEmpty = await snap(e)
  d.applyEmpty.deleted = deleted
  await shot(e, "desktop-apply-empty")
  await e.close()
  return d
}
