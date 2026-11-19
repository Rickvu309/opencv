import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PaperLibraryCard } from "./paper-library-card"

afterEach(cleanup)

it("opens an empty page from the card without adding placeholder content", () => {
  const open = vi.fn()
  const { container } = render(
    <PaperLibraryCard name="My CV" meta="CV" onOpen={open} actions={[]} />
  )
  const sheet = container.querySelector('[data-slot="paper-library-sheet"]')
  expect(sheet).toHaveTextContent(/^$/)
  expect(sheet?.querySelector("svg, img, canvas")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "My CV" }))
  expect(open).toHaveBeenCalledOnce()
})

it("shows the full long document name", () => {
  const name =
    "Senior product designer portfolio and application for international project briefs"
  render(
    <PaperLibraryCard
      name={name}
      meta="Edited today"
      onOpen={() => undefined}
      actions={[]}
    />
  )
  expect(screen.getByRole("button", { name })).toBeInTheDocument()
  expect(screen.getByTitle(name)).toHaveTextContent(name)
})
