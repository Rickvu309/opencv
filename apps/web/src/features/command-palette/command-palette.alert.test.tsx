import { cleanup, fireEvent, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { renderApp } from "@/test/render-app.tsx"
import { failShellSearch } from "@/test/shell-api-mock.ts"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("command palette search", () => {
  it("keeps a visible focus cue on the search row, not a ring on the text", async () => {
    vi.stubGlobal("scrollTo", vi.fn())
    renderApp(SURFACE_PATHS.jobs)
    await screen.findByRole("heading", { name: "Jobs" })
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const dialog = await screen.findByRole("dialog", { name: "Search" })
    const box = within(dialog).getByRole("textbox", { name: "Search" })
    const row = box.closest("[data-slot='palette-search']")
    expect(row).not.toBeNull()
    expect(row?.className).toMatch(/has-\[input:focus-visible\]:border-ring/)
    expect(box.className).toMatch(/focus-visible:ring-0/)
    expect(box.className).not.toMatch(/focus-visible:ring-3/)
  })

  it("announces a failed search and retries it", async () => {
    vi.stubGlobal("scrollTo", vi.fn())
    failShellSearch(true)
    renderApp(SURFACE_PATHS.jobs)
    await screen.findByRole("heading", { name: "Jobs" })
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const dialog = await screen.findByRole("dialog", { name: "Search" })
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "acme" },
    })
    const alert = await within(dialog).findByRole("alert")
    expect(alert).toHaveTextContent("Could not search")
    expect(
      within(alert).getByRole("button", { name: "Retry" })
    ).toBeInTheDocument()
    failShellSearch(false)
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    await within(dialog).findByText('No results for "acme"')
    expect(within(dialog).queryByRole("alert")).toBeNull()
  })
})
