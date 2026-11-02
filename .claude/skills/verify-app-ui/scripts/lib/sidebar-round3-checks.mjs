import {
  COLLAPSED_KEY,
  FRAME,
  focusedLabel,
  GUTTER,
  HANDLE,
  mainLeft,
  peekClosed,
  rectOf,
  release,
  SIDEBAR,
  stored,
  waitShell,
  dragTo,
  WIDTH_KEY,
  Y,
} from "./sidebar-resize-shared.mjs"

const TOOLTIPS = `document.querySelectorAll('[data-slot="tooltip-content"]').length`
const MIN_GAP = 12

async function reset(page, web) {
  await page.goto(web)
  await page.evaluate(
    `localStorage.removeItem(${JSON.stringify(WIDTH_KEY)}); localStorage.removeItem(${JSON.stringify(COLLAPSED_KEY)})`
  )
  await waitShell(page, web)
}

async function keyboardCollapse({ page, check, tag }) {
  await page.evaluate(
    `document.querySelector(${JSON.stringify(`${SIDEBAR} [data-slot="nav-item"]`)}).focus()`
  )
  await page.key("[")
  await page.sleep(1500)
  check(
    await focusedLabel(page, "Expand sidebar"),
    `${tag} a keyboard collapse hands focus to the expand button`
  )
  check(
    (await page.evaluate(TOOLTIPS)) === 0,
    `${tag} the handed-off focus does not leave an Expand sidebar tooltip open`
  )
  await page.hover(3, Y)
  await page.sleep(600)
  const peek = await page.evaluate(`(() => {
    const link = [...document.querySelectorAll(${JSON.stringify(`${SIDEBAR} [data-slot="nav-item"]`)})].find((e) => e.getAttribute('href') === '/inbox');
    const r = link.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { open: !document.querySelector(${JSON.stringify(SIDEBAR)}).inert, tooltips: ${TOOLTIPS}, covered: !top || !top.closest(${JSON.stringify(SIDEBAR)}) };
  })()`)
  check(
    peek.open && peek.tooltips === 0 && !peek.covered,
    `${tag} the peek opens with no tooltip over it and the Inbox link is reachable (open ${peek.open}, tooltips ${peek.tooltips}, covered ${peek.covered})`
  )
  await page.key("Escape")
  await page.sleep(500)
  check(await peekClosed(page), `${tag} the first Escape closes the peek`)
  await page.hover(900, Y)
  await page.sleep(500)
}

async function bracketMidDrag({ page, check, tag }) {
  await page.evaluate(`document.activeElement?.blur()`)
  await page.key("[")
  await page.sleep(500)
  const handle = await rectOf(page, HANDLE)
  check(
    handle !== null && handle.w > 0,
    `${tag} the handle is back after [ expands`
  )
  const x = handle.x + handle.w / 2
  await page.hover(x, Y)
  await page.mouse("mousePressed", x, Y)
  await page.mouse("mouseMoved", x + 60, Y)
  await page.sleep(100)
  await page.key("[")
  await page.sleep(300)
  const mid = await page.evaluate(
    `document.querySelector(${JSON.stringify(FRAME)}).getAttribute('data-state')`
  )
  check(mid === "open", `${tag} [ is ignored while a drag is active (${mid})`)
  await release(page, x + 60)
  await page.sleep(400)
  const after = await rectOf(page, FRAME)
  check(
    (await page.evaluate(
      `document.querySelector(${JSON.stringify(FRAME)}).getAttribute('data-state')`
    )) === "open" && after.w > 280,
    `${tag} the release commits the dragged width (${after.w})`
  )
  await page.key("[")
  await page.sleep(500)
  check(
    (await rectOf(page, FRAME)).w === GUTTER &&
      Math.abs((await mainLeft(page)) - GUTTER) <= 1,
    `${tag} a later [ still leaves the ${GUTTER}px gutter and the page starts after it (frame ${(await rectOf(page, FRAME)).w}, main ${await mainLeft(page)})`
  )
  await page.key("[")
  await page.sleep(500)
}

async function pointerCancel({ page, check, tag }) {
  const before = (await rectOf(page, SIDEBAR)).w
  const handle = await rectOf(page, HANDLE)
  const x = handle.x + handle.w / 2
  await page.hover(x, Y)
  await page.mouse("mousePressed", x, Y)
  await page.mouse("mouseMoved", x + 50, Y)
  await page.sleep(100)
  await page.evaluate(
    `document.querySelector(${JSON.stringify(HANDLE)}).dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }))`
  )
  await page.sleep(200)
  const state = await page.evaluate(`(() => {
    const f = document.querySelector(${JSON.stringify(FRAME)});
    return { resizing: f.hasAttribute('data-resizing'), inline: f.style.width, mode: f.getAttribute('data-mode'), select: document.body.style.userSelect };
  })()`)
  check(
    !state.resizing &&
      state.inline === "" &&
      state.mode === "expanded" &&
      state.select === "",
    `${tag} pointercancel ends the drag in the expanded mode with no leftovers (${JSON.stringify(state)})`
  )
  await page.mouse("mouseReleased", x + 50, Y)
  await page.sleep(200)
  check(
    (await rectOf(page, SIDEBAR)).w === before,
    `${tag} the width is unchanged after the cancelled drag`
  )
}

async function narrowestHeader({ page, check, capture, tag }) {
  const from = (await rectOf(page, SIDEBAR)).w
  await dragTo(page, from, 150)
  await release(page, 150)
  await page.sleep(400)
  await page.hover(60, 300)
  await page.sleep(400)
  const gap = await page.evaluate(`(() => {
    const t = document.querySelector(${JSON.stringify(`${SIDEBAR} [data-slot="sidebar-toggle"]`)}).getBoundingClientRect();
    const s = document.querySelector(${JSON.stringify(`${SIDEBAR} button[aria-label="Search"]`)}).getBoundingClientRect();
    return { gap: s.left - t.right, opacity: getComputedStyle(document.querySelector(${JSON.stringify(`${SIDEBAR} [data-slot="sidebar-toggle"]`)})).opacity };
  })()`)
  check(
    gap.gap >= MIN_GAP && gap.opacity === "1",
    `${tag} at the narrowest width the revealed toggle sits ${gap.gap}px from Search, not in a run of three icons`
  )
  await capture(page, "sidebar-narrowest-header.png", {
    x: 0,
    y: 0,
    width: 320,
    height: 120,
  })
  check(
    (await stored(page, WIDTH_KEY)) !== null,
    `${tag} the narrowest width is stored`
  )
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(WIDTH_KEY)})`)
}

export async function checkRound3({ browser, web, check, capture }) {
  const tag = "1440 round 3"
  const page = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  await reset(page, web)
  await keyboardCollapse({ page, check, tag })
  await bracketMidDrag({ page, check, tag })
  await pointerCancel({ page, check, tag })
  await narrowestHeader({ page, check, capture, tag })
  await page.close()
}
