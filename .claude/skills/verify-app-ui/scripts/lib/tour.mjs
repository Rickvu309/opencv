// Drives one signed-in tour of the app and returns the raw measurements. It decides nothing.
// Signs up a throwaway account through the api (the starter workspace seeds a CV, four Apply cards,
// a sample Pitch and a welcome Thread), then visits Home, a Thread, the Search palette, Paper (list and
// open CV with the Coach float), Apply and Pitch. Scenario pages answer or hold one api call each.
import { probeSource } from "./probe.mjs"

const ROUTES = {
  home: ["/app", "document.querySelector('h1')"],
  paper: [
    "/app/paper",
    "document.body.innerText.includes('Sample internship CV')",
  ],
  apply: ["/app/apply", "document.querySelector('[data-card-id]')"],
  pitch: ["/app/pitch", "document.querySelector('h1')"],
}
const PRIMARY = {
  home: /Message Coach|^Send$/,
  paper: /^(New document|Make mine)$/,
  apply: /^Add /,
  pitch: /^(Edit|Publish)/,
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
  const snap = (page) => page.evaluate(probeSource)

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
  if (status !== 200) throw new Error(`sign-up returned ${status}`)

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
    if (!(await visit(key)))
      throw new Error(`${key} did not render at ${ROUTES[key][0]}`)
    d.tabs[key] = await tabWalk(a, key)
    await a.sleep(1200)
    d[key] = await snap(a)
    await shot(a, `desktop-${key}`)
    if (key === "home") {
      await a.key("k", { ctrl: true })
      await a.waitFor("document.querySelector('[role=dialog]')", 4000)
      await a.sleep(500)
      d.palette = await snap(a)
      await a.key("Escape")
      await a.sleep(300)
      await typeInto(a, "Review my CV")
      await a.sleep(300)
      await clickByText(a, "button", "Send")
      await a.waitFor("document.body.innerText.includes('Listed your')", 10000)
      await a.sleep(800)
      d.thread = await snap(a)
      await shot(a, "desktop-thread")
    }
    if (key === "paper") {
      await clickByText(a, "tr, a, button, [role=row]", "Sample internship CV")
      await a.waitFor("document.querySelector('h1')", 10000)
      await a.sleep(1500)
      d.cv = await snap(a)
      await shot(a, "desktop-paper-cv")
      await clickByText(a, "button", "Coach")
      await a.waitFor("document.querySelector('textarea')", 6000)
      await a.sleep(1200)
      d.cvCoach = await snap(a)
      await shot(a, "desktop-paper-cv-coach")
    }
    if (key === "pitch") {
      await clickByText(a, "button", "Edit profile")
      await a.waitFor(
        "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Publish')",
        5000
      )
      await a.sleep(600)
      d.pitchEdit = await snap(a)
    }
  }
  d.logs = a.logs.splice(0)
  await a.close()

  const b = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: false,
  })
  b.setIntercept((r) =>
    r.method === "GET" && new URL(r.url).pathname === "/api/apply"
      ? { status: 200, body: { ok: true, data: [] } }
      : null
  )
  await b.goto(`${webUrl}/app/apply`)
  await b.waitFor("document.body.innerText.includes('Inbox')", 15000)
  await b.sleep(1000)
  d.applyEmpty = await snap(b)
  await shot(b, "desktop-apply-empty")

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
    r.method === "POST" &&
    /\/api\/threads\/[^/]+\/coach$/.test(new URL(r.url).pathname)
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
  await b.waitFor("document.querySelector('textarea')", 15000)
  await typeInto(b, "hello")
  await b.sleep(300)
  await clickByText(b, "button", "Send")
  await b.waitFor(
    "document.body.innerText.includes('Retry') || document.body.innerText.includes('not found')",
    8000
  )
  await b.sleep(800)
  d.coachError = await snap(b)
  await shot(b, "desktop-coach-error")
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
    await r.waitFor(ROUTES[key][1], 20000)
    await r.sleep(1200)
    d.reduced[key] = await snap(r)
  }
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
    await m.waitFor(ROUTES[key][1], 20000)
    await m.sleep(1200)
    d.mobile[key] = await snap(m)
    await shot(m, `mobile-${key}`)
  }
  await m.close()
  return d
}
