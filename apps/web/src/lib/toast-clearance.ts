import {
  TOAST_CORNER_ON_PHONES_PX,
  TOAST_CORNER_PX,
  TOAST_MAX_WIDTH,
  TOAST_OFFSET_BOTTOM,
  TOAST_OFFSET_RIGHT,
  TOAST_PHONE_MAX_WIDTH_PX,
  TOAST_WIDTH_PX,
} from "@workspace/ui/lib/toast-offset"

export const TOAST_CLEARANCE_GAP_PX = 8
export const TOAST_MIN_WIDTH_PX = 280

export type ToastBox = {
  left: number
  top: number
  width: number
  height: number
}

export type ToastRoom = {
  viewport: { width: number; height: number }
  toast: { width: number; height: number }
  corner: number
  pageTop: number
  obstacles: readonly ToastBox[]
}

export type ToastSpot = { right: number; bottom: number; width: number }

const covers = (a: ToastBox, b: ToastBox) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

const holds = (outer: ToastBox, inner: ToastBox) =>
  outer !== inner &&
  inner.left >= outer.left &&
  inner.top >= outer.top &&
  inner.left + inner.width <= outer.left + outer.width &&
  inner.top + inner.height <= outer.top + outer.height

export function toastBoxAt(room: ToastRoom, spot: ToastSpot): ToastBox {
  const height = wrappedHeight(room, spot.width)
  return {
    left: room.viewport.width - spot.right - spot.width,
    top: room.viewport.height - spot.bottom - height,
    width: spot.width,
    height,
  }
}

function wrappedHeight(room: ToastRoom, width: number) {
  return width >= room.toast.width
    ? room.toast.height
    : Math.ceil((room.toast.height * room.toast.width) / width)
}

function liftedClear(
  room: ToastRoom,
  keepClear: readonly ToastBox[],
  right: number,
  width: number
): ToastSpot {
  let spot = { right, bottom: room.corner, width }
  for (;;) {
    const box = toastBoxAt(room, spot)
    const under = keepClear.filter((obstacle) => covers(box, obstacle))
    if (!under.length || box.top < 0) return spot
    spot = {
      right,
      width,
      bottom:
        room.viewport.height -
        Math.min(...under.map((obstacle) => obstacle.top)) +
        TOAST_CLEARANCE_GAP_PX,
    }
  }
}

function pageHeaderRow(room: ToastRoom): ToastBox {
  return {
    left: 0,
    top: 0,
    width: room.viewport.width,
    height: room.pageTop + room.toast.height,
  }
}

function headerRowOf(room: ToastRoom, area: ToastBox): ToastBox {
  return { ...area, height: room.toast.height }
}

function besideSpots(room: ToastRoom, shown: readonly ToastBox[]) {
  const full = [
    room.corner,
    ...shown.map(
      (box) => room.viewport.width - box.left + TOAST_CLEARANCE_GAP_PX
    ),
  ]
    .filter((right) => right >= room.corner)
    .map((right) => ({ right, width: room.toast.width }))
  const narrowed = shown
    .map((box) => ({
      right: room.viewport.width - box.left + TOAST_CLEARANCE_GAP_PX,
      width: Math.min(
        room.toast.width,
        box.left - TOAST_CLEARANCE_GAP_PX - room.corner
      ),
    }))
    .filter(({ width }) => width >= TOAST_MIN_WIDTH_PX)
    .sort((a, b) => a.right - b.right)
  return [...full.sort((a, b) => a.right - b.right), ...narrowed]
}

function insideSpots(
  room: ToastRoom,
  shown: readonly ToastBox[],
  pageHeader: ToastBox
) {
  return shown
    .filter((area) => shown.some((inner) => holds(area, inner)))
    .map((area) => {
      const width = Math.min(
        room.toast.width,
        area.width - 2 * TOAST_CLEARANCE_GAP_PX
      )
      const keepClear = [
        ...shown.filter((box) => box !== area),
        headerRowOf(room, area),
        pageHeader,
      ]
      const right =
        room.viewport.width - area.left - area.width + TOAST_CLEARANCE_GAP_PX
      const spot = liftedClear(room, keepClear, right, width)
      return { spot, keepClear, area }
    })
    .filter(
      ({ spot, area }) =>
        spot.width >= TOAST_MIN_WIDTH_PX &&
        toastBoxAt(room, spot).top >= area.top
    )
}

function fitsAt(
  room: ToastRoom,
  spot: ToastSpot,
  keepClear: readonly ToastBox[]
) {
  const box = toastBoxAt(room, spot)
  return (
    box.left >= room.corner &&
    box.top >= 0 &&
    !keepClear.some((obstacle) => covers(box, obstacle))
  )
}

export function toastSpot(room: ToastRoom): ToastSpot {
  const shown = room.obstacles.filter((box) => box.width > 0 && box.height > 0)
  const pageHeader = pageHeaderRow(room)
  const keepClear = [...shown, pageHeader]
  const beside = besideSpots(room, shown).map(({ right, width }) =>
    liftedClear(room, keepClear, right, width)
  )
  const free = beside.find((spot) => fitsAt(room, spot, keepClear))
  if (free) return free
  const inside = insideSpots(room, shown, pageHeader).find(
    ({ spot, keepClear: clearOfInside }) => fitsAt(room, spot, clearOfInside)
  )
  if (inside) return inside.spot
  return {
    right: room.corner,
    width: room.toast.width,
    bottom: Math.max(
      room.corner,
      Math.min(
        beside[0]?.bottom ?? room.corner,
        room.viewport.height - room.pageTop - 2 * room.toast.height
      )
    ),
  }
}

const obstacles = new Set<HTMLElement>()
let pageFrame: HTMLElement | null = null
let toastsShown = false
let lastHeight = 0
let watcher: ResizeObserver | null = null
let toastWatcher: MutationObserver | null = null

function shownToasts() {
  return [...document.querySelectorAll("[data-sonner-toast]")].map((element) =>
    element.getBoundingClientRect()
  )
}

function toastSize(
  toasts: readonly DOMRect[],
  phone: boolean,
  viewportWidth: number
) {
  if (toasts.length) lastHeight = Math.max(...toasts.map((box) => box.height))
  return {
    width: phone
      ? viewportWidth - 2 * TOAST_CORNER_ON_PHONES_PX
      : TOAST_WIDTH_PX,
    height: lastHeight,
  }
}

function appearInPlace(toaster: Element | null) {
  if (!(toaster instanceof HTMLElement)) return
  toaster.style.setProperty("transition-property", "none", "important")
  void toaster.offsetHeight
  requestAnimationFrame(() =>
    toaster.style.removeProperty("transition-property")
  )
}

function placeToasts() {
  const root = document.documentElement
  if (!obstacles.size && !pageFrame) {
    root.style.removeProperty(TOAST_OFFSET_BOTTOM)
    root.style.removeProperty(TOAST_OFFSET_RIGHT)
    root.style.removeProperty(TOAST_MAX_WIDTH)
    return
  }
  const viewport = { width: root.clientWidth, height: root.clientHeight }
  const phone = viewport.width <= TOAST_PHONE_MAX_WIDTH_PX
  const toasts = shownToasts()
  const appearing = toasts.length > 0 && !toastsShown
  toastsShown = toasts.length > 0
  const toast = toastSize(toasts, phone, viewport.width)
  const spot = toastSpot({
    viewport,
    toast,
    corner: phone ? TOAST_CORNER_ON_PHONES_PX : TOAST_CORNER_PX,
    pageTop: pageFrame?.getBoundingClientRect().top ?? 0,
    obstacles: [...obstacles].map((element) => element.getBoundingClientRect()),
  })
  if (appearing) appearInPlace(document.querySelector("[data-sonner-toaster]"))
  root.style.setProperty(TOAST_OFFSET_BOTTOM, `${spot.bottom}px`)
  root.style.setProperty(TOAST_OFFSET_RIGHT, `${spot.right}px`)
  if (spot.width < toast.width)
    root.style.setProperty(TOAST_MAX_WIDTH, `${spot.width}px`)
  else root.style.removeProperty(TOAST_MAX_WIDTH)
}

function watched() {
  return obstacles.size + (pageFrame ? 1 : 0)
}

function startWatching() {
  window.addEventListener("resize", placeToasts)
  watcher =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(placeToasts)
}

function stopWatching() {
  window.removeEventListener("resize", placeToasts)
  watcher?.disconnect()
  watcher = null
}

function watch(element: HTMLElement) {
  if (!watched()) startWatching()
  watcher?.observe(element)
}

function unwatch(element: HTMLElement) {
  watcher?.unobserve(element)
  if (!watched()) stopWatching()
  placeToasts()
}

export function keepToastsClearOf(
  element: HTMLElement | null
): (() => void) | undefined {
  if (!element) return undefined
  watch(element)
  obstacles.add(element)
  placeToasts()
  return () => {
    obstacles.delete(element)
    unwatch(element)
  }
}

export function keepToastsBelowPageHeaderOf(
  frame: HTMLElement | null
): (() => void) | undefined {
  if (!frame) return undefined
  watch(frame)
  pageFrame = frame
  placeToasts()
  return () => {
    if (pageFrame === frame) pageFrame = null
    unwatch(frame)
  }
}

export function placeToastsAsTheyShow(
  host: HTMLElement | null
): (() => void) | undefined {
  if (!host || typeof MutationObserver === "undefined") return undefined
  toastWatcher?.disconnect()
  toastWatcher = new MutationObserver(placeToasts)
  toastWatcher.observe(host, { childList: true, subtree: true })
  return () => {
    toastWatcher?.disconnect()
    toastWatcher = null
  }
}
