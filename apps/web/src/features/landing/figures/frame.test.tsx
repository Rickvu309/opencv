import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { FigureCard } from "./frame.tsx"
import { PROOF_SPEC, proofPose } from "./model.ts"

afterEach(cleanup)

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
    const prevented = vi.fn()

    slider.focus()
    slider.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) prevented()
    })
    fireEvent.keyDown(slider, { key: "a" })
    expect(prevented).not.toHaveBeenCalled()
    expect(slider.getAttribute("aria-valuenow")).toBe("0")
  })
})
