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
import { SUGGESTION_POOLS } from "@/features/home/suggestions.ts"
import { createAppRouter } from "@/router.tsx"

function renderApp(initialEntry = SURFACE_PATHS.home) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })

  return {
    router,
    ...render(createElement(RouterProvider, { router })),
  }
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
  expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument()
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Home idle", () => {
  it("greets the placeholder User by time of day", async () => {
    renderApp()
    await expectHomeIdle()
    expect(screen.queryByText(/Eric/i)).not.toBeInTheDocument()
  })

  it("fills the composer when a suggestion chip is tapped", async () => {
    renderApp()
    await expectHomeIdle()

    const chip = SUGGESTION_POOLS[0]![0]!
    fireEvent.click(screen.getByRole("button", { name: chip.label }))

    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      chip.prompt
    )
  })

  it("sends on Enter and inserts a newline on Shift+Enter", async () => {
    renderApp()
    await expectHomeIdle()

    const composer = screen.getByRole("textbox", { name: "Message" })
    fireEvent.change(composer, { target: { value: "Help me plan the week" } })

    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true })
    expect(composer).toHaveValue("Help me plan the week")

    fireEvent.keyDown(composer, { key: "Enter", shiftKey: false })
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("")
    expect(
      screen.getByRole("status", { name: "Coach is working" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: new RegExp(
          `^Good (morning|afternoon|evening), ${DEFAULT_DEV_PROFILE_NAME}$`
        ),
      })
    ).not.toBeInTheDocument()
  })

  it("opens stub attach and upload items from the + menu", async () => {
    renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    const menu = await screen.findByRole("menu")
    expect(
      within(menu).getByRole("menuitem", { name: "Upload a file" })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: "Recent" })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: "Attach from Paper" })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: "Add connector" })
    ).toBeInTheDocument()
    expect(
      within(menu).queryByRole("menuitem", { name: /project/i })
    ).not.toBeInTheDocument()
  })

  it("opens Settings on the Connected apps tab from the connect row", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Connect apps" }))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: SURFACE_COPY.settings.title,
      })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.settings)
      expect(router.state.location.search).toMatchObject({ tab: "apps" })
    })
  })
})
