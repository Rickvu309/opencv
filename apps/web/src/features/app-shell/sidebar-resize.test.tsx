import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderApp } from "@/test/render-app.tsx"
import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { resetShellApiMock } from "@/test/shell-api-mock.ts"

const frames: FrameRequestCallback[] = []

function flushFrames() {
  frames.splice(0).forEach((run) => run(0))
}

beforeEach(() => {
  frames.length = 0
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    frames.push(run)
    return frames.length
  })
  vi.stubGlobal("cancelAnimationFrame", () => {})
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => true)
})

afterEach(() => {
  cleanup()
  resetShellApiMock()
  localStorage.clear()
  vi.unstubAllGlobals()
})

async function renderShell() {
  stubDesktopViewport(true)
  renderApp(SURFACE_PATHS.pitch)
  return screen.findByRole("separator", { name: "Resize sidebar" })
}

function frame() {
  return document.querySelector<HTMLElement>('[data-slot="sidebar-frame"]')!
}

function sidebarWidth() {
  return frame().style.getPropertyValue("--sidebar-width")
}

function drag(handle: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(handle, { clientX: from, button: 0, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientX: to, pointerId: 1 })
  flushFrames()
  fireEvent.pointerUp(handle, { clientX: to, pointerId: 1 })
}

describe("resize handle", () => {
  it("describes itself as a vertical separator with its range", async () => {
    const handle = await renderShell()
    expect(handle).toHaveAttribute("aria-orientation", "vertical")
    expect(handle).toHaveAttribute("aria-valuemin", "200")
    expect(handle).toHaveAttribute("aria-valuemax", "360")
    expect(handle).toHaveAttribute("aria-valuenow", "244")
    expect(handle).toHaveAttribute("tabindex", "0")
    expect(sidebarWidth()).toBe("244px")
  })

  it("sets the width live, clamps it and keeps it", async () => {
    const handle = await renderShell()
    drag(handle, 244, 300)
    expect(sidebarWidth()).toBe("300px")
    expect(handle).toHaveAttribute("aria-valuenow", "300")
    expect(localStorage.getItem("opencv.sidebar.width")).toBe("300")
    drag(handle, 300, 900)
    expect(sidebarWidth()).toBe("360px")
    drag(handle, 360, 170)
    expect(sidebarWidth()).toBe("200px")
    expect(localStorage.getItem("opencv.sidebar.width")).toBe("200")
  })

  it("draws the first frame at the saved width", async () => {
    localStorage.setItem("opencv.sidebar.width", "310")
    const handle = await renderShell()
    expect(sidebarWidth()).toBe("310px")
    expect(handle).toHaveAttribute("aria-valuenow", "310")
  })

  it("moves the width on animation frames and commits once on release", async () => {
    const handle = await renderShell()
    fireEvent.pointerDown(handle, { clientX: 244, button: 0, pointerId: 1 })
    expect(frame()).toHaveAttribute("data-resizing", "true")
    expect(document.body.style.userSelect).toBe("none")
    fireEvent.pointerMove(handle, { clientX: 260, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 270, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 280, pointerId: 1 })
    expect(frames).toHaveLength(1)
    expect(sidebarWidth()).toBe("244px")
    flushFrames()
    expect(sidebarWidth()).toBe("280px")
    expect(localStorage.getItem("opencv.sidebar.width")).toBeNull()
    fireEvent.pointerUp(handle, { clientX: 280, pointerId: 1 })
    expect(localStorage.getItem("opencv.sidebar.width")).toBe("280")
    expect(frame()).not.toHaveAttribute("data-resizing")
    expect(document.body.style.userSelect).toBe("")
  })

  it("resets to the default on double click", async () => {
    const handle = await renderShell()
    drag(handle, 244, 320)
    expect(sidebarWidth()).toBe("320px")
    fireEvent.doubleClick(handle)
    expect(sidebarWidth()).toBe("244px")
    expect(localStorage.getItem("opencv.sidebar.width")).toBe("244")
  })

  it("resizes by 16px with the arrow keys and stops at the limits", async () => {
    const handle = await renderShell()
    handle.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(handle).toHaveAttribute("aria-valuenow", "260")
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")
    expect(handle).toHaveAttribute("aria-valuenow", "228")
    for (let i = 0; i < 4; i += 1) await userEvent.keyboard("{ArrowLeft}")
    expect(handle).toHaveAttribute("aria-valuenow", "200")
    expect(localStorage.getItem("opencv.sidebar.width")).toBe("200")
  })
})

describe("collapse and peek", () => {
  it("collapses when dragged below 140 and keeps it out of the tab order", async () => {
    const handle = await renderShell()
    drag(handle, 244, 100)
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(screen.getByRole("complementary", { hidden: true })).toHaveAttribute(
      "inert"
    )
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
    expect(localStorage.getItem("opencv.sidebar.collapsed")).toBe("1")
    expect(localStorage.getItem("opencv.sidebar.width")).not.toBe("100")
  })

  it("toggles with Enter on the handle and with the [ key", async () => {
    const handle = await renderShell()
    handle.focus()
    await userEvent.keyboard("{Enter}")
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    await userEvent.keyboard("[[")
    expect(frame()).toHaveAttribute("data-state", "open")
    await userEvent.keyboard("[[")
    expect(frame()).toHaveAttribute("data-state", "collapsed")
  })

  it("ignores [ while typing in an input", async () => {
    await renderShell()
    const input = document.createElement("input")
    document.body.append(input)
    input.focus()
    await userEvent.keyboard("[[")
    expect(frame()).toHaveAttribute("data-state", "open")
    input.remove()
  })

  it("restores the collapsed state on load", async () => {
    localStorage.setItem("opencv.sidebar.collapsed", "1")
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.pitch)
    await screen.findByRole("button", { name: "Expand sidebar" })
    expect(frame()).toHaveAttribute("data-state", "collapsed")
  })

  it("peeks from the left edge, hides on leave and pins from the toggle", async () => {
    const handle = await renderShell()
    drag(handle, 244, 100)
    const zone = document.querySelector('[data-slot="sidebar-peek-zone"]')!
    const side = screen.getByRole("complementary", { hidden: true })
    expect(side).toHaveAttribute("inert")
    fireEvent.pointerEnter(zone, { pointerType: "mouse" })
    expect(side).not.toHaveAttribute("inert")
    expect(side).toHaveAttribute("data-peek", "true")
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    fireEvent.pointerLeave(frame(), { pointerType: "mouse" })
    expect(side).toHaveAttribute("inert")
    expect(side).toHaveAttribute("data-peek", "false")
    fireEvent.pointerEnter(
      document.querySelector('[data-slot="sidebar-peek-zone"]')!,
      { pointerType: "mouse" }
    )
    await userEvent.click(screen.getByRole("button", { name: "Pin sidebar" }))
    expect(frame()).toHaveAttribute("data-state", "open")
    expect(localStorage.getItem("opencv.sidebar.collapsed")).toBe("0")
  })

  it("offers a visible collapse button and an expand button when hidden", async () => {
    await renderShell()
    await userEvent.click(
      screen.getByRole("button", { name: "Collapse sidebar" })
    )
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    await userEvent.click(
      screen.getByRole("button", { name: "Expand sidebar" })
    )
    expect(frame()).toHaveAttribute("data-state", "open")
  })
})
