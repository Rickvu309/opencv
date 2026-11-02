import { join } from "node:path"

import {
  FRAME,
  GUTTER,
  INSET,
  HANDLE,
  mainLeft,
  peekClosed,
  rectOf,
  release,
  SIDEBAR,
  stored,
  waitShell,
  dragTo,
  COLLAPSED_KEY,
  WIDTH_KEY,
  Y,
} from "./sidebar-resize-shared.mjs"
import { cancelledDrag, overDragPreview } from "./sidebar-drag-checks.mjs"
import { accountMenu } from "./sidebar-account-checks.mjs"

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
      handle.min === "216" &&
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
    `(() => { const a = getComputedStyle(document.querySelector(${JSON.stringify(HANDLE)}), '::after'); const ring = getComputedStyle(document.querySelector(${JSON.stringify(SIDEBAR)})).getPropertyValue('--sidebar-ring'); return { bg: a.backgroundColor, w: a.width, delay: a.transitionDelay, ring }; })()`
  )
  check(
    !/rgba\(0, 0, 0, 0\)|transparent/.test(hot.bg) &&
      hot.w === "2px" &&
      hot.delay !== "0s",
    `${tag} hovering the handle draws a 2px line in the ring colour after a short delay (${hot.bg}, ${hot.w}, delay ${hot.delay})`
  )

  await dragTo(page, box.r, 300)
  const live = await page.evaluate(
    `({ aside: document.querySelector(${JSON.stringify(SIDEBAR)}).getBoundingClientRect().width, frame: document.querySelector(${JSON.stringify(FRAME)}).getBoundingClientRect().width, select: document.body.style.userSelect, resizing: document.querySelector(${JSON.stringify(FRAME)}).dataset.resizing, stored: localStorage.getItem(${JSON.stringify(WIDTH_KEY)}), rootVar: document.documentElement.style.getPropertyValue('--sidebar-width') })`
  )
  check(
    live.aside === 300 &&
      live.frame === 300 &&
      live.select === "none" &&
      live.resizing === "true" &&
      live.stored === null &&
      live.rootVar === "",
    `${tag} dragging sets the width live on the sidebar and its frame, not on the root, and blocks text selection (${live.aside}/${live.frame}, ${live.select}, saved ${live.stored})`
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
    (await rectOf(page, SIDEBAR)).w === 216,
    `${tag} dragging to 160 stops at 216 without collapsing`
  )
  await page.hover(720, 450)
  await capture(page, "sidebar-resize-min.png")

  await page.hover(216, 300)
  await page.mouse("mousePressed", 216, 300, 1)
  await page.mouse("mouseReleased", 216, 300, 1)
  await page.mouse("mousePressed", 216, 300, 2)
  await page.mouse("mouseReleased", 216, 300, 2)
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
  check(panel <= INSET + 1, `${tag} the panel takes the space (left ${panel})`)
  const focus = await page.evaluate(
    `({ main: document.activeElement?.id === "app-main", body: document.activeElement === document.body })`
  )
  check(
    focus.main && !focus.body,
    `${tag} focus moved to the page after the collapse, not the body`
  )
  await page.hover(720, 450)
  await capture(page, "sidebar-collapsed.png")
  await waitShell(page, web)
  check(
    (await rectOf(page, FRAME)).w <= GUTTER + 1 &&
      (await stored(page, COLLAPSED_KEY)) === "1",
    `${tag} the sidebar stays collapsed after a reload`
  )

  await page.hover(3, Y)
  await page.hover(700, Y)
  await page.sleep(500)
  check(
    await peekClosed(page),
    `${tag} a quick pass over the edge does not open the peek`
  )

  await page.hover(3, Y)
  await page.sleep(60)
  check(
    await peekClosed(page),
    `${tag} the peek waits for hover intent before it opens`
  )
  await page.sleep(500)
  const peek = await page.evaluate(
    `(() => { const a = document.querySelector(${JSON.stringify(SIDEBAR)}); const r = a.getBoundingClientRect(); const s = getComputedStyle(a); return { left: r.left, top: r.top, bottom: window.innerHeight - r.bottom, w: r.width, inert: a.inert, shadow: s.boxShadow, radius: s.borderTopLeftRadius, ring: s.boxShadow.length, panel: document.querySelector('#app-main').parentElement.getBoundingClientRect().left }; })()`
  )
  check(
    peek.left === 8 &&
      peek.top === 8 &&
      peek.bottom === 8 &&
      peek.w === 228 &&
      !peek.inert &&
      peek.panel <= INSET + 1 &&
      parseFloat(peek.radius) >= 8 &&
      peek.shadow !== "none",
    `${tag} hovering the left edge peeks an inset rounded elevated card over the content (${peek.left}, ${peek.top}, ${peek.w}, radius ${peek.radius}, panel ${peek.panel})`
  )
  await capture(page, "sidebar-peek.png")
  await page.hover(900, Y)
  await page.sleep(150)
  check(
    !(await peekClosed(page)),
    `${tag} the peek stays open for a close grace after the pointer leaves`
  )
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
    `document.querySelector(${JSON.stringify(`${SIDEBAR} [data-slot="nav-item"]`)}).focus()`
  )
  await page.key("Escape")
  await page.sleep(500)
  const escaped = await page.evaluate(
    `({ closed: document.querySelector(${JSON.stringify(SIDEBAR)}).inert, focus: document.activeElement?.id || document.activeElement?.tagName })`
  )
  check(
    escaped.closed && escaped.focus === "app-main",
    `${tag} Escape closes the peek and moves focus to the page (${escaped.focus})`
  )
  await page.hover(900, Y)
  await page.sleep(500)

  await page.hover(3, Y)
  await page.sleep(500)
  const inbox = await page.evaluate(
    `(() => { const l = [...document.querySelectorAll(${JSON.stringify(`${SIDEBAR} [data-slot="nav-item"]`)})].find((e) => e.getAttribute('href') === '/inbox'); const r = l.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`
  )
  await page.mouse("mouseMoved", inbox.x, inbox.y)
  await page.mouse("mousePressed", inbox.x, inbox.y)
  await page.mouse("mouseReleased", inbox.x, inbox.y)
  await page.sleep(500)
  const navigated = await page.evaluate(
    `({ path: location.pathname, inert: document.querySelector(${JSON.stringify(SIDEBAR)}).inert, body: document.activeElement === document.body })`
  )
  check(
    navigated.path === "/inbox" && navigated.inert && !navigated.body,
    `${tag} a link click in the peek navigates, closes it and keeps focus off the body (${navigated.path})`
  )
  await page.hover(900, Y)
  await page.sleep(500)

  await page.hover(3, Y)
  await page.sleep(500)
  await page.hover(700, Y)
  await page.hover(750, Y)
  await page.sleep(700)
  check(
    await peekClosed(page),
    `${tag} a fast jump away from the open peek cannot leave it stuck open`
  )

  await page.hover(3, Y)
  await page.sleep(500)
  await page.hover(3, Y)
  await page.sleep(500)
  await page.evaluate(
    `document.querySelector(${JSON.stringify(`${SIDEBAR} [data-slot="nav-item"]`)}).focus()`
  )
  await page.key("[")
  await page.sleep(400)
  check(
    (await rectOf(page, SIDEBAR)).w === 228 &&
      (await stored(page, COLLAPSED_KEY)) === "0",
    `${tag} [ restores the sidebar from the peek`
  )
  check(
    await page.evaluate(
      `!!document.activeElement?.closest(${JSON.stringify('[data-slot="sidebar-frame"]')})`
    ),
    `${tag} focus stays in the sidebar after the peek expands`
  )
  await page.evaluate("document.activeElement?.blur()")
  await page.evaluate(
    `document.querySelector(${JSON.stringify(`${SIDEBAR} [data-slot="nav-item"]`)}).focus()`
  )
  await page.key("[")
  await page.sleep(400)
  check(
    (await rectOf(page, FRAME)).w <= GUTTER + 1,
    `${tag} [ collapses the sidebar`
  )
  check(
    await page.evaluate("document.activeElement?.id === 'app-main'"),
    `${tag} focus moved to the page after [ collapsed the sidebar`
  )
  await page.key("[")
  await page.sleep(400)
  check(
    (await rectOf(page, SIDEBAR)).w === 228,
    `${tag} [ expands the sidebar again`
  )
  check(
    await page.evaluate("document.activeElement !== document.body"),
    `${tag} focus is never on the body after the expand`
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

  await cancelledDrag({ page, check, tag })
  await overDragPreview({ page, check, capture, tag })
  if ((await rectOf(page, FRAME)).w <= GUTTER + 1) await page.key("[")
  await page.hover(720, 450)
  await page.sleep(400)

  await accountMenu({ page, check, capture, tag })
  await page.close()
  void output
}

export const evidencePath = (output, name) => join(output, name)
