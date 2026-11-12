import {
  TOAST_CORNER_ON_PHONES_PX,
  TOAST_CORNER_PX,
  TOAST_OFFSET_BOTTOM,
  TOAST_OFFSET_RIGHT,
  TOAST_PHONE_MAX_WIDTH_PX,
} from "@workspace/ui/lib/toast-offset"

export const TOAST_CLEARANCE_GAP_PX = 8

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

export type ToastSpot = { right: number; bottom: number }

const covers = (a: ToastBox, b: ToastBox) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

export function toastBoxAt(room: ToastRoom, spot: ToastSpot): ToastBox {
  return {
    left: room.viewport.width - spot.right - room.toast.width,
    top: room.viewport.height - spot.bottom - room.toast.height,
    width: room.toast.width,
    height: room.toast.height,
  }
}

function liftedClear(room: ToastRoom, right: number): ToastSpot {
  let spot = { right, bottom: room.corner }
  for (;;) {
    const box = toastBoxAt(room, spot)
    const under = room.obstacles.filter((obstacle) => covers(box, obstacle))
    if (!under.length || box.top < 0) return spot
    spot = {
      right,
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

export function toastSpot(room: ToastRoom): ToastSpot {
  const shown = {
    ...room,
    obstacles: [
      ...room.obstacles.filter((box) => box.width > 0 && box.height > 0),
      pageHeaderRow(room),
    ],
  }
  const besideEach = room.obstacles.map(
    (box) => room.viewport.width - box.left + TOAST_CLEARANCE_GAP_PX
  )
  const rights = [...new Set([room.corner, ...besideEach])]
    .filter((right) => right >= room.corner)
    .sort((a, b) => a - b)
  const spots = rights.map((right) => liftedClear(shown, right))
  const free = spots.find((spot) => {
    const box = toastBoxAt(shown, spot)
    return (
      box.left >= room.corner &&
      box.top >= 0 &&
      !shown.obstacles.some((obstacle) => covers(box, obstacle))
    )
  })
  if (free) return free
  return {
    right: room.corner,
    bottom: Math.min(
      spots[0]?.bottom ?? room.corner,
      room.viewport.height - room.toast.height
    ),
  }
}

const obstacles = new Set<HTMLElement>()
let pageFrame: HTMLElement | null = null
let toastsShown = false
let lastToast = { width: 0, height: 0 }
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
  if (toasts.length) {
    lastToast = {
      width: Math.max(...toasts.map((box) => box.width)),
      height: Math.max(...toasts.map((box) => box.height)),
    }
  }
  return phone
    ? { ...lastToast, width: viewportWidth - 2 * TOAST_CORNER_ON_PHONES_PX }
    : lastToast
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
    return
  }
  const viewport = { width: root.clientWidth, height: root.clientHeight }
  const phone = viewport.width <= TOAST_PHONE_MAX_WIDTH_PX
  const toasts = shownToasts()
  const appearing = toasts.length > 0 && !toastsShown
  toastsShown = toasts.length > 0
  const spot = toastSpot({
    viewport,
    toast: toastSize(toasts, phone, viewport.width),
    corner: phone ? TOAST_CORNER_ON_PHONES_PX : TOAST_CORNER_PX,
    pageTop: pageFrame?.getBoundingClientRect().top ?? 0,
    obstacles: [...obstacles].map((element) => element.getBoundingClientRect()),
  })
  if (appearing) appearInPlace(document.querySelector("[data-sonner-toaster]"))
  root.style.setProperty(TOAST_OFFSET_BOTTOM, `${spot.bottom}px`)
  root.style.setProperty(TOAST_OFFSET_RIGHT, `${spot.right}px`)
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
