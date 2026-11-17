import {
  motionToken,
  travelToken,
  type MotionTiming,
} from "@workspace/ui/lib/motion"

const SHELL_MAIN = '[data-slot="shell-main"]'
const PAGE = "#app-main"
const RIDERS = '[data-slot="shell-coach"]'
const FOLLOW = "sidebar-follow"

export function sidebarTravel(hiding: boolean): MotionTiming {
  return {
    duration: travelToken(hiding ? "micro" : "panel").duration,
    easing: motionToken("panel").easing,
  }
}

export function followOffset(before: number | null, after: number | null) {
  if (before === null || after === null) return 0
  return Math.round(before - after)
}

function pageLeft(main: Element) {
  return main.querySelector(PAGE)?.getBoundingClientRect().left ?? null
}

function fixedRiders(main: Element) {
  return [...main.querySelectorAll<HTMLElement>(RIDERS)].filter(
    (rider) => getComputedStyle(rider).position === "fixed"
  )
}

function stopFollowing(elements: HTMLElement[]) {
  for (const element of elements) {
    if (typeof element.getAnimations !== "function") continue
    for (const animation of element.getAnimations()) {
      if (animation.id === FOLLOW) animation.cancel()
    }
  }
}

function slide(element: HTMLElement, from: number, timing: MotionTiming) {
  if (typeof element.animate !== "function") return
  element.animate(
    [{ transform: `translateX(${from}px)` }, { transform: "none" }],
    { ...timing, id: FOLLOW }
  )
}

export function settleSidebar() {
  const main = document.querySelector<HTMLElement>(SHELL_MAIN)
  if (main) stopFollowing([main, ...fixedRiders(main)])
}

export function followSidebar(hiding: boolean, change: () => void) {
  const main = document.querySelector<HTMLElement>(SHELL_MAIN)
  const before = main ? pageLeft(main) : null
  change()
  if (!main) return
  const riders = fixedRiders(main)
  stopFollowing([main, ...riders])
  const offset = followOffset(before, pageLeft(main))
  const timing = sidebarTravel(hiding)
  if (offset === 0 || timing.duration <= 0) return
  slide(main, offset, timing)
  for (const rider of riders) slide(rider, -offset, timing)
}
