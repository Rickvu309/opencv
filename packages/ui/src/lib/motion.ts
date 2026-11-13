export type MotionKind = "micro" | "panel"

export type MotionTiming = { duration: number; easing: string }

const REDUCE = "(prefers-reduced-motion: reduce)"

function rootStyle() {
  return getComputedStyle(document.documentElement)
}

function milliseconds(value: string) {
  const amount = Number.parseFloat(value)
  if (!Number.isFinite(amount)) return 0
  return value.trim().endsWith("ms") ? amount : amount * 1000
}

export function motionToken(kind: MotionKind): MotionTiming {
  const style = rootStyle()
  return {
    duration: milliseconds(style.getPropertyValue(`--duration-${kind}`)),
    easing: style.getPropertyValue(`--ease-${kind}`).trim(),
  }
}

export function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" && window.matchMedia(REDUCE).matches
  )
}

export function travelToken(kind: MotionKind): MotionTiming {
  const token = motionToken(kind)
  return prefersReducedMotion() ? { ...token, duration: 0 } : token
}

function enterScale() {
  const value = Number.parseFloat(
    rootStyle().getPropertyValue("--motion-enter-scale")
  )
  return Number.isFinite(value) ? value : 1
}

export function leaveKeyframes(): Keyframe[] {
  if (prefersReducedMotion()) return [{ opacity: 1 }, { opacity: 0 }]
  return [
    { opacity: 1, scale: "1" },
    { opacity: 0, scale: String(enterScale()) },
  ]
}

export function motionLeave(element: Element): Promise<void> {
  const { duration, easing } = motionToken("micro")
  if (duration <= 0 || typeof element.animate !== "function")
    return Promise.resolve()
  const animation = element.animate(leaveKeyframes(), {
    duration,
    easing,
    fill: "forwards",
  })
  return animation.finished.then(
    () => undefined,
    () => undefined
  )
}
