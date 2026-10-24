import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

import { FigureCard } from "./frame.tsx"
import { PROOF_SPEC, proofPose } from "./model.ts"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

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
})
