import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PaperHandRuler } from "./paper-hand-ruler.tsx"

afterEach(() => {
  cleanup()
})

describe("paper hand ruler", () => {
  it("moves by one, by a hand and to either end from the keyboard", () => {
    const onSeek = vi.fn()
    render(
      <PaperHandRuler number={4} total={60} narrow={false} onSeek={onSeek} />
    )
    const ruler = screen.getByRole("slider", {
      name: "Move through your documents",
    })
    expect(ruler).toHaveAttribute("aria-valuetext", "4 of 60")
    fireEvent.keyDown(ruler, { key: "ArrowRight" })
    fireEvent.keyDown(ruler, { key: "ArrowLeft" })
    fireEvent.keyDown(ruler, { key: "PageUp" })
    fireEvent.keyDown(ruler, { key: "Home" })
    fireEvent.keyDown(ruler, { key: "End" })
    expect(onSeek.mock.calls.map(([index]) => index)).toEqual([4, 2, 10, 0, 59])
  })

  it("labels round numbers and hides the one under the mark", () => {
    render(
      <PaperHandRuler number={1} total={60} narrow={false} onSeek={vi.fn()} />
    )
    const labels = [
      ...document.querySelectorAll(".paper-hand-ruler-labels span"),
    ]
    expect(labels.map((label) => label.textContent)).toEqual([
      "1",
      "10",
      "20",
      "30",
      "40",
      "50",
      "60",
    ])
    expect(labels[0]).toHaveAttribute("data-under")
    expect(labels[1]).not.toHaveAttribute("data-under")
  })
})
