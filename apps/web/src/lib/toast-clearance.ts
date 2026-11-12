import { TOAST_OFFSET_BOTTOM } from "@workspace/ui/lib/toast-offset"

export const TOAST_CLEARANCE_GAP_PX = 8

const obstacles = new Set<HTMLElement>()
let watcher: ResizeObserver | null = null

export function toastClearance(
  viewportHeight: number,
  obstacleBoxes: readonly { top: number; height: number }[]
): number | null {
  const shown = obstacleBoxes.filter((box) => box.height > 0)
  if (!shown.length) return null
  return (
    Math.max(...shown.map((box) => viewportHeight - box.top)) +
    TOAST_CLEARANCE_GAP_PX
  )
}

function placeToasts() {
  const root = document.documentElement
  const clearance = toastClearance(
    root.clientHeight,
    [...obstacles].map((element) => element.getBoundingClientRect())
  )
  if (clearance === null) root.style.removeProperty(TOAST_OFFSET_BOTTOM)
  else root.style.setProperty(TOAST_OFFSET_BOTTOM, `${clearance}px`)
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

export function keepToastsClearOf(
  element: HTMLElement | null
): (() => void) | undefined {
  if (!element) return undefined
  if (!obstacles.size) startWatching()
  obstacles.add(element)
  watcher?.observe(element)
  placeToasts()
  return () => {
    obstacles.delete(element)
    watcher?.unobserve(element)
    if (!obstacles.size) stopWatching()
    placeToasts()
  }
}
