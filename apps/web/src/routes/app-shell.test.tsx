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

import { PLACEHOLDER_USER_NAME } from "@/features/app-shell/placeholder-user.ts"
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

async function expectStub(surface: Exclude<keyof typeof SURFACE_COPY, "home">) {
  const copy = SURFACE_COPY[surface]
  expect(
    await screen.findByRole("heading", { level: 1, name: copy.title })
  ).toBeInTheDocument()
  expect(screen.getByText(copy.body)).toBeInTheDocument()
}

async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: new RegExp(
        `^Good (morning|afternoon|evening), ${PLACEHOLDER_USER_NAME}$`
      ),
    })
  ).toBeInTheDocument()
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
    await expectHomeIdle()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)
    })
  })

  it("opens Home at /app", async () => {
    renderApp("/app")
    await expectHomeIdle()
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

  it("navigates Home → Paper → Home and keeps titles in the main pane", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectStub("paper")
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: /Good (morning|afternoon|evening)/,
      })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()
    expect(
      screen.queryByRole("heading", { level: 1, name: "Paper" })
    ).not.toBeInTheDocument()
  })
})
