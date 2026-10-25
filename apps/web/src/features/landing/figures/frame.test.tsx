import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

import { FigureCard } from "./frame.tsx"
import { PROOF_SPEC, proofPose } from "./model.ts"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function renderFigure(apply: (value: number) => void = () => {}) {
  render(
    <FigureCard
      spec={PROOF_SPEC}
      readoutOf={(value) => proofPose(value).readout}
      apply={apply}
      titleId="test-figure"
      heading="Proof, not claims"
      description="Context, action and outcome."
    >
      <svg />
    </FigureCard>
  )
  return screen.getByRole("slider", { name: "Proof, not claims" })
}

describe("figure slider", () => {
  it("is a focusable slider that exposes its range and current stop", () => {
    const slider = renderFigure()

    expect(slider.tabIndex).toBe(0)
    expect(slider.getAttribute("aria-valuemin")).toBe("0")
    expect(slider.getAttribute("aria-valuemax")).toBe("3")
    expect(slider.getAttribute("aria-valuenow")).toBe("0")
    expect(slider.getAttribute("aria-valuetext")).toBe(proofPose(0).readout)
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  it("moves between stops with the arrow, Home and End keys and clamps at the ends", () => {
    const slider = renderFigure()
    const stop = () => slider.getAttribute("aria-valuenow")

    slider.focus()
    fireEvent.keyDown(slider, { key: "ArrowLeft" })
    expect(stop()).toBe("0")
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(stop()).toBe("1")
    expect(slider.getAttribute("aria-valuetext")).toBe(proofPose(1).readout)
    fireEvent.keyDown(slider, { key: "End" })
    expect(stop()).toBe("3")
    expect(slider.getAttribute("aria-valuetext")).toBe(proofPose(3).readout)
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(stop()).toBe("3")
    fireEvent.keyDown(slider, { key: "Home" })
    expect(stop()).toBe("0")
  })

  it("ignores keys that do not move the slider", () => {
    const slider = renderFigure()

    slider.focus()
    expect(fireEvent.keyDown(slider, { key: "a" })).toBe(true)
    expect(slider.getAttribute("aria-valuenow")).toBe("0")
    expect(fireEvent.keyDown(slider, { key: "ArrowRight" })).toBe(false)
  })

  it("keeps the hovered pose when a pointer press focuses the slider", () => {
    vi.useFakeTimers()
    const apply = vi.fn()
    const slider = renderFigure(apply)
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 300, 300)
    )
    Object.defineProperty(slider, "setPointerCapture", { value: vi.fn() })

    fireEvent.pointerMove(slider, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 300,
      clientY: 100,
    })
    act(() => vi.advanceTimersByTime(100))
    expect(apply).toHaveBeenLastCalledWith(3)

    fireEvent.pointerDown(slider, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 300,
      clientY: 100,
    })
    act(() => slider.focus())
    act(() => vi.advanceTimersByTime(100))

    expect(apply).toHaveBeenLastCalledWith(3)
    expect(slider.getAttribute("aria-valuenow")).toBe("0")
  })

  it("runs the demonstration on load and keeps looping instead of stopping", () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    const apply = vi.fn()
    renderFigure(apply)

    act(() => vi.advanceTimersByTime(2500))
    expect(
      Math.max(...apply.mock.calls.map(([value]) => value))
    ).toBeGreaterThan(2.5)
    act(() => vi.advanceTimersByTime(2600))
    expect(apply.mock.lastCall?.[0]).toBeLessThan(0.5)
    act(() => vi.advanceTimersByTime(2500))
    expect(apply.mock.lastCall?.[0]).toBeGreaterThan(2.5)
  })

  it("keeps the figure still when reduced motion is requested", () => {
    vi.useFakeTimers()
    stubReducedMotion(true)
    const apply = vi.fn()
    renderFigure(apply)

    act(() => vi.advanceTimersByTime(8000))
    expect(apply.mock.calls.every(([value]) => value === 0)).toBe(true)
  })

  it("hands the figure to the user once a key is pressed", () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    const apply = vi.fn()
    const slider = renderFigure(apply)

    act(() => vi.advanceTimersByTime(1000))
    slider.focus()
    fireEvent.keyDown(slider, { key: "Home" })
    act(() => vi.advanceTimersByTime(4000))
    apply.mockClear()
    act(() => vi.advanceTimersByTime(4000))

    expect(apply.mock.calls.every(([value]) => value === 0)).toBe(true)
    expect(slider.getAttribute("aria-valuenow")).toBe("0")
  })

  it("keeps running when a touch on the figure turns into a page scroll", () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    const apply = vi.fn()
    const slider = renderFigure(apply)
    Object.defineProperty(slider, "setPointerCapture", { value: vi.fn() })
    Object.defineProperty(slider, "hasPointerCapture", { value: () => false })

    act(() => vi.advanceTimersByTime(1000))
    fireEvent.pointerDown(slider, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerCancel(slider, { pointerId: 1, pointerType: "touch" })
    apply.mockClear()
    act(() => vi.advanceTimersByTime(1500))

    expect(
      Math.max(...apply.mock.calls.map(([value]) => value))
    ).toBeGreaterThan(2)
  })

  it("offers a pause and play button that stops and restarts the loop", () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    const apply = vi.fn()
    renderFigure(apply)

    act(() => vi.advanceTimersByTime(1000))
    const pause = screen.getByRole("button", { name: /^Pause animation/ })
    fireEvent.click(pause)
    act(() => vi.advanceTimersByTime(4000))
    apply.mockClear()
    act(() => vi.advanceTimersByTime(4000))
    expect(apply.mock.calls.every(([value]) => value === 0)).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /^Play animation/ }))
    act(() => vi.advanceTimersByTime(2500))
    expect(
      Math.max(...apply.mock.calls.map(([value]) => value))
    ).toBeGreaterThan(2)
    expect(
      screen.getByRole("button", { name: /^Pause animation/ })
    ).toBeTruthy()
  })

  it("has no play button when reduced motion is requested", () => {
    stubReducedMotion(true)
    renderFigure()

    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  it("waits until a quarter of the figure is on screen before starting", () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    let notify: (ratio: number) => void = () => {}
    class FakeObserver {
      constructor(callback: IntersectionObserverCallback) {
        notify = (ratio) =>
          callback(
            [{ intersectionRatio: ratio } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          )
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver)
    const apply = vi.fn()
    renderFigure(apply)

    act(() => notify(0.1))
    act(() => vi.advanceTimersByTime(2500))
    expect(apply.mock.calls.every(([value]) => value === 0)).toBe(true)

    act(() => notify(0.6))
    act(() => vi.advanceTimersByTime(2500))
    expect(
      Math.max(...apply.mock.calls.map(([value]) => value))
    ).toBeGreaterThan(2)
  })
})
