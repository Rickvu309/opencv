import { viewportFor } from "./screens.mjs"

const STEP_TIMEOUT_MS = 20_000
const MEASURE_LIMIT = 40
const ANIMATION_WAIT_MS = 2_000
const STILL =
  "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}"

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

export async function runStep(page, origin, step) {
  if (step.goto)
    return page.goto(`${origin}${step.goto}`, { waitUntil: "domcontentloaded" })
  if (step.click)
    return locate(page, step.click).click({ timeout: STEP_TIMEOUT_MS })
  if (step.fill)
    return locate(page, step.fill).fill(step.fill.text, {
      timeout: STEP_TIMEOUT_MS,
    })
  if (step.press) return page.keyboard.press(step.press)
  if (step.type) return page.keyboard.type(step.type)
  if (step.waitFor)
    return locate(page, step.waitFor).waitFor({
      state: "visible",
      timeout: STEP_TIMEOUT_MS,
    })
  throw new Error(`unknown step ${JSON.stringify(step)}`)
}

export async function settle(page) {
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
  const context = await browser.newContext({
    viewport: viewportFor(width),
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    storageState: screen.signedIn === false ? undefined : state.storage,
  })
  const page = await context.newPage()
  await page.goto(`${state.webOrigin}${screen.route}`, {
    waitUntil: "domcontentloaded",
  })
  await runSteps(
    page,
    state.webOrigin,
    screen.id,
    "step",
    screen.steps,
    context
  )
  await settle(page)
  const close = async () => {
    await runSteps(
      page,
      state.webOrigin,
      screen.id,
      "after step",
      screen.after ?? [],
      context
    )
    await context.close()
  }
  return { page, close }
}

async function runSteps(page, origin, screenId, kind, steps, context) {
  for (const [at, step] of steps.entries()) {
    try {
      await runStep(page, origin, step)
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
