import {
  COLLAPSED_KEY,
  FRAME,
  GUTTER,
  HANDLE,
  rectOf,
  SIDEBAR,
  WIDTH_KEY,
} from "./sidebar-resize-shared.mjs"

export async function cancelledDrag({ page, check, tag }) {
  const before = (await rectOf(page, SIDEBAR)).w
  const box = await rectOf(page, SIDEBAR)
  await page.hover(box.r, 300)
  await page.mouse("mousePressed", box.r, 300)
  await page.mouse("mouseMoved", box.r + 60, 300)
  await page.sleep(100)
  const during = (await rectOf(page, SIDEBAR)).w
  await page.evaluate(
    `document.querySelector(${JSON.stringify(HANDLE)}).dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1, pointerType: 'mouse' }))`
  )
  await page.sleep(150)
  const after = await page.evaluate(
    `({ w: document.querySelector(${JSON.stringify(SIDEBAR)}).getBoundingClientRect().width, resizing: document.querySelector(${JSON.stringify(FRAME)}).dataset.resizing, select: document.body.style.userSelect, cursor: document.body.style.cursor, now: document.querySelector(${JSON.stringify(HANDLE)}).getAttribute('aria-valuenow'), stored: localStorage.getItem(${JSON.stringify(WIDTH_KEY)}) })`
  )
  await page.mouse("mouseMoved", box.r + 100, 300)
  await page.sleep(100)
  const later = (await rectOf(page, SIDEBAR)).w
  await page.mouse("mouseReleased", box.r + 100, 300)
  await page.sleep(150)
  check(
    during === before + 60 &&
      after.w === before &&
      later === before &&
      after.resizing === undefined &&
      after.select === "" &&
      after.cursor === "" &&
      after.now === String(before),
    `${tag} a cancelled drag restores the start width and leaves nothing stuck (${before} -> ${during} -> ${after.w}, later ${later})`
  )
  check(
    after.stored === "244" || after.stored === String(before),
    `${tag} a cancelled drag saves nothing new (${after.stored})`
  )
}

export async function overDragPreview({ page, check, capture, tag }) {
  const box = await rectOf(page, SIDEBAR)
  await page.hover(box.r, 300)
  await page.mouse("mousePressed", box.r, 300)
  await page.mouse("mouseMoved", box.r - 60, 300)
  await page.mouse("mouseMoved", 100, 300)
  await page.sleep(500)
  const preview = await page.evaluate(
    `({ preview: document.querySelector(${JSON.stringify(FRAME)}).dataset.collapsePreview, state: document.querySelector(${JSON.stringify(FRAME)}).dataset.state, right: document.querySelector(${JSON.stringify(SIDEBAR)}).getBoundingClientRect().right, stored: localStorage.getItem(${JSON.stringify(COLLAPSED_KEY)}), frame: document.querySelector(${JSON.stringify(FRAME)}).getBoundingClientRect().width })`
  )
  check(
    preview.preview === "true" &&
      preview.state === "open" &&
      preview.right <= 0 &&
      preview.frame <= GUTTER + 1 &&
      preview.stored === "0",
    `${tag} dragging below the threshold previews the collapse and saves nothing yet (right ${preview.right}, frame ${preview.frame}, collapsed ${preview.stored})`
  )
  await capture(page, "sidebar-overdrag-preview.png")
  await page.mouse("mouseMoved", 300, 300)
  await page.sleep(500)
  const back = await rectOf(page, SIDEBAR)
  const flag = await page.evaluate(
    `document.querySelector(${JSON.stringify(FRAME)}).dataset.collapsePreview ?? null`
  )
  check(
    flag === null && back.r > 200,
    `${tag} dragging back above the threshold undoes the preview (right ${back.r})`
  )
  await page.mouse("mouseMoved", 100, 300)
  await page.sleep(400)
  await page.mouse("mouseReleased", 100, 300)
  await page.sleep(500)
  const done = await page.evaluate(
    `({ state: document.querySelector(${JSON.stringify(FRAME)}).dataset.state, stored: localStorage.getItem(${JSON.stringify(COLLAPSED_KEY)}), preview: document.querySelector(${JSON.stringify(FRAME)}).dataset.collapsePreview ?? null })`
  )
  check(
    done.state === "collapsed" && done.stored === "1" && done.preview === null,
    `${tag} releasing below the threshold collapses and saves it (${done.state}, ${done.stored})`
  )
}
