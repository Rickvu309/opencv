import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { cv, letter, renderLibrary } from "./paper-library.fixtures.tsx"

afterEach(() => {
  cleanup()
})

describe("Paper home sections", () => {
  it("groups documents into sections and searches across every section", () => {
    renderLibrary([cv("My CV"), letter("Design letter")])
    expect(
      screen.queryByRole("group", { name: "Document type" })
    ).not.toBeInTheDocument()
    const cvs = screen.getByRole("region", { name: "CVs" })
    const letters = screen.getByRole("region", { name: "Cover letters" })
    expect(
      within(cvs).getByRole("button", { name: /^My CV,/ })
    ).toBeInTheDocument()
    expect(
      within(letters).getByRole("button", { name: /^Design letter,/ })
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Files" })).getByRole(
        "button",
        { name: "Import a file" }
      )
    ).toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: "Search Paper" }), {
      target: { value: "design" },
    })
    expect(
      screen.queryByRole("region", { name: "CVs" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Design letter,/ })
    ).toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: "Search Paper" }), {
      target: { value: "nothing" },
    })
    expect(screen.getByText('No results for "nothing"')).toBeInTheDocument()
  })

  it("keeps the header to the title, search and New", () => {
    renderLibrary([cv("My CV")])
    expect(screen.getByRole("heading", { name: "Paper" })).toHaveTextContent(
      /^Paper$/
    )
    expect(
      screen.queryByRole("button", { name: "Import", exact: true })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Import a file" }))
    expect(
      screen.getByRole("dialog", { name: "Import", exact: true })
    ).toBeInTheDocument()
  })

  it("collapses a section from its head and opens it again", () => {
    renderLibrary([cv("My CV")])
    const head = screen.getByRole("button", { name: "CVs" })
    expect(head).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(head)
    expect(head).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByRole("button", { name: /^My CV,/ })
    ).not.toBeInTheDocument()
    fireEvent.click(head)
    expect(screen.getByRole("button", { name: /^My CV,/ })).toBeInTheDocument()
  })

  it("starts a CV from the New CV tile", () => {
    renderLibrary([cv("My CV")])
    fireEvent.click(screen.getByRole("button", { name: "New CV" }))
    expect(screen.getByRole("dialog", { name: "New CV" })).toBeInTheDocument()
  })

  it("shows imported files without documents and keeps their delete action", async () => {
    renderLibrary(
      [],
      [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Original CV.pdf",
          mediaType: "application/pdf",
          byteSize: 42,
          createdAt: "2026-08-25T12:00:00.000Z",
        },
      ]
    )
    expect(screen.queryByText("Start a document")).not.toBeInTheDocument()
    const filesSection = screen.getByRole("region", { name: "Files" })
    expect(
      within(filesSection).getAllByText("Original CV.pdf")
    ).not.toHaveLength(0)
    expect(within(filesSection).getByText("PDF")).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "CVs" })
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Original CV.pdf menu" })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete", exact: true })
    )
    expect(
      screen.getByRole("dialog", { name: "Delete this file?" })
    ).toBeInTheDocument()
  })

  it("names a CV card from the document and hides it when search misses", async () => {
    renderLibrary([cv("PM track CV")])
    expect(
      screen.getByRole("button", { name: /^PM track CV,/ })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Search Paper" }), {
      target: { value: "portfolio" },
    })

    expect(screen.getByText('No results for "portfolio"')).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^PM track CV,/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Try another word, or clear the search.")
    ).toBeInTheDocument()
  })
})
