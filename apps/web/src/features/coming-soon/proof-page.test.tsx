import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { pathOf } from "@/test/mock-http.ts"
import { renderApp } from "@/test/render-app.tsx"
import { notifyCalls } from "@/test/shell-api-mock.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Proofs coming soon", () => {
  it("shows the Paper to Proofs breadcrumb as the page title", async () => {
    renderApp("/proofs")

    const title = await screen.findByRole("heading", { level: 1 })
    expect(title).toHaveTextContent("Paper")
    expect(title).toHaveTextContent("Proofs")
    expect(within(title).getByRole("link", { name: "Paper" })).toHaveAttribute(
      "href",
      "/paper"
    )
  })

  it("leads with the headline and the sub line", async () => {
    renderApp("/proofs")

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Back your CV with proof",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("Turn a CV line into evidence.")).toBeVisible()
  })

  it("asks to be notified about Proofs", async () => {
    renderApp("/proofs")
    const before = notifyCalls().length

    fireEvent.click(
      await screen.findByRole("button", { name: "Get early access" })
    )

    await waitFor(() =>
      expect(notifyCalls().slice(before)).toEqual([{ topic: "proof" }])
    )
  })

  it("shows an error next to the button when the request fails", async () => {
    renderApp("/proofs", (input) => {
      if (pathOf(input) === "/api/commands/notify.request")
        throw new Error("offline")
    })

    fireEvent.click(
      await screen.findByRole("button", { name: "Get early access" })
    )

    expect(await screen.findByRole("alert")).toBeInTheDocument()
  })

  it("keeps the decorative chart out of the accessibility tree", async () => {
    renderApp("/proofs")
    await screen.findByRole("heading", { level: 2 })

    expect(
      screen.getByText("Manager confirmed").closest("[aria-hidden='true']")
    ).not.toBeNull()
  })
})
