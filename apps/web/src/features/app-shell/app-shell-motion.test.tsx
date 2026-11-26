import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"
import "@/test/warm-routes.ts"
import { resetShellApiMock } from "@/test/shell-api-mock.ts"

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  resetShellApiMock()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe("shell motion", () => {
  it("keeps the phone drawer through its exit, then leaves nothing to catch a click", async () => {
    let release = () => {}
    const finished = new Promise<void>((resolve) => {
      release = resolve
    })
    const animation = {
      finished,
      pending: true,
      playState: "running",
      effect: { getTiming: () => ({ duration: 280, iterations: 1 }) },
    }
    const prototype = Element.prototype as Element & {
      getAnimations?: (options?: GetAnimationsOptions) => Animation[]
    }
    const hadGetAnimations = typeof prototype.getAnimations === "function"
    if (!hadGetAnimations) {
      prototype.getAnimations = () => []
    }
    const animations = vi
      .spyOn(prototype, "getAnimations")
      .mockReturnValue([animation as unknown as Animation])
    const nextFrame = () =>
      act(async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        })
      })
    try {
      stubDesktopViewport(false)
      renderApp(SURFACE_PATHS.pitch)
      const menu = await screen.findByRole("button", { name: "Menu" })
      fireEvent.click(menu)
      const dialog = await screen.findByRole("dialog")
      expect(dialog.className).toContain("motion-sheet-start")
      expect(dialog.className).not.toMatch(/duration-|ease-\[|transition-all/)
      fireEvent.keyDown(document, { key: "Escape" })
      expect(dialog).toHaveAttribute("data-ending-style")
      expect(dialog.className).toContain("data-closed:pointer-events-none")
      expect(menu).toHaveFocus()
      fireEvent.click(menu)
      await nextFrame()
      expect(dialog).not.toHaveAttribute("data-ending-style")
      expect(screen.getByRole("dialog")).toBe(dialog)
      fireEvent.keyDown(document, { key: "Escape" })
      expect(dialog).toHaveAttribute("data-ending-style")
      release()
      animation.pending = false
      animation.playState = "finished"
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull()
      })
      expect(document.querySelector("[data-slot=dialog-overlay]")).toBeNull()
      expect(document.querySelector("[data-slot=dialog-content]")).toBeNull()
      expect(menu).toHaveFocus()
      menu.focus()
      expect(document.activeElement).toBe(menu)
    } finally {
      animations.mockRestore()
      if (!hadGetAnimations) {
        Reflect.deleteProperty(prototype, "getAnimations")
      }
    }
  })

  it("slides the Coach panel out, reverses when opened again, then leaves the page clear", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.paper)
    const coach = await screen.findByRole("button", { name: "Coach" })
    fireEvent.click(coach)
    const panel = await screen.findByRole("region", { name: "Coach" })
    const frame = document.getElementById("coach-panel") as HTMLElement
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }))
    expect(frame).toHaveAttribute("data-closing")
    expect(frame).not.toHaveAttribute("hidden")
    expect(frame.className).toContain("pointer-events-none")
    expect(frame).toHaveAttribute("inert")
    expect(coach).toHaveFocus()
    fireEvent.click(coach)
    expect(frame).not.toHaveAttribute("data-closing")
    expect(frame).not.toHaveAttribute("hidden")
    expect(screen.getByRole("region", { name: "Coach" })).toBe(panel)
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }))
    act(() => {
      frame.dispatchEvent(
        new TransitionEvent("transitionend", {
          propertyName: "translate",
          bubbles: true,
        })
      )
    })
    await waitFor(() => expect(frame).toHaveAttribute("hidden"))
    expect(screen.queryByRole("region", { name: "Coach" })).toBeNull()
    expect(frame).toHaveAttribute("inert")
    coach.focus()
    expect(document.activeElement).toBe(coach)
  })
})
