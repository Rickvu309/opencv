import type { PagePoint } from "@workspace/paper-engine"

export type PointerSink = {
  pointAt(clientX: number, clientY: number): PagePoint | null
  press(point: PagePoint, clicks: number, extend: boolean): void
  drag(point: PagePoint): void
  focus(): void
}

const MULTI_CLICK_MS = 500
const MULTI_CLICK_PX = 4
const TAP_SLOP_PX = 8

export function attachPointer(surface: HTMLElement, sink: PointerSink) {
  let clicks = 0
  let lastDown = { at: -Infinity, x: 0, y: 0 }
  let dragging: number | null = null
  let touch: { id: number; x: number; y: number } | null = null

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (event.pointerType !== "mouse") {
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY }
      return
    }
    event.preventDefault()
    const near =
      event.timeStamp - lastDown.at < MULTI_CLICK_MS &&
      Math.abs(event.clientX - lastDown.x) <= MULTI_CLICK_PX &&
      Math.abs(event.clientY - lastDown.y) <= MULTI_CLICK_PX
    clicks = near ? (clicks % 3) + 1 : 1
    lastDown = { at: event.timeStamp, x: event.clientX, y: event.clientY }
    sink.focus()
    const point = sink.pointAt(event.clientX, event.clientY)
    if (!point) return
    sink.press(point, clicks, event.shiftKey)
    if (clicks === 1) {
      dragging = event.pointerId
      surface.setPointerCapture(event.pointerId)
    }
  }

  const onMove = (event: PointerEvent) => {
    if (dragging !== event.pointerId) return
    const point = sink.pointAt(event.clientX, event.clientY)
    if (point) sink.drag(point)
  }

  const onUp = (event: PointerEvent) => {
    if (dragging === event.pointerId) {
      dragging = null
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId)
      return
    }
    if (!touch || touch.id !== event.pointerId) return
    const moved =
      Math.abs(event.clientX - touch.x) > TAP_SLOP_PX ||
      Math.abs(event.clientY - touch.y) > TAP_SLOP_PX
    touch = null
    if (moved) return
    sink.focus()
    const point = sink.pointAt(event.clientX, event.clientY)
    if (point) sink.press(point, 1, false)
  }

  const onCancel = () => {
    dragging = null
    touch = null
  }

  surface.addEventListener("pointerdown", onDown)
  surface.addEventListener("pointermove", onMove)
  surface.addEventListener("pointerup", onUp)
  surface.addEventListener("pointercancel", onCancel)
  return () => {
    surface.removeEventListener("pointerdown", onDown)
    surface.removeEventListener("pointermove", onMove)
    surface.removeEventListener("pointerup", onUp)
    surface.removeEventListener("pointercancel", onCancel)
  }
}
