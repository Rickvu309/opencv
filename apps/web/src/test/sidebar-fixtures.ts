import { fireEvent, screen } from "@testing-library/react"
import { vi } from "vitest"

import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"

const frames: FrameRequestCallback[] = []

export function flushFrames() {
  frames.splice(0).forEach((run) => run(0))
}

export function frameCount() {
  return frames.length
}

export function stubPointerApis() {
  frames.length = 0
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    frames.push(run)
    return frames.length
  })
  vi.stubGlobal("cancelAnimationFrame", () => {})
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => true)
}

export async function renderShell() {
  stubDesktopViewport(true)
  const view = renderApp(SURFACE_PATHS.coach)
  const handle = await screen.findByRole("separator", {
    name: "Resize sidebar",
  })
  return { handle, router: view.router }
}

export function frame() {
  return document.querySelector<HTMLElement>('[data-slot="sidebar-frame"]')!
}

export function aside() {
  return screen.getByRole("complementary", { hidden: true })
}

export function drag(handle: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(handle, { clientX: from, button: 0, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientX: to, pointerId: 1 })
  flushFrames()
  fireEvent.pointerUp(handle, { clientX: to, pointerId: 1 })
}

export function mouse(extra: object = {}) {
  return { pointerType: "mouse", ...extra }
}
