export const FRAME = '[data-slot="sidebar-frame"]'
export const SIDEBAR = 'aside[aria-label="Sidebar"]'
export const HANDLE = '[data-slot="sidebar-resize-handle"]'
export const WIDTH_KEY = "opencv.sidebar.width"
export const COLLAPSED_KEY = "opencv.sidebar.collapsed"
export const Y = 450
export const GUTTER = 36

export const rectOf = (page, selector) =>
  page.evaluate(
    `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; })()`
  )

export const stored = (page, key) =>
  page.evaluate(`localStorage.getItem(${JSON.stringify(key)})`)

export const mainLeft = (page) =>
  page.evaluate(
    `document.querySelector('#app-main').parentElement.getBoundingClientRect().left`
  )

export async function dragTo(page, from, to) {
  await page.hover(from, Y)
  await page.mouse("mousePressed", from, Y)
  const steps = 6
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse("mouseMoved", from + ((to - from) * i) / steps, Y)
  }
  await page.sleep(80)
}

export async function release(page, x) {
  await page.mouse("mouseReleased", x, Y)
  await page.sleep(120)
}

export async function waitShell(page, web) {
  await page.goto(`${web}/paper`)
  await page.waitFor(
    `document.querySelector(${JSON.stringify(`${SIDEBAR} [data-slot="sidebar-link"]`)})`,
    20000
  )
  await page.evaluate(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  )
}

export async function clickCenter(page, selector) {
  const target = await rectOf(page, selector)
  const x = target.x + target.w / 2
  const y = target.y + target.h / 2
  await page.mouse("mouseMoved", x, y)
  await page.mouse("mousePressed", x, y)
  await page.mouse("mouseReleased", x, y)
}

export const peekClosed = (page) =>
  page.evaluate(
    `document.querySelector(${JSON.stringify(SIDEBAR)}).inert && document.querySelector(${JSON.stringify(SIDEBAR)}).getBoundingClientRect().right <= 0`
  )

export const focusedLabel = (page, label) =>
  page.evaluate(
    `document.activeElement?.getAttribute('aria-label') === ${JSON.stringify(label)}`
  )
