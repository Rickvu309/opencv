import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { resetShellApiMock } from "@/test/shell-api-mock.ts"
import {
  aside,
  drag,
  flushFrames,
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

function startDrag(handle: HTMLElement) {
  fireEvent.pointerDown(handle, { clientX: 244, button: 0, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientX: 304, pointerId: 1 })
  flushFrames()
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe("the sidebar mode while a drag is active", () => {
  it("reports dragging, then expanded after the release", async () => {
    const { handle } = await renderShell()
    expect(frame()).toHaveAttribute("data-mode", "expanded")
    startDrag(handle)
    expect(frame()).toHaveAttribute("data-mode", "dragging")
    fireEvent.pointerUp(handle, { clientX: 304, pointerId: 1 })
    expect(frame()).toHaveAttribute("data-mode", "expanded")
  })

  it("ignores [ so the gutter and the width cannot be lost", async () => {
    const { handle } = await renderShell()
    startDrag(handle)
    fireEvent.keyDown(window, { key: "[" })
    expect(frame()).toHaveAttribute("data-state", "open")
    expect(frame()).toHaveAttribute("data-mode", "dragging")
    expect(localStorage.getItem("opencv.sidebar.collapsed")).toBeNull()
    fireEvent.pointerUp(handle, { clientX: 304, pointerId: 1 })
    expect(frame()).toHaveAttribute("data-state", "open")
    expect(frame().style.getPropertyValue("--sidebar-width")).toBe("304px")
  })

  it("ignores Enter on the handle during a drag", async () => {
    const { handle } = await renderShell()
    startDrag(handle)
    fireEvent.keyDown(handle, { key: "Enter" })
    expect(frame()).toHaveAttribute("data-state", "open")
    fireEvent.pointerCancel(handle, { pointerId: 1 })
    expect(frame()).toHaveAttribute("data-mode", "expanded")
  })

  it("accepts [ again once the drag is cancelled", async () => {
    const { handle } = await renderShell()
    startDrag(handle)
    fireEvent.pointerCancel(handle, { pointerId: 1 })
    fireEvent.keyDown(window, { key: "[" })
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(frame()).toHaveAttribute("data-mode", "collapsed")
  })

  it("keeps the collapsed gutter in a class so an abandoned drag cannot erase it", async () => {
    const { handle } = await renderShell()
    drag(handle, 244, 100)
    expect(frame()).toHaveClass("w-9")
    expect(frame().style.width).toBe("")
    act(() => {
      window.dispatchEvent(new Event("blur"))
    })
    expect(frame()).toHaveClass("w-9")
    expect(frame()).toHaveAttribute("data-mode", "collapsed")
  })
})

describe("focus after a keyboard collapse", () => {
  async function keyboardCollapse() {
    await renderShell()
    screen.getByRole("link", { name: /^Coach/ }).focus()
    await userEvent.keyboard("[[")
    expect(document.getElementById("app-main")).toHaveFocus()
    expect(document.body).not.toHaveFocus()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  }

  it("does not take focus from the page when [ is pressed on the body", async () => {
    await renderShell()
    await userEvent.keyboard("[[")
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(document.body).toHaveFocus()
  })

  it("lets the first Escape close the peek", async () => {
    await keyboardCollapse()
    const zone = document.querySelector('[data-slot="sidebar-peek-zone"]')!
    fireEvent.pointerEnter(zone, mouse())
    advance(150)
    fireEvent.pointerEnter(aside(), mouse())
    expect(aside()).toHaveAttribute("data-peek", "true")
    fireEvent.keyDown(window, { key: "Escape" })
    expect(aside()).toHaveAttribute("data-peek", "false")
  })
})
