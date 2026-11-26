import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"
import { notifyCalls } from "@/test/shell-api-mock.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function primaryCount() {
  return document.querySelectorAll('[data-variant="primary"]').length
}

describe("coming soon and the calm 404", () => {
  it("shows Jobs with one solid primary and a hidden preview", async () => {
    renderApp("/jobs")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Jobs" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "Jobs, matched to you" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("button", { name: "Notify me" })
    ).toBeInTheDocument()
    const track = screen.getByRole("link", { name: "Track a job in Apply" })
    expect(track).toHaveAttribute("href", "/apply")
    expect(track.className).toMatch(/\bmin-h-11\b/)
    expect(track.className).toMatch(/\bmd:min-h-6\b/)
    expect(primaryCount()).toBe(1)
    const previewTitle = screen.getByText("Marketing Executive")
    expect(previewTitle.closest("[aria-hidden='true']")).not.toBeNull()
    expect(previewTitle.className).toMatch(/\bbreak-words\b/)
    expect(previewTitle.className).not.toMatch(/\btruncate\b/)
    expect(previewTitle.closest("[data-slot='jobs-preview']")).not.toBeNull()
    const fit = screen.getByText("82% fit")
    expect(fit.parentElement).toBe(previewTitle.parentElement)
    expect(fit.compareDocumentPosition(previewTitle)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    )
    expect(
      screen.queryByRole("button", { name: "Marketing Executive" })
    ).not.toBeInTheDocument()
  })

  it("titles Jobs in the shared header, outside the scrolling body", async () => {
    renderApp("/jobs")

    const title = await screen.findByRole("heading", { level: 1, name: "Jobs" })
    expect(title).toHaveAttribute("data-slot", "page-header-title")
    const header = title.closest('[data-slot="page-header"]')!
    expect(header).toHaveAttribute("data-surface", "coming-soon")
    expect(header.nextElementSibling).toHaveClass("overflow-y-auto")
  })

  it("posts jobs once and toasts the repeat", async () => {
    renderApp("/jobs")
    const notify = await screen.findByRole("button", { name: "Notify me" })

    fireEvent.click(notify)
    expect(await screen.findByText("You're on the list")).toBeInTheDocument()
    expect(notifyCalls()).toEqual([{ topic: "jobs" }])

    fireEvent.click(notify)
    expect(
      await screen.findByText("You're already on the list")
    ).toBeInTheDocument()
    expect(notifyCalls()).toEqual([{ topic: "jobs" }, { topic: "jobs" }])
  })

  it("shows Proofs with one action that posts proof", async () => {
    renderApp("/proofs")

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Back your CV with proof",
      })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.queryByRole("link", { name: "Track a job in Apply" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }))
    await waitFor(() => {
      expect(notifyCalls()).toEqual([{ topic: "proof" }])
    })
    expect(primaryCount()).toBe(1)
    expect(screen.getByRole("button", { name: "Notify me" })).toHaveAttribute(
      "data-variant",
      "primary"
    )
  })

  it("shows Pitch and posts pitch without an editor", async () => {
    renderApp("/pitch")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pitch" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "One link that sells you" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }))
    await waitFor(() => {
      expect(notifyCalls()).toEqual([{ topic: "pitch" }])
    })
    expect(
      screen.queryByRole("button", { name: "Publish" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit Pitch" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("redirects /proof to /proofs", async () => {
    const { router } = renderApp("/proof")
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Back your CV with proof",
      })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/proofs")
  })

  it("sends a signed-out profile path to sign in", async () => {
    setMockSession(null)
    const { router } = renderApp("/u/someone")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Go to sign in" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in")
    })
  })

  it("sends an unknown app path back to the start page", async () => {
    const { router } = renderApp("/app/nothing")

    fireEvent.click(
      await screen.findByRole("button", { name: "Back to start" })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/apply")
    })
  })

  it.each(["/home", "/app/home"])(
    "shows the 404 for the retired %s path, with a way back to the start page",
    async (path) => {
      const { router } = renderApp(path)

      expect(
        await screen.findByRole("heading", { level: 1, name: "Page not found" })
      ).toBeInTheDocument()
      fireEvent.click(
        await screen.findByRole("button", { name: "Back to start" })
      )
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/apply")
      })
    }
  )

  it("renders a signed-in profile path inside the shell", async () => {
    renderApp("/u/someone")

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Page not found",
    })
    const main = screen.getByRole("main")
    expect(document.querySelector("[data-slot='app-shell']")).toBeTruthy()
    expect(screen.getAllByRole("main")).toHaveLength(1)
    expect(main).toContainElement(heading)
    expect(main.className).not.toContain("min-h-dvh")
    expect(
      screen.getByRole("button", { name: "Back to start" })
    ).toBeInTheDocument()
  })

  it("renders a signed-out unknown app path as the bare 404", async () => {
    setMockSession(null)
    const { router } = renderApp("/app/nothing")

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Page not found",
    })
    expect(router.state.location.pathname).toBe("/nothing")
    expect(document.querySelector("[data-slot='app-shell']")).toBeNull()
    expect(screen.getAllByRole("main")).toHaveLength(1)
    expect(screen.getByRole("main")).toContainElement(heading)
    expect(screen.getByRole("main").className).toContain("min-h-dvh")
    expect(
      screen.getByRole("button", { name: "Go to sign in" })
    ).toBeInTheDocument()
  })

  it("renders a signed-in unknown app path inside one shell main", async () => {
    const { router } = renderApp("/app/nothing")

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Page not found",
    })
    const main = screen.getByRole("main")
    expect(document.querySelector("[data-slot='app-shell']")).toBeTruthy()
    expect(screen.getAllByRole("main")).toHaveLength(1)
    expect(main).toContainElement(heading)
    expect(main.className).not.toContain("min-h-dvh")
    expect(
      screen.getByRole("button", { name: "Back to start" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/nothing")
  })

  it("renders a signed-in root miss inside the shell", async () => {
    renderApp("/nothing")

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Page not found",
    })
    expect(document.querySelector("[data-slot='app-shell']")).toBeTruthy()
    expect(screen.getAllByRole("main")).toHaveLength(1)
    expect(screen.getByRole("main")).toContainElement(heading)
    expect(
      screen.getByRole("button", { name: "Back to start" })
    ).toBeInTheDocument()
  })
})
