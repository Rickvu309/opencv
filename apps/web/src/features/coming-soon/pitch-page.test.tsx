import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { pathOf } from "@/test/mock-http.ts"
import { renderPage } from "@/test/render-app.tsx"
import { PitchPage } from "./pitch-page.tsx"
import { notifyCalls } from "@/test/shell-api-mock.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Pitch coming soon", () => {
  it("titles the page Pitch and reads the headline as one sentence", async () => {
    renderPage(PitchPage)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pitch" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "One link that sells you" })
    ).toBeInTheDocument()
    expect(screen.getByText("Your CV and Proofs on one page.")).toBeVisible()
  })

  it("keeps the header fixed above the scrolling body", async () => {
    renderPage(PitchPage)

    const title = await screen.findByRole("heading", {
      level: 1,
      name: "Pitch",
    })
    const header = title.closest('[data-slot="page-header"]')!
    expect(header).toHaveAttribute("data-surface", "coming-soon")
    expect(header.className).not.toMatch(/\bh-12\b|bg-background/)
    expect(header.nextElementSibling).toHaveClass("overflow-y-auto")
    expect(header.closest(".overflow-y-auto")).toBeNull()
  })

  it("asks to be notified about Pitch", async () => {
    renderPage(PitchPage)
    const action = await screen.findByRole("button", {
      name: "Get early access",
    })
    expect(action.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    const before = notifyCalls().length

    fireEvent.click(
      await screen.findByRole("button", { name: "Get early access" })
    )

    await waitFor(() =>
      expect(notifyCalls().slice(before)).toEqual([{ topic: "pitch" }])
    )
  })

  it("shows an error next to the button when the request fails", async () => {
    renderPage(PitchPage, (input) => {
      if (pathOf(input) === "/api/commands/notify.request")
        throw new Error("offline")
    })

    fireEvent.click(
      await screen.findByRole("button", { name: "Get early access" })
    )

    expect(await screen.findByRole("alert")).toBeInTheDocument()
  })

  it("keeps the mock profile out of the accessibility tree", async () => {
    renderPage(PitchPage)
    await screen.findByRole("heading", { level: 2 })

    expect(
      screen
        .getByText("Hanh Tran opened your Pitch")
        .closest("[aria-hidden='true']")
    ).not.toBeNull()
  })
})
