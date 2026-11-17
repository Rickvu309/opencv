import { afterEach, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"

import { PaperLibraryCard } from "./paper-library-card"

afterEach(cleanup)

it("answers hover and focus with a token-timed ring and keeps the kit press", () => {
  const { container } = render(
    <PaperLibraryCard name="My CV" meta="CV" onOpen={() => {}} actions={[]} />
  )
  const sheet = container.querySelector('[data-slot="paper-library-sheet"]')
  const classes = sheet?.getAttribute("class") ?? ""
  expect(classes).toContain("group-hover/card:ring-foreground/15")
  expect(classes).toContain("group-focus-visible/card:ring-foreground/15")
  expect(classes).toContain("transition-[box-shadow]")
  expect(classes).toContain("duration-(--duration-micro)")
  expect(classes).toContain("ease-(--ease-micro)")
  expect(classes).not.toMatch(
    /duration-\d|(?:hover|focus)[^ ]*(?:scale|translate)/
  )
  expect(container.querySelector("button")).toHaveClass("motion-press")
  expect(sheet?.textContent).toBe("")
  expect(
    container.querySelector("[data-slot=paper-library-preview-name]")
  ).toBeNull()
})
