import { useLayoutEffect, type RefObject } from "react"

import {
  motionToken,
  prefersReducedMotion,
  type MotionTiming,
} from "@workspace/ui/lib/motion"

const INTERRUPTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const

export function cubicBezierFrom(easing: string) {
  const points = easing.match(/-?\d*\.?\d+/g)?.map(Number) ?? []
  if (!easing.startsWith("cubic-bezier(") || points.length !== 4) return null
  const [x1, y1, x2, y2] = points as [number, number, number, number]
  const curve = (a: number, b: number, t: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3
  return (progress: number) => {
    let low = 0
    let high = 1
    for (let step = 0; step < 24; step++) {
      const mid = (low + high) / 2
      if (curve(x1, x2, mid) < progress) low = mid
      else high = mid
    }
    return curve(y1, y2, (low + high) / 2)
  }
}

function topOf(args: unknown[]) {
  const [first, second] = args
  if (typeof first === "number" && typeof second === "number") return second
  if (first && typeof first === "object" && "top" in first) {
    const top = (first as ScrollToOptions).top
    return typeof top === "number" ? top : null
  }
  return null
}

export function glideViewport(viewport: HTMLElement, timing: MotionTiming) {
  const ease = cubicBezierFrom(timing.easing)
  if (!ease || timing.duration <= 0) return () => {}
  const start = viewport.scrollTop
  const began = performance.now()
  let target = start
  let frame = 0
  const glide = (...args: unknown[]) => {
    const top = topOf(args)
    if (top !== null) target = Math.max(0, top)
  }
  Object.defineProperty(viewport, "scrollTo", {
    configurable: true,
    value: glide,
  })
  const settle = () => {
    cancelAnimationFrame(frame)
    for (const type of INTERRUPTS) viewport.removeEventListener(type, settle)
    Reflect.deleteProperty(viewport, "scrollTo")
  }
  const release = () => {
    settle()
    viewport.scrollTop = target
  }
  const step = (now: number) => {
    const progress = Math.min(1, (now - began) / timing.duration)
    viewport.scrollTop = start + (target - start) * ease(progress)
    if (progress < 1) frame = requestAnimationFrame(step)
    else release()
  }
  for (const type of INTERRUPTS)
    viewport.addEventListener(type, settle, { passive: true })
  frame = requestAnimationFrame(step)
  return settle
}

export function useSendGlide(
  content: RefObject<HTMLElement | null>,
  sendKey: string | null
) {
  useLayoutEffect(() => {
    const viewport = content.current?.parentElement
    if (!sendKey || !viewport || prefersReducedMotion()) return
    glideViewport(viewport, motionToken("panel"))
  }, [content, sendKey])
}
