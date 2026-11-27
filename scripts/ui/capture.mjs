import { openRichDocument } from "./rich-document.mjs"
import { fileURLToPath } from "node:url"

import { SHOWN_EMAIL } from "./account-pool.mjs"
import { contextOptions, signInFresh } from "./fresh-account.mjs"
import { restPoint } from "./screens.mjs"
import { seedPaperDocs } from "./paper-docs.mjs"
import { mockFirstPageLibrary } from "./paper-first-pages.mjs"

const FIXTURES = new URL("./fixtures/", import.meta.url)

const STEP_TIMEOUT_MS = 20_000
const MEASURE_LIMIT = 40
const ANIMATION_WAIT_MS = 2_000
const STILL =
  "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}"

const MODULE_PATH = /^\/(?:src|@fs|@id|node_modules)\//

export function pageFault(event, { webOrigin, logs }) {
  if (event.pageError) return `the page threw ${event.pageError.split("\n")[0]}`
  const url = new URL(event.url)
  if (
    event.status < 500 ||
    url.origin !== webOrigin ||
    !MODULE_PATH.test(url.pathname)
  )
    return null
  return `the web server answered ${event.status} for ${url.pathname}, so the screen cannot load (web log ${logs?.web}). An unresolved import there means stale packages: run pnpm install`
}

export function watchFaults(page, state) {
  let fail
  const faulted = new Promise((_, reject) => {
    fail = (event) => {
      const fault = pageFault(event, state)
      if (fault) reject(new Error(fault))
    }
  })
  faulted.catch(() => {})
  page.on("pageerror", (error) =>
    fail({ pageError: String(error?.message ?? error) })
  )
  page.on("response", (response) =>
    fail({ url: response.url(), status: response.status() })
  )
  return faulted
}

const locate = (page, target) => {
  if (target.selector) return page.locator(target.selector).first()
  if (target.role)
    return page
      .getByRole(target.role, { name: target.name, exact: true })
      .first()
  if (target.text) return page.getByText(target.text, { exact: false }).first()
  if (target.label) return page.getByLabel(target.label).first()
  throw new Error(
    `step target needs selector, role, text or label: ${JSON.stringify(target)}`
  )
}

export function cannedAnswer(request, { status, headers = {}, json }) {
  const origin = request.headers().origin
  const crossOrigin = origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Expose-Headers": Object.keys(headers).join(", "),
      }
    : {}
  if (request.method() === "OPTIONS")
    return {
      status: 204,
      headers: {
        ...crossOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          request.headers()["access-control-request-headers"] ?? "content-type",
      },
    }
  return {
    status,
    contentType: "application/json",
    headers: { ...crossOrigin, ...headers },
    body: JSON.stringify(json ?? {}),
  }
}

function answerInThisBrowser(page, answer) {
  return page.route(
    (url) => url.pathname === answer.path,
    (route) => route.fulfill(cannedAnswer(route.request(), answer))
  )
}

export async function runStep(page, origin, step, repo, apiOrigin) {
  if (step.goto)
    return page.goto(`${origin}${step.goto}`, { waitUntil: "domcontentloaded" })
  if (step.click)
    return locate(page, step.click).click({ timeout: STEP_TIMEOUT_MS })
  if (step.clickIfShown) {
    const target = locate(page, step.clickIfShown)
    return (await target.isVisible())
      ? target.click({ timeout: STEP_TIMEOUT_MS })
      : undefined
  }
  if (step.focus)
    return locate(page, step.focus).focus({ timeout: STEP_TIMEOUT_MS })
  if (step.fill)
    return locate(page, step.fill).fill(step.fill.text, {
      timeout: STEP_TIMEOUT_MS,
    })
  if (step.upload)
    return locate(page, step.upload).setInputFiles(
      fileURLToPath(new URL(step.upload.file, FIXTURES)),
      { timeout: STEP_TIMEOUT_MS }
    )
  if (step.respond?.fixture === "rich-document")
    return openRichDocument(page, origin, cannedAnswer, repo)
  if (step.respond) return answerInThisBrowser(page, step.respond)
  if (step.paperDocs)
    return seedPaperDocs(page, apiOrigin, origin, step.paperDocs)
  if (step.paperFirstPages)
    return mockFirstPageLibrary(page, step.paperFirstPages, repo)
  if (step.press) return page.keyboard.press(step.press)
  if (step.type) return page.keyboard.type(step.type)
  if (step.waitFor)
    return locate(page, step.waitFor).waitFor({
      state: "visible",
      timeout: STEP_TIMEOUT_MS,
    })
  throw new Error(`unknown step ${JSON.stringify(step)}`)
}

function showFixedEmail({ email, shown }) {
  const swap = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue.includes(email))
        node.nodeValue = node.nodeValue.replaceAll(email, shown)
      return
    }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    for (let text = walker.nextNode(); text; text = walker.nextNode())
      if (text.nodeValue.includes(email))
        text.nodeValue = text.nodeValue.replaceAll(email, shown)
  }
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") swap(record.target)
      for (const added of record.addedNodes) swap(added)
    }
  }).observe(document, { subtree: true, childList: true, characterData: true })
}

export async function settle(page, point = { x: 0, y: 0 }) {
  await page.mouse.move(point.x, point.y)
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {})
  await page.addStyleTag({ content: STILL })
  await page.evaluate(async (limit) => {
    await document.fonts.ready
    const finite = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.effect?.getComputedTiming().iterations !== Infinity
      )
    await Promise.race([
      Promise.all(
        finite.map((animation) => animation.finished.catch(() => {}))
      ),
      new Promise((resolve) => setTimeout(resolve, limit)),
    ])
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )
  }, ANIMATION_WAIT_MS)
}

export async function openScreen(browser, state, screen, { width, scale = 1 }) {
  const context = await browser.newContext(contextOptions({ width, scale }))
  if (screen.signedIn !== false) {
    const email = await signInFresh(context, state, screen.id)
    await context.addInitScript(showFixedEmail, { email, shown: SHOWN_EMAIL })
  }
  const page = await context.newPage()
  const run = { page, context, state, screenId: screen.id }
  const faulted = watchFaults(page, state)
  await page.goto(`${state.webOrigin}${screen.route}`, {
    waitUntil: "domcontentloaded",
  })
  await runSteps(run, "step", screen.steps, faulted)
  await settle(page, restPoint(screen, page.viewportSize()))
  const close = async () => {
    await runSteps(run, "after step", screen.after ?? [], faulted)
    await context.close()
  }
  return { page, close }
}

async function runSteps(
  { page, context, state, screenId },
  kind,
  steps,
  faulted
) {
  for (const [at, step] of steps.entries()) {
    try {
      await Promise.race([
        runStep(page, state.webOrigin, step, state.repo, state.apiOrigin),
        faulted,
      ])
    } catch (error) {
      await context.close()
      throw new Error(
        `${screenId} ${kind} ${at + 1} ${JSON.stringify(step)} failed: ${error.message.split("\n")[0]}`
      )
    }
  }
}

export function slotSelectors({ slots = [], selectors = [] }) {
  return [
    ...slots.map((slot) => ({ name: slot, selector: `[data-slot="${slot}"]` })),
    ...selectors.map((selector) => ({ name: selector, selector })),
  ]
}

export async function measure(page, targets) {
  return page.evaluate(
    ({ targets, limit }) => {
      const read = (element) => {
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const px = (value) => Number.parseFloat(value) || 0
        const column =
          style.flexDirection.startsWith("column") || style.display === "grid"
        return {
          slot: element.getAttribute("data-slot"),
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          radius: px(style.borderTopLeftRadius),
          paddingTop: px(style.paddingTop),
          paddingRight: px(style.paddingRight),
          paddingBottom: px(style.paddingBottom),
          paddingLeft: px(style.paddingLeft),
          gap: px(column ? style.rowGap : style.columnGap),
          fontSize: px(style.fontSize),
          lineHeight: style.lineHeight,
          color: style.color,
          background: style.backgroundColor,
        }
      }
      const list = targets.length
        ? targets
        : [{ name: "every data-slot", selector: "[data-slot]" }]
      return list.map(({ name, selector }) => {
        const all = [...document.querySelectorAll(selector)]
        return {
          name,
          selector,
          count: all.length,
          items: all.slice(0, limit).map(read),
        }
      })
    },
    { targets, limit: MEASURE_LIMIT }
  )
}
