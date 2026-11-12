import { cleanup, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp, renderPage } from "@/test/render-app.tsx"
import { InboxPage } from "@/routes/inbox.tsx"

describe("inbox route", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the connect screen inside the app shell", async () => {
    renderPage(InboxPage)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Inbox" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect Gmail" })
      ).toBeInTheDocument()
    })
  })

  it("redirects /inbox to the start page", async () => {
    const { router } = renderApp("/inbox")
    await screen.findByRole("heading", { level: 1, name: "Apply" })
    expect(router.state.location.pathname).toBe("/apply")
  })
})
