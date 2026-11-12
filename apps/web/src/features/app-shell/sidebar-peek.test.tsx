import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"

import { resetShellApiMock } from "@/test/shell-api-mock.ts"
import {
  aside,
  drag,
  frame,
  mouse,
  renderShell,
  stubPointerApis,
} from "@/test/sidebar-fixtures.ts"

beforeEach(() => {
  stubPointerApis()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  resetShellApiMock()
  localStorage.clear()
  vi.unstubAllGlobals()
})

async function collapsedShell() {
  const { handle, router } = await renderShell()
  drag(handle, 244, 100)
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  return router
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function zone() {
  return document.querySelector<HTMLElement>('[data-slot="sidebar-peek-zone"]')!
}

function enterEdge() {
  fireEvent.pointerEnter(zone(), mouse())
}

function leaveFrame() {
  fireEvent.pointerLeave(zone(), mouse())
  fireEvent.pointerLeave(aside(), mouse())
}

function openPeek() {
  enterEdge()
  advance(150)
  expect(aside()).toHaveAttribute("data-peek", "true")
  fireEvent.pointerEnter(aside(), mouse())
}

describe("peek hover intent", () => {
  it("opens only after the pointer rests on the edge for 150 ms", async () => {
    await collapsedShell()
    enterEdge()
    advance(149)
    expect(aside()).toHaveAttribute("data-peek", "false")
    advance(1)
    expect(aside()).toHaveAttribute("data-peek", "true")
    expect(aside()).not.toHaveAttribute("inert")
    fireEvent.pointerEnter(aside(), mouse())
    advance(2000)
    expect(aside()).toHaveAttribute("data-peek", "true")
  })

  it("stays open while the pointer rests on the edge", async () => {
    await collapsedShell()
    enterEdge()
    advance(150)
    advance(5000)
    expect(aside()).toHaveAttribute("data-peek", "true")
    fireEvent.pointerLeave(zone(), mouse())
    advance(300)
    expect(aside()).toHaveAttribute("data-peek", "false")
  })

  it("does not open when the pointer sweeps past the edge", async () => {
    await collapsedShell()
    enterEdge()
    advance(80)
    leaveFrame()
    advance(1000)
    expect(aside()).toHaveAttribute("data-peek", "false")
    expect(aside()).toHaveAttribute("inert")
  })

  it("ignores touch and pen pointers", async () => {
    await collapsedShell()
    fireEvent.pointerEnter(zone(), { pointerType: "touch" })
    advance(1000)
    expect(aside()).toHaveAttribute("data-peek", "false")
  })

  it("stays collapsed behind the peek", async () => {
    await collapsedShell()
    openPeek()
    expect(frame()).toHaveAttribute("data-state", "collapsed")
  })
})

describe("peek close grace", () => {
  it("closes 300 ms after the pointer leaves", async () => {
    await collapsedShell()
    openPeek()
    leaveFrame()
    advance(299)
    expect(aside()).toHaveAttribute("data-peek", "true")
    advance(1)
    expect(aside()).toHaveAttribute("data-peek", "false")
    expect(aside()).toHaveAttribute("inert")
  })

  it("stays open when the pointer comes back inside the grace", async () => {
    await collapsedShell()
    openPeek()
    leaveFrame()
    advance(200)
    enterEdge()
    advance(2000)
    expect(aside()).toHaveAttribute("data-peek", "true")
  })

  it("closes after a fast pass that never touched the panel", async () => {
    await collapsedShell()
    openPeek()
    leaveFrame()
    advance(300)
    expect(aside()).toHaveAttribute("data-peek", "false")
  })
})

describe("peek never gets stuck", () => {
  it("closes on Escape and moves focus from the panel to the page", async () => {
    await collapsedShell()
    openPeek()
    screen.getByRole("link", { name: /^Coach/ }).focus()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(aside()).toHaveAttribute("data-peek", "false")
    expect(
      document.querySelector('#app-main [data-slot="sidebar-expand"]')
    ).toHaveFocus()
  })

  it("closes on Escape without taking focus from the page", async () => {
    await collapsedShell()
    openPeek()
    const button = document.createElement("button")
    document.getElementById("app-main")!.append(button)
    button.focus()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(aside()).toHaveAttribute("data-peek", "false")
    expect(button).toHaveFocus()
  })

  it("closes when the window loses focus", async () => {
    await collapsedShell()
    openPeek()
    act(() => {
      window.dispatchEvent(new Event("blur"))
    })
    expect(aside()).toHaveAttribute("data-peek", "false")
  })

  it("closes when the tab is hidden", async () => {
    await collapsedShell()
    openPeek()
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(aside()).toHaveAttribute("data-peek", "false")
  })

  it("closes when the pointer leaves the window", async () => {
    await collapsedShell()
    openPeek()
    act(() => {
      document.documentElement.dispatchEvent(new Event("pointerleave"))
    })
    expect(aside()).toHaveAttribute("data-peek", "false")
  })

  it("closes when the page is pressed", async () => {
    await collapsedShell()
    openPeek()
    fireEvent.pointerDown(document.getElementById("app-main")!)
    expect(aside()).toHaveAttribute("data-peek", "false")
  })

  it("stays open when the panel itself is pressed", async () => {
    await collapsedShell()
    openPeek()
    fireEvent.pointerDown(screen.getByRole("link", { name: /^Coach/ }))
    expect(aside()).toHaveAttribute("data-peek", "true")
  })
})

describe("peek navigation", () => {
  it("navigates from a link in the panel and closes the panel", async () => {
    const router = await collapsedShell()
    openPeek()
    const link = screen.getByRole("link", { name: /^Apply/ })
    link.focus()
    vi.useRealTimers()
    fireEvent.click(link)
    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe("/apply")
    })
    expect(aside()).toHaveAttribute("data-peek", "false")
    expect(document.activeElement).not.toBe(document.body)
  })

  it("expands with [ from the panel and keeps focus in the panel", async () => {
    await collapsedShell()
    openPeek()
    const link = screen.getByRole("link", { name: /^Coach/ })
    link.focus()
    fireEvent.keyDown(window, { key: "[" })
    expect(frame()).toHaveAttribute("data-state", "open")
    expect(link).toHaveFocus()
  })
})
