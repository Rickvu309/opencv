import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { act, cleanup, fireEvent } from "@testing-library/react"

import { DESKTOP_MEDIA_QUERY } from "@/lib/use-media-query.ts"
import { resetShellApiMock } from "@/test/shell-api-mock.ts"
import {
  aside,
  frame,
  mouse,
  renderShell,
  stubPointerApis,
} from "@/test/sidebar-fixtures.ts"
import { followSidebar } from "@/features/app-shell/sidebar-follow.ts"

const PANEL = { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
const MICRO_MS = 150
const SIDEBAR = 244
const GUTTER = 8

type Slide = { element: Element; keyframes: Keyframe[]; timing: object }

let slides: Slide[] = []

function stubMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === DESKTOP_MEDIA_QUERY,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  const root = document.documentElement.style
  root.setProperty("--duration-panel", `${PANEL.duration}ms`)
  root.setProperty("--ease-panel", PANEL.easing)
  root.setProperty("--duration-micro", `${MICRO_MS}ms`)
  root.setProperty("--ease-micro", "cubic-bezier(0.22, 1, 0.36, 1)")
  slides = []
  vi.spyOn(Element.prototype, "animate").mockImplementation(function (
    this: Element,
    keyframes,
    timing
  ) {
    slides.push({
      element: this,
      keyframes: keyframes as Keyframe[],
      timing: timing as object,
    })
    return { id: "sidebar-follow", cancel: () => {} } as unknown as Animation
  })
  vi.spyOn(Element.prototype, "getAnimations").mockReturnValue([])
}

function pageLeft() {
  const shell = document.querySelector<HTMLElement>(
    '[data-slot="sidebar-frame"]'
  )
  if (!shell) return 0
  const inline = shell.style.width
  const collapsed = shell.getAttribute("data-state") === "collapsed"
  const preview = shell.hasAttribute("data-collapse-preview")
  const width = inline ? Number.parseFloat(inline) : collapsed ? 0 : SIDEBAR
  return width + (collapsed || preview ? GUTTER : 0)
}

function stubPageGeometry() {
  const real = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.id !== "app-main") return real.call(this)
      const left = pageLeft()
      return DOMRect.fromRect({
        x: left,
        y: 0,
        width: 1440 - left,
        height: 900,
      })
    }
  )
}

function shellMain() {
  return document.querySelector('[data-slot="shell-main"]')!
}

function pageSlides() {
  return slides.filter((slide) => slide.element === shellMain())
}

const motionApis = Element.prototype as Partial<
  Pick<Element, "animate" | "getAnimations">
>
const hadAnimate = typeof motionApis.animate === "function"
const hadGetAnimations = typeof motionApis.getAnimations === "function"

beforeAll(() => {
  if (!hadAnimate) motionApis.animate = () => ({}) as Animation
  if (!hadGetAnimations) motionApis.getAnimations = () => []
})

afterAll(() => {
  if (!hadAnimate) Reflect.deleteProperty(motionApis, "animate")
  if (!hadGetAnimations) Reflect.deleteProperty(motionApis, "getAnimations")
})

beforeEach(() => {
  stubPointerApis()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  cleanup()
  resetShellApiMock()
  localStorage.clear()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute("style")
})

async function renderMovingShell() {
  const view = await renderShell()
  stubMotion()
  stubPageGeometry()
  return view
}

describe("the page rides with the sidebar", () => {
  it("slides the page in from where it stood when Expand is clicked", async () => {
    await renderMovingShell()
    fireEvent.keyDown(window, { key: "[" })
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(pageSlides()).toEqual([])
    fireEvent.click(
      document.querySelector("#app-main [data-slot=sidebar-expand]")!
    )
    expect(frame()).toHaveAttribute("data-state", "open")
    expect(pageSlides()).toHaveLength(1)
    const [slide] = pageSlides()
    expect(slide.keyframes[0]).toEqual({
      transform: `translateX(${GUTTER - SIDEBAR}px)`,
    })
    expect(slide.keyframes[1]).toEqual({ transform: "none" })
    expect(slide.timing).toMatchObject(PANEL)
  })

  it("slides the page back from the sidebar edge on a fast collapse drag, and leaves faster than it came", async () => {
    const { handle } = await renderMovingShell()
    fireEvent.pointerDown(handle, { clientX: 244, button: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 60, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientX: 60, pointerId: 1 })
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(pageSlides()).toHaveLength(1)
    const [slide] = pageSlides()
    expect(slide.keyframes[0]).toEqual({
      transform: `translateX(${SIDEBAR - GUTTER}px)`,
    })
    expect(slide.timing).toMatchObject({
      duration: MICRO_MS,
      easing: PANEL.easing,
    })
  })

  it("hides the docked sidebar flush with the frame edge so the page seam never opens", async () => {
    await renderMovingShell()
    fireEvent.keyDown(window, { key: "[" })
    expect(aside().className).toContain("-translate-x-full")
    expect(aside().className).not.toContain("rounded-lg")
  })

  it("collapses instantly from Enter on the resize handle", async () => {
    const { handle } = await renderMovingShell()
    handle.focus()
    fireEvent.keyDown(handle, { key: "Enter" })
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(frame()).toHaveAttribute("data-instant", "true")
    expect(pageSlides()).toEqual([])
  })

  it("stops the page slide when [ snaps the sidebar mid-expand", async () => {
    await renderMovingShell()
    fireEvent.keyDown(window, { key: "[" })
    fireEvent.click(
      document.querySelector("#app-main [data-slot=sidebar-expand]")!
    )
    const running = { id: "sidebar-follow", cancel: vi.fn() }
    vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (
      this: Element
    ) {
      return this === shellMain() ? [running as unknown as Animation] : []
    })
    fireEvent.keyDown(window, { key: "[" })
    expect(frame()).toHaveAttribute("data-state", "collapsed")
    expect(frame()).toHaveAttribute("data-instant", "true")
    expect(running.cancel).toHaveBeenCalled()
  })
})

describe("the peek leaves the way it came", () => {
  it("keeps its card shape while it slides out", async () => {
    await renderMovingShell()
    fireEvent.keyDown(window, { key: "[" })
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const zone = document.querySelector('[data-slot="sidebar-peek-zone"]')!
    fireEvent.pointerEnter(zone, mouse())
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(aside()).toHaveAttribute("data-peek", "true")
    expect(aside().className).toContain("rounded-lg")
    expect(aside().className).toContain("shadow-xl")
    fireEvent.pointerLeave(zone, mouse())
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(aside()).toHaveAttribute("data-peek", "false")
    expect(aside().className).toContain("rounded-lg")
    expect(aside().className).toContain("left-2")
    expect(aside().className).toContain("-translate-x-[calc(100%+0.5rem)]")
    expect(aside().className).toContain("duration-(--duration-micro)")
    expect(aside().className).not.toContain("shadow-xl")
  })
})

describe("followSidebar", () => {
  function mountShell(panelPosition: string) {
    document.body.innerHTML = `
      <div data-slot="shell-main">
        <main id="app-main"></main>
        <div data-slot="shell-coach" style="position: ${panelPosition}"></div>
      </div>`
    return {
      main: document.querySelector('[data-slot="shell-main"]')!,
      coach: document.querySelector('[data-slot="shell-coach"]')!,
    }
  }

  function placePage(lefts: number[]) {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      () => DOMRect.fromRect({ x: lefts.shift() ?? 0, width: 10 })
    )
  }

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("holds a floating Coach panel still while the page under it slides", () => {
    stubMotion()
    const { main, coach } = mountShell("fixed")
    placePage([8, 244])
    followSidebar(false, () => {})
    expect(slides.map((slide) => slide.element)).toEqual([main, coach])
    expect(slides[0].keyframes[0]).toEqual({ transform: "translateX(-236px)" })
    expect(slides[1].keyframes[0]).toEqual({ transform: "translateX(236px)" })
  })

  it("lets an in-page Coach panel ride with the page", () => {
    stubMotion()
    const { main } = mountShell("absolute")
    placePage([244, 8])
    followSidebar(true, () => {})
    expect(slides.map((slide) => slide.element)).toEqual([main])
  })

  it("does not slide when the person asks for reduced motion", () => {
    stubMotion()
    vi.stubGlobal("matchMedia", () => ({ matches: true }))
    mountShell("fixed")
    placePage([8, 244])
    followSidebar(false, () => {})
    expect(slides).toEqual([])
  })
})
