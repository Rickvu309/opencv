import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { DEFAULT_DEV_PROFILE_NAME } from "@/features/app-shell/dev-profile.ts"
import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { SEED_THREADS } from "@/features/home/threads.ts"
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
        `^Good (morning|afternoon|evening), ${DEFAULT_DEV_PROFILE_NAME}$`
      ),
    })
  ).toBeInTheDocument()
}

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
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
    await expectHomeIdle()

    const profile = screen.getByRole("link", {
      name: /profile and settings/i,
    })
    expect(profile).toHaveTextContent(/Alex Tran/)
    expect(profile).not.toHaveTextContent(/Eric Nguyen/)

    expect(
      screen.queryByRole("link", { name: "Settings" })
    ).not.toBeInTheDocument()

    fireEvent.click(profile)
    await expectStub("settings")
    expect(
      screen.getByRole("link", { name: /profile and settings/i })
    ).toHaveAttribute("aria-current", "page")
  })

  it("keeps nav usable after the sidebar collapses", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

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

async function openSearch() {
  fireEvent.click(screen.getByRole("button", { name: "Search" }))
  expect(
    await screen.findByRole("dialog", { name: "Search" })
  ).toBeInTheDocument()
}

describe("search modal", () => {
  it("opens from the sidebar and closes on Escape", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()
    await openSearch()

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search" })
      ).not.toBeInTheDocument()
    })
  })

  it("opens from Ctrl+K and from Meta+K", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search" })
      ).not.toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: "k", metaKey: true })
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()
  })

  it("jumps surfaces and starts a new chat", async () => {
    const { router } = renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()
    await openSearch()

    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "paper" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Open Paper" }))
    await expectStub("paper")
    expect(
      screen.queryByRole("dialog", { name: "Search" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })

    await openSearch()
    fireEvent.click(
      screen.getByRole("button", { name: "Create new private chat" })
    )
    await expectHomeIdle()
    expect(
      screen.queryByRole("dialog", { name: "Search" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)
    })
  })

  it("filters seed Thread titles", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()
    await openSearch()

    const dialog = screen.getByRole("dialog", { name: "Search" })
    expect(
      within(dialog).getByRole("button", { name: /CV vs internship first/ })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: /Checkout study/ })
    ).toBeInTheDocument()

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "checkout" },
    })

    expect(
      within(dialog).getByRole("button", { name: /Checkout study/ })
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: /CV vs internship first/ })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: /Is this role a fit/ })
    ).not.toBeInTheDocument()

    const other = SEED_THREADS.find((t) => !/checkout/i.test(t.title))
    expect(other).toBeTruthy()
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "zzzz-no-thread" },
    })
    expect(within(dialog).getByText("No conversations")).toBeInTheDocument()
  })

  it("opens a History Thread from Search and returns to idle on new chat", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectStub("paper")
    await openSearch()

    const dialog = screen.getByRole("dialog", { name: "Search" })
    fireEvent.click(
      within(dialog).getByRole("button", { name: /CV vs internship first/ })
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Open chat" }))

    expect(
      await screen.findByRole("log", { name: "Thread" })
    ).toHaveTextContent(SEED_THREADS[0]!.messages[0]!.text)
    expect(
      screen.queryByRole("dialog", { name: "Search" })
    ).not.toBeInTheDocument()

    await openSearch()
    fireEvent.click(
      screen.getByRole("button", { name: "Create new private chat" })
    )
    await expectHomeIdle()
    expect(screen.queryByRole("log", { name: "Thread" })).not.toBeInTheDocument()
  })
})


