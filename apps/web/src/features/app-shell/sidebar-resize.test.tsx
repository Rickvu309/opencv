import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { resetShellApiMock } from "@/test/shell-api-mock.ts"
import {
  aside,
  drag,
  flushFrames,
  frame,
  frameCount,
  renderShell as renderSidebarShell,
  stubPointerApis,
} from "@/test/sidebar-fixtures.ts"

beforeEach(() => {
  stubPointerApis()
})

afterEach(() => {
  cleanup()
  resetShellApiMock()
  localStorage.clear()
  vi.unstubAllGlobals()
})

async function renderShell() {
  const { handle } = await renderSidebarShell()
  return handle
}

function sidebarWidth() {
  return frame().style.getPropertyValue("--sidebar-width")
}

function liveWidth() {
  return aside().style.width
}

describe("resize handle", () => {
  it("describes itself as a vertical separator with its range", async () => {
    const handle = await renderShell()
    expect(handle).toHaveAttribute("aria-orientation", "vertical")
    expect(handle).toHaveAttribute("aria-valuemin", "216")
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
    expect(sidebarWidth()).toBe("216px")
    expect(localStorage.getItem("opencv.sidebar.width")).toBe("216")
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
    const queued = frameCount()
    fireEvent.pointerMove(handle, { clientX: 260, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 270, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 280, pointerId: 1 })
    expect(frameCount()).toBe(queued + 1)
    expect(liveWidth()).toBe("")
    flushFrames()
    expect(liveWidth()).toBe("280px")
    expect(frame().style.width).toBe("280px")
    expect(sidebarWidth()).toBe("244px")
    expect(localStorage.getItem("opencv.sidebar.width")).toBeNull()
    fireEvent.pointerUp(handle, { clientX: 280, pointerId: 1 })
    expect(localStorage.getItem("opencv.sidebar.width")).toBe("280")
    expect(liveWidth()).toBe("")
    expect(sidebarWidth()).toBe("280px")
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
    expect(handle).toHaveAttribute("aria-valuenow", "216")
    expect(localStorage.getItem("opencv.sidebar.width")).toBe("216")
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

  it("puts the expand button in the page header and no longer in the dock", async () => {
    const handle = await renderShell()
    drag(handle, 244, 100)
    const expand = screen.getByRole("button", { name: "Expand sidebar" })
    expect(expand.closest('[data-slot="sidebar-expand"]')).not.toBeNull()
    expect(expand.closest('[data-slot="app-dock"]')).toBeNull()
  })
})

describe("over-drag preview", () => {
  it("shows the sidebar sliding away below the threshold and collapses only on release", async () => {
    const handle = await renderShell()
    fireEvent.pointerDown(handle, { clientX: 244, button: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 })
    flushFrames()
    expect(frame()).toHaveAttribute("data-collapse-preview", "true")
    expect(frame()).toHaveAttribute("data-state", "open")
    expect(frame().style.width).toBe("36px")
    expect(localStorage.getItem("opencv.sidebar.collapsed")).toBeNull()
    fireEvent.pointerUp(handle, { clientX: 100, pointerId: 1 })
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(frame()).not.toHaveAttribute("data-collapse-preview")
    expect(localStorage.getItem("opencv.sidebar.collapsed")).toBe("1")
  })

  it("brings the sidebar back when the drag returns above the threshold", async () => {
    const handle = await renderShell()
    fireEvent.pointerDown(handle, { clientX: 244, button: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 })
    flushFrames()
    fireEvent.pointerMove(handle, { clientX: 290, pointerId: 1 })
    flushFrames()
    expect(frame()).not.toHaveAttribute("data-collapse-preview")
    expect(frame().style.width).toBe("290px")
    fireEvent.pointerUp(handle, { clientX: 290, pointerId: 1 })
    expect(frame()).toHaveAttribute("data-state", "open")
    expect(sidebarWidth()).toBe("290px")
  })
})

describe("a drag that does not end with a pointer up", () => {
  async function startDrag() {
    const handle = await renderShell()
    fireEvent.pointerDown(handle, { clientX: 244, button: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 })
    flushFrames()
    return handle
  }

  function expectUntouched(handle: HTMLElement) {
    expect(frame()).not.toHaveAttribute("data-resizing")
    expect(frame()).not.toHaveAttribute("data-collapse-preview")
    expect(frame()).toHaveAttribute("data-state", "open")
    expect(frame().style.width).toBe("")
    expect(aside().style.width).toBe("")
    expect(sidebarWidth()).toBe("244px")
    expect(handle).toHaveAttribute("aria-valuenow", "244")
    expect(document.body.style.userSelect).toBe("")
    expect(document.body.style.cursor).toBe("")
    expect(localStorage.getItem("opencv.sidebar.width")).toBeNull()
    expect(localStorage.getItem("opencv.sidebar.collapsed")).toBeNull()
  }

  it("ends on pointercancel and keeps the start width", async () => {
    const handle = await startDrag()
    fireEvent.pointerCancel(handle, { pointerId: 1 })
    expectUntouched(handle)
  })

  it("ends when the browser takes the pointer capture away", async () => {
    const handle = await startDrag()
    fireEvent.lostPointerCapture(handle, { pointerId: 1 })
    expectUntouched(handle)
  })

  it("ends when the window loses focus", async () => {
    const handle = await startDrag()
    act(() => {
      window.dispatchEvent(new Event("blur"))
    })
    expectUntouched(handle)
  })

  it("does not move the sidebar from a stray pointer move afterwards", async () => {
    const handle = await startDrag()
    fireEvent.pointerCancel(handle, { pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 300, pointerId: 1 })
    flushFrames()
    expectUntouched(handle)
  })
})

describe("focus after collapse and expand", () => {
  it("moves to the expand button after the collapse button is pressed", async () => {
    await renderShell()
    await userEvent.click(
      screen.getByRole("button", { name: "Collapse sidebar" })
    )
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveFocus()
  })

  it("moves to the collapse button after the expand button is pressed", async () => {
    await renderShell()
    await userEvent.click(
      screen.getByRole("button", { name: "Collapse sidebar" })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Expand sidebar" })
    )
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" })
    ).toHaveFocus()
  })

  it("moves to the expand button when Enter on the handle collapses", async () => {
    const handle = await renderShell()
    handle.focus()
    await userEvent.keyboard("{Enter}")
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveFocus()
  })

  it("moves to the expand button when [ collapses from a sidebar link", async () => {
    await renderShell()
    screen.getByRole("link", { name: /^Coach/ }).focus()
    await userEvent.keyboard("[[")
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveFocus()
    await userEvent.keyboard("[[")
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" })
    ).toHaveFocus()
  })

  it("leaves focus on the page when a drag collapses the sidebar", async () => {
    const handle = await renderShell()
    drag(handle, 244, 100)
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(document.body).toHaveFocus()
  })

  it("leaves focus alone when it is in the page", async () => {
    await renderShell()
    const main = document.getElementById("app-main")!
    const button = document.createElement("button")
    main.append(button)
    button.focus()
    await userEvent.keyboard("[[")
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(button).toHaveFocus()
  })
})
