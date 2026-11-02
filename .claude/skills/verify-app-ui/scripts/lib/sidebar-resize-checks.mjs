import { join } from "node:path"

const FRAME = '[data-slot="sidebar-frame"]'
const SIDEBAR = 'aside[aria-label="Sidebar"]'
const HANDLE = '[data-slot="sidebar-resize-handle"]'
const WIDTH_KEY = "opencv.sidebar.width"
const COLLAPSED_KEY = "opencv.sidebar.collapsed"
const Y = 450

const rectOf = (page, selector) =>
  page.evaluate(
    `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; })()`
  )

const stored = (page, key) =>
  page.evaluate(`localStorage.getItem(${JSON.stringify(key)})`)

const mainLeft = (page) =>
  page.evaluate(
    `document.querySelector('#app-main').parentElement.getBoundingClientRect().left`
  )

async function dragTo(page, from, to) {
  await page.hover(from, Y)
  await page.mouse("mousePressed", from, Y)
  const steps = 6
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse("mouseMoved", from + ((to - from) * i) / steps, Y)
  }
  await page.sleep(80)
}

async function release(page, x) {
  await page.mouse("mouseReleased", x, Y)
  await page.sleep(120)
}

async function waitShell(page, web) {
  await page.goto(`${web}/paper`)
  await page.waitFor(
    `document.querySelector(${JSON.stringify(`${SIDEBAR} [data-slot="sidebar-link"]`)})`,
    20000
  )
  await page.evaluate(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  )
}

export async function checkResize({ browser, web, output, check, capture }) {
  const tag = "1440 resize"
  const page = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  await page.goto(web)
  await page.evaluate(
    `localStorage.removeItem(${JSON.stringify(WIDTH_KEY)}); localStorage.removeItem(${JSON.stringify(COLLAPSED_KEY)})`
  )
  await waitShell(page, web)

  const handle = await page.evaluate(`(() => {
    const h = document.querySelector(${JSON.stringify(HANDLE)});
    if (!h) return null;
    const after = getComputedStyle(h, '::after');
    return { role: h.getAttribute('role'), orientation: h.getAttribute('aria-orientation'), label: h.getAttribute('aria-label'), now: h.getAttribute('aria-valuenow'), min: h.getAttribute('aria-valuemin'), max: h.getAttribute('aria-valuemax'), tab: h.tabIndex, cursor: getComputedStyle(h).cursor, rest: after.backgroundColor, w: h.getBoundingClientRect().width };
  })()`)
  check(Boolean(handle), `${tag} the sidebar has a resize handle`)
  check(
    handle.role === "separator" &&
      handle.orientation === "vertical" &&
      handle.label === "Resize sidebar" &&
      handle.now === "244" &&
      handle.min === "200" &&
      handle.max === "360" &&
      handle.tab === 0,
    `${tag} the handle is a focusable vertical separator with its range (${handle.role} ${handle.now}/${handle.min}-${handle.max})`
  )
  check(
    handle.w >= 8 && handle.cursor === "col-resize",
    `${tag} the handle is at least 8px wide with a col-resize cursor (${handle.w}, ${handle.cursor})`
  )
  check(
    /rgba\(0, 0, 0, 0\)|transparent/.test(handle.rest),
    `${tag} the handle line is invisible at rest (${handle.rest})`
  )
  const box = await rectOf(page, SIDEBAR)
  await page.hover(box.r, 300)
  await page.sleep(300)
  const hot = await page.evaluate(
    `(() => { const a = getComputedStyle(document.querySelector(${JSON.stringify(HANDLE)}), '::after'); return { bg: a.backgroundColor, w: a.width }; })()`
  )
  check(
    !/rgba\(0, 0, 0, 0\)|transparent/.test(hot.bg) && hot.w === "2px",
    `${tag} hovering the handle draws a 2px line (${hot.bg}, ${hot.w})`
  )

  await dragTo(page, box.r, 300)
  const live = await page.evaluate(
    `({ var: getComputedStyle(document.querySelector(${JSON.stringify(FRAME)})).getPropertyValue('--sidebar-width').trim(), select: document.body.style.userSelect, resizing: document.querySelector(${JSON.stringify(FRAME)}).dataset.resizing, stored: localStorage.getItem(${JSON.stringify(WIDTH_KEY)}) })`
  )
  check(
    live.var === "300px" &&
      live.select === "none" &&
      live.resizing === "true" &&
      live.stored === null,
    `${tag} dragging sets the width live and blocks text selection (${live.var}, ${live.select}, saved ${live.stored})`
  )
  await release(page, 300)
  check(
    (await rectOf(page, SIDEBAR)).w === 300 &&
      (await stored(page, WIDTH_KEY)) === "300" &&
      Math.abs((await mainLeft(page)) - 300) <= 1,
    `${tag} releasing at 300 sets the sidebar, the panel edge and the saved width to 300`
  )
  await waitShell(page, web)
  check(
    (await rectOf(page, SIDEBAR)).w === 300,
    `${tag} the width is still 300 after a reload`
  )

  await dragTo(page, 300, 900)
  await release(page, 900)
  check(
    (await rectOf(page, SIDEBAR)).w === 360 &&
      (await stored(page, WIDTH_KEY)) === "360",
    `${tag} dragging far right stops at 360`
  )
  await page.hover(720, 450)
  await capture(page, "sidebar-resize-max.png")

  await dragTo(page, 360, 160)
  await release(page, 160)
  check(
    (await rectOf(page, SIDEBAR)).w === 200,
    `${tag} dragging to 160 stops at 200 without collapsing`
  )
  await page.hover(720, 450)
  await capture(page, "sidebar-resize-min.png")

  await page.hover(200, 300)
  await page.mouse("mousePressed", 200, 300, 1)
  await page.mouse("mouseReleased", 200, 300, 1)
  await page.mouse("mousePressed", 200, 300, 2)
  await page.mouse("mouseReleased", 200, 300, 2)
  await page.sleep(150)
  check(
    (await rectOf(page, SIDEBAR)).w === 244 &&
      (await stored(page, WIDTH_KEY)) === "244",
    `${tag} double-clicking the handle resets to 244`
  )

  await page.evaluate(
    `document.querySelector(${JSON.stringify(HANDLE)}).focus()`
  )
  await page.key("ArrowRight")
  await page.sleep(100)
  const grown = (await rectOf(page, SIDEBAR)).w
  await page.key("ArrowLeft")
  await page.key("ArrowLeft")
  await page.sleep(100)
  const shrunk = (await rectOf(page, SIDEBAR)).w
  check(
    grown === 260 && shrunk === 228,
    `${tag} arrow keys resize by 16px (${grown}, ${shrunk})`
  )
  const ring = await page.evaluate(
    `(() => { const h = document.querySelector(${JSON.stringify(HANDLE)}); return { visible: h.matches(':focus-visible'), line: getComputedStyle(h, '::after').backgroundColor, shadow: getComputedStyle(h).boxShadow }; })()`
  )
  check(
    ring.visible &&
      !/rgba\(0, 0, 0, 0\)|transparent/.test(ring.line) &&
      ring.shadow !== "none",
    `${tag} the focused handle shows a line and a focus ring (${ring.line})`
  )
  await page.key("Enter")
  await page.sleep(150)
  const collapsed = await page.evaluate(
    `({ state: document.querySelector(${JSON.stringify(FRAME)}).dataset.state, inert: document.querySelector(${JSON.stringify(SIDEBAR)}).inert, handle: !!document.querySelector(${JSON.stringify(HANDLE)}), stored: localStorage.getItem(${JSON.stringify(COLLAPSED_KEY)}) })`
  )
  check(
    collapsed.state === "collapsed" &&
      collapsed.inert &&
      !collapsed.handle &&
      collapsed.stored === "1",
    `${tag} Enter on the handle collapses the sidebar out of the tab order`
  )
  const panel = await mainLeft(page)
  check(panel <= 9, `${tag} the panel takes the space (left ${panel})`)
  await page.hover(720, 450)
  await capture(page, "sidebar-collapsed.png")
  await waitShell(page, web)
  check(
    (await rectOf(page, FRAME)).w <= 9 &&
      (await stored(page, COLLAPSED_KEY)) === "1",
    `${tag} the sidebar stays collapsed after a reload`
  )

  await page.hover(3, Y)
  await page.sleep(500)
  const peek = await page.evaluate(
    `(() => { const a = document.querySelector(${JSON.stringify(SIDEBAR)}); const r = a.getBoundingClientRect(); return { left: r.left, w: r.width, inert: a.inert, shadow: getComputedStyle(a).boxShadow, panel: document.querySelector('#app-main').parentElement.getBoundingClientRect().left }; })()`
  )
  check(
    peek.left === 0 && peek.w === 228 && !peek.inert && peek.panel <= 9,
    `${tag} hovering the left edge peeks the sidebar over the content (${peek.left}, ${peek.w}, panel ${peek.panel})`
  )
  await capture(page, "sidebar-peek.png")
  await page.hover(900, Y)
  await page.sleep(500)
  const gone = await page.evaluate(
    `(() => { const a = document.querySelector(${JSON.stringify(SIDEBAR)}); return { right: a.getBoundingClientRect().right, inert: a.inert }; })()`
  )
  check(
    gone.right <= 0 && gone.inert,
    `${tag} leaving the peek hides it again (${gone.right})`
  )

  await page.hover(3, Y)
  await page.sleep(500)
  await page.evaluate(
    `document.querySelector('button[aria-label="Pin sidebar"]').click()`
  )
  await page.sleep(400)
  check(
    (await rectOf(page, SIDEBAR)).w === 228 &&
      (await stored(page, COLLAPSED_KEY)) === "0",
    `${tag} the pin button in the peek restores the sidebar`
  )
  await page.evaluate("document.activeElement?.blur()")
  await page.key("[")
  await page.sleep(400)
  check((await rectOf(page, FRAME)).w <= 9, `${tag} [ collapses the sidebar`)
  await page.evaluate(
    `document.querySelector('button[aria-label="Expand sidebar"]').click()`
  )
  await page.sleep(400)
  check(
    (await rectOf(page, SIDEBAR)).w === 228,
    `${tag} the Expand sidebar button brings it back`
  )
  await page.evaluate(
    `(() => { const i = document.createElement('input'); i.id = 'probe'; document.body.append(i); i.focus(); })()`
  )
  await page.key("[")
  await page.sleep(300)
  check(
    (await rectOf(page, SIDEBAR)).w === 228,
    `${tag} [ is ignored while typing in an input`
  )
  await page.evaluate("document.getElementById('probe').remove()")

  await accountMenu({ page, check, capture, tag })
  await page.close()
  void output
}

async function accountMenu({ page, check, capture, tag }) {
  await page.evaluate(
    `document.querySelector('[data-slot="account-trigger"]').click()`
  )
  await page.waitFor(`document.querySelector('[role="menu"]')`, 5000)
  await page.sleep(400)
  const menu = await page.evaluate(`(() => {
    const t = document.querySelector('[data-slot="account-trigger"]').getBoundingClientRect();
    const m = document.querySelector('[role="menu"]');
    const r = m.getBoundingClientRect();
    return { trigger: { x: t.left, y: t.top, w: t.width }, menu: { x: r.left, b: r.bottom, w: r.width }, items: [...m.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent.trim()), text: m.textContent };
  })()`)
  check(
    menu.menu.b <= menu.trigger.y + 1 &&
      Math.abs(menu.menu.x - menu.trigger.x) <= 1 &&
      Math.abs(menu.menu.w - menu.trigger.w) <= 2,
    `${tag} the account menu opens upward at the row width (menu ${menu.menu.x}/${menu.menu.w}, row ${menu.trigger.x}/${menu.trigger.w})`
  )
  check(
    menu.items.join("|") === "Settings|Sign out" &&
      menu.text.includes("Linh Nguyen"),
    `${tag} the account menu lists the person, Settings and Sign out (${menu.items.join("|")})`
  )
  await page.hover(900, 200)
  await capture(page, "sidebar-account-menu.png", {
    x: 0,
    y: 500,
    width: 520,
    height: 400,
  })
  await page.key("Escape")
  await page.sleep(300)
  check(
    await page.evaluate(
      `!document.querySelector('[role="menu"]') && document.activeElement === document.querySelector('[data-slot="account-trigger"]')`
    ),
    `${tag} Escape closes the account menu and returns focus to the row`
  )
}

export const evidencePath = (output, name) => join(output, name)
