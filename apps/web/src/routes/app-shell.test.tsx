import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { createAppRouter } from "@/router.tsx"

function renderApp(initialEntry = "/") {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })

  return {
    router,
    ...render(createElement(RouterProvider, { router })),
  }
}

async function expectStub(surface: keyof typeof SURFACE_COPY) {
  const copy = SURFACE_COPY[surface]
  expect(
    await screen.findByRole("heading", { level: 1, name: copy.title })
  ).toBeInTheDocument()
  expect(screen.getByText(copy.body)).toBeInTheDocument()
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("app shell layout", () => {
  it("defaults the app root to Home", async () => {
    const { router } = renderApp("/")
    await expectStub("home")
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)
    })
  })

  it("opens Home at /app", async () => {
    renderApp("/app")
    await expectStub("home")
  })

  it("opens each surface at a stable URL", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectStub("paper")

    cleanup()
    renderApp(SURFACE_PATHS.apply)
    await expectStub("apply")

    cleanup()
    renderApp(SURFACE_PATHS.pitch)
    await expectStub("pitch")

    cleanup()
    renderApp(SURFACE_PATHS.settings)
    await expectStub("settings")
  })

  it("navigates Home → Paper → Home and keeps stub titles in the main pane", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectStub("home")

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectStub("paper")
    expect(
      screen.queryByRole("heading", { level: 1, name: "Home" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectStub("home")
    expect(
      screen.queryByRole("heading", { level: 1, name: "Paper" })
    ).not.toBeInTheDocument()
  })

  it("highlights the active surface and shows an Apply activity badge", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectStub("paper")

    expect(screen.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current"
    )

    const apply = screen.getByRole("link", { name: "Apply" })
    expect(apply.querySelector("[data-slot='badge']")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument()
  })

  it("opens Settings from the profile footer, not a demo persona", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectStub("home")

    const profile = screen.getByRole("link", {
      name: /profile and settings/i,
    })
    expect(profile).toHaveTextContent(/Alex Tran/)
    expect(profile).not.toHaveTextContent(/Eric Nguyen/)

    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument()

    fireEvent.click(profile)
    await expectStub("settings")
    expect(
      screen.getByRole("link", { name: /profile and settings/i })
    ).toHaveAttribute("aria-current", "page")
  })

  it("keeps nav usable after the sidebar collapses", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectStub("home")

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(
      screen.getByRole("button", { name: "Expand sidebar" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectStub("paper")
    expect(screen.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "aria-current",
      "page"
    )

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Paper" })).toHaveTextContent(
      "Paper"
    )
  })
})
