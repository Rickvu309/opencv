import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { pathOf } from "@/test/mock-http.ts"
import { renderPage } from "@/test/render-app.tsx"
import { ProofsPage } from "./proof-page.tsx"
import { notifyCalls } from "@/test/shell-api-mock.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Proofs coming soon", () => {
  it("names the page Proofs with one h1 and a Paper breadcrumb above it", async () => {
    renderPage(ProofsPage)

    const title = await screen.findByRole("heading", { level: 1 })
    expect(title).toHaveTextContent(/^Proofs$/)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(title).toHaveAttribute("aria-current", "page")
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(within(crumbs).getByRole("link", { name: "Paper" })).toHaveAttribute(
      "href",
      "/paper"
    )
  })

  it("keeps the header outside the scrolling body", async () => {
    renderPage(ProofsPage)

    const title = await screen.findByRole("heading", { level: 1 })
    const header = title.closest('[data-slot="page-header"]')!
    expect(header).toHaveAttribute("data-pen-surface", "coming-soon")
    expect(header.nextElementSibling).toHaveClass("overflow-y-auto")
    expect(header.closest(".overflow-y-auto")).toBeNull()
  })

  it("gives phones a back link to Paper", async () => {
    renderPage(ProofsPage)

    await screen.findByRole("heading", { level: 1 })
    const back = document.querySelector('[data-slot="page-header-back"]')!
    expect(back).toHaveAttribute("href", "/paper")
    expect(back).toHaveClass("h-11", "touch-manipulation")
  })

  it("leads with the headline and the sub line", async () => {
    renderPage(ProofsPage)

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Back your CV with proof",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("Turn a CV line into evidence.")).toBeVisible()
  })

  it("asks to be notified about Proofs", async () => {
    renderPage(ProofsPage)
    const action = await screen.findByRole("button", {
      name: "Get early access",
    })
    expect(action).toHaveAttribute("data-variant", "primary")
    expect(action.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    const before = notifyCalls().length

    fireEvent.click(
      await screen.findByRole("button", { name: "Get early access" })
    )

    await waitFor(() =>
      expect(notifyCalls().slice(before)).toEqual([{ topic: "proof" }])
    )
  })

  it("shows an error next to the button when the request fails", async () => {
    renderPage(ProofsPage, (input) => {
      if (pathOf(input) === "/api/commands/notify.request")
        throw new Error("offline")
    })

    fireEvent.click(
      await screen.findByRole("button", { name: "Get early access" })
    )

    expect(await screen.findByRole("alert")).toBeInTheDocument()
  })

  it("keeps the decorative chart out of the accessibility tree", async () => {
    renderPage(ProofsPage)
    await screen.findByRole("heading", { level: 2 })

    expect(
      screen.getByText("Manager confirmed").closest("[aria-hidden='true']")
    ).not.toBeNull()
  })
})
