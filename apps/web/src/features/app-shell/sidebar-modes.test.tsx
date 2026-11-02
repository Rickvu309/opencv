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

function tooltip() {
  return document.querySelector('[data-slot="tooltip-content"]')
}

function expandButton() {
  return screen.getByRole("button", { name: "Expand sidebar" })
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

  it("ignores Enter on the handle and the collapse button during a drag", async () => {
    const { handle } = await renderShell()
    startDrag(handle)
    fireEvent.keyDown(handle, { key: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
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

describe("the expand tooltip after a keyboard collapse", () => {
  async function keyboardCollapse() {
    await renderShell()
    screen.getByRole("link", { name: /^Coach/ }).focus()
    await userEvent.keyboard("[[")
    expect(expandButton()).toHaveFocus()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  }

  it("does not open from the handed-off focus", async () => {
    await keyboardCollapse()
    advance(3000)
    expect(tooltip()).not.toBeInTheDocument()
  })

  it("does not take focus from the page when [ is pressed on the body", async () => {
    await renderShell()
    await userEvent.keyboard("[[")
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(document.body).toHaveFocus()
    expect(tooltip()).not.toBeInTheDocument()
  })

  it("still opens when the keyboard user tabs onto the button later", async () => {
    await renderShell()
    await userEvent.keyboard("[[")
    await userEvent.keyboard("{Tab}")
    act(() => {
      expandButton().focus()
    })
    await vi.waitFor(() => {
      expect(tooltip()).toHaveTextContent("Expand sidebar")
    })
  })

  it("still opens on hover while the handed-off button has focus", async () => {
    await renderShell()
    screen.getByRole("link", { name: /^Coach/ }).focus()
    await userEvent.keyboard("[[")
    expect(expandButton()).toHaveFocus()
    await userEvent.hover(expandButton())
    await vi.waitFor(() => {
      expect(tooltip()).toHaveTextContent("Expand sidebar")
    })
  })

  it("closes a hover tooltip when the peek opens and keeps it closed", async () => {
    await renderShell()
    await userEvent.keyboard("[[")
    await userEvent.hover(expandButton())
    await vi.waitFor(() => {
      expect(tooltip()).toBeInTheDocument()
    })
    const zone = document.querySelector('[data-slot="sidebar-peek-zone"]')!
    fireEvent.pointerEnter(zone, mouse())
    await vi.waitFor(() => {
      expect(aside()).toHaveAttribute("data-peek", "true")
    })
    expect(tooltip()).not.toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(tooltip()).not.toBeInTheDocument()
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
