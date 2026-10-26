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

function glowCount() {
  return document.querySelectorAll('[data-variant="glow"]').length
}

describe("coming soon and the calm 404", () => {
  it("shows Jobs with one glow and a hidden preview", async () => {
    renderApp("/app/jobs")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Jobs, matched to you",
      })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("button", { name: "Notify me" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Track a job in Apply" })
    ).toHaveAttribute("href", "/app/apply")
    expect(glowCount()).toBe(1)
    const previewTitle = screen.getByText("Marketing Executive", {
      hidden: true,
    })
    expect(previewTitle.closest("[aria-hidden='true']")).not.toBeNull()
    expect(
      screen.queryByRole("button", { name: "Marketing Executive" })
    ).not.toBeInTheDocument()
  })

  it("posts jobs once and toasts the repeat", async () => {
    renderApp("/app/jobs")
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
    renderApp("/app/proofs")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Back your CV with proof",
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Track a job in Apply" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Get early access" }))
    await waitFor(() => {
      expect(notifyCalls()).toEqual([{ topic: "proof" }])
    })
    expect(glowCount()).toBe(1)
  })

  it("shows Pitch and posts pitch without an editor", async () => {
    renderApp("/app/pitch")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "One link that sells you",
      })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Get early access" }))
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

  it("redirects /app/proof to /app/proofs", async () => {
    const { router } = renderApp("/app/proof")
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Back your CV with proof",
      })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/app/proofs")
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
      expect(router.state.location.pathname).toBe("/app/apply")
    })
  })
})
