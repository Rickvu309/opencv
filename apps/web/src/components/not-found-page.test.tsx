import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("not-found page", () => {
  it("sends a signed-out visitor of a removed page to sign in", async () => {
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

  it.each(["/u/someone", "/pitch", "/jobs", "/proofs", "/proof", "/upgrade"])(
    "renders the removed page %s as the 404 inside the shell",
    async (path) => {
      renderApp(path)

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
    }
  )

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
