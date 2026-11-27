import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

import { ChatLog } from "./chat.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Box = { scrollHeight: number; clientHeight: number }

function domRect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 320,
    bottom: top + height,
    width: 320,
    height,
    toJSON() {
      return {}
    },
  } as DOMRect
}

function installScroll(box: Box) {
  const resize: ResizeObserverCallback[] = []
  const previousResize = window.ResizeObserver
  class RecordingResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize.push(callback)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver =
    RecordingResizeObserver as unknown as typeof ResizeObserver
  const scrollHeight = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollHeight"
  )
  const clientHeight = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "clientHeight"
  )
  const scrollTo = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollTo"
  )
  Object.defineProperty(Element.prototype, "scrollHeight", {
    configurable: true,
    get() {
      if (this.dataset?.slot === "message-scroller-viewport")
        return box.scrollHeight
      return scrollHeight?.get?.call(this) ?? 0
    },
  })
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get() {
      if (this.dataset?.slot === "message-scroller-viewport")
        return box.clientHeight
      return clientHeight?.get?.call(this) ?? 0
    },
  })
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.dataset.slot === "message-scroller-viewport")
        return domRect(0, box.clientHeight)
      const viewport = this.closest(
        "[data-slot=message-scroller-viewport]"
      ) as HTMLElement | null
      if (!viewport) return domRect(0, 0)
      return domRect(-(viewport.scrollTop || 0), box.scrollHeight)
    }
  )
  Element.prototype.scrollTo = function (
    this: Element,
    options?: ScrollToOptions | number
  ) {
    const top =
      typeof options === "number"
        ? options
        : typeof options?.top === "number"
          ? options.top
          : this.scrollTop
    this.scrollTop = top
    this.dispatchEvent(new Event("scroll"))
  }
  return {
    resize,
    restore() {
      if (scrollHeight)
        Object.defineProperty(Element.prototype, "scrollHeight", scrollHeight)
      if (clientHeight)
        Object.defineProperty(Element.prototype, "clientHeight", clientHeight)
      if (scrollTo)
        Object.defineProperty(Element.prototype, "scrollTo", scrollTo)
      else Reflect.deleteProperty(Element.prototype, "scrollTo")
      window.ResizeObserver = previousResize
    },
  }
}

async function frames() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
}

function viewport() {
  const node = document.querySelector("[data-slot=message-scroller-viewport]")
  if (!(node instanceof HTMLElement)) throw new Error("missing viewport")
  return node
}

function jumpButton() {
  const button = screen.queryByRole("button", { name: "Jump to latest" })
  if (!button || button.hasAttribute("inert")) return null
  if (button.getAttribute("data-active") === "false") return null
  return button
}

describe("Conversation scroll", () => {
  it("follows new text, lets go when scrolled up, and follows again from Jump to latest", async () => {
    const box: Box = { scrollHeight: 800, clientHeight: 200 }
    const layout = installScroll(box)
    render(
      createElement(
        ChatLog,
        null,
        createElement(
          "div",
          { "data-message-id": "user", "data-scroll-anchor": "true" },
          "Question"
        ),
        createElement("div", { "data-message-id": "coach" }, "Hello")
      )
    )
    await frames()
    const view = viewport()
    expect(view.scrollTop).toBe(box.scrollHeight - box.clientHeight)
    expect(jumpButton()).toBeNull()

    box.scrollHeight = 1200
    await act(async () => {
      for (const callback of layout.resize) callback([], {} as ResizeObserver)
    })
    await frames()
    expect(view.scrollTop).toBe(1000)
    expect(jumpButton()).toBeNull()

    fireEvent.wheel(view, { deltaY: -120 })
    view.scrollTop = 200
    fireEvent.scroll(view)
    await frames()
    expect(jumpButton()).not.toBeNull()
    expect(jumpButton()).toHaveClass("motion-reduce:transition-none")

    box.scrollHeight = 1600
    await act(async () => {
      for (const callback of layout.resize) callback([], {} as ResizeObserver)
    })
    await frames()
    expect(view.scrollTop).toBe(200)

    fireEvent.click(jumpButton()!)
    await frames()
    expect(view.scrollTop).toBe(1400)
    expect(jumpButton()).toBeNull()

    box.scrollHeight = 2000
    await act(async () => {
      for (const callback of layout.resize) callback([], {} as ResizeObserver)
    })
    await frames()
    expect(view.scrollTop).toBe(1800)
    layout.restore()
  })
})
