import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { SUGGESTION_POOLS } from "@/features/home/suggestions.ts"
import { renderApp } from "@/test/render-app.tsx"

async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: new RegExp(
        `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
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
          `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
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
      within(menu).getByRole("menuitem", { name: /upload a file/i })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: /recent/i })
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

  it("disables coming-soon composer affordances", async () => {
    renderApp()
    await expectHomeIdle()

    const mic = screen.getByRole("button", { name: "Voice input — coming soon" })
    expect(mic).toBeDisabled()
    expect(mic).toHaveAttribute("aria-disabled", "true")

    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    const menu = await screen.findByRole("menu")

    const upload = within(menu).getByRole("menuitem", {
      name: /upload a file/i,
    })
    const recent = within(menu).getByRole("menuitem", { name: /^recent/i })
    expect(upload).toHaveAttribute("aria-disabled", "true")
    expect(recent).toHaveAttribute("aria-disabled", "true")
    expect(upload).toHaveTextContent("Coming soon")
    expect(recent).toHaveTextContent("Coming soon")

    expect(
      within(menu).getByRole("menuitem", { name: "Attach from Paper" })
    ).not.toHaveAttribute("aria-disabled", "true")
    expect(
      within(menu).getByRole("menuitem", { name: "Add connector" })
    ).not.toHaveAttribute("aria-disabled", "true")
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
    expect(screen.getByRole("tab", { name: "Connected apps" })).toHaveAttribute(
      "data-active"
    )
    expect(screen.getByRole("heading", { name: "Gmail" })).toBeInTheDocument()
  })
})
