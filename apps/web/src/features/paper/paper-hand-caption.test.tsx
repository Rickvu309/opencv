import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PaperHandCaption } from "./paper-hand-caption.tsx"

const LONG =
  "Senior Product Designer CV for the Atlassian Ho Chi Minh City design systems team, final version"

function show(name: string, total = 3) {
  return render(
    <PaperHandCaption
      name={name}
      edited="Edited 2 hours ago"
      number={1}
      total={total}
      narrow={false}
      actions={[]}
      onSeek={vi.fn()}
    />
  )
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return (this.textContent ?? "").length * 8
    }
  )
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("paper hand caption", () => {
  it("keeps a long name on one line and reveals it in full on tap", () => {
    show(LONG)
    const line = document.querySelector(".paper-hand-caption-line")!
    expect(line).toHaveAttribute("data-cut")
    expect(
      document.querySelector(".paper-hand-caption-full")
    ).toHaveTextContent(LONG)
    fireEvent.click(
      screen.getByText(LONG, { selector: ".paper-hand-caption-name" })
    )
    expect(line).toHaveAttribute("data-shown")
    fireEvent.pointerDown(document.body)
    expect(line).not.toHaveAttribute("data-shown")
  })

  it("adds no tooltip to a name that fits and no ruler to a short hand", () => {
    show("CV")
    expect(
      document.querySelector(".paper-hand-caption-line")
    ).not.toHaveAttribute("data-cut")
    expect(document.querySelector(".paper-hand-caption-full")).toBeNull()
    fireEvent.click(screen.getByText("CV"))
    expect(
      document.querySelector(".paper-hand-caption-line")
    ).not.toHaveAttribute("data-shown")
    expect(screen.queryByRole("slider")).toBeNull()
  })
})
