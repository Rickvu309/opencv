import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { PaperCvEditor } from "./paper-editor.tsx"
import {
  render,
  record,
  pages,
  inputOf,
  ok,
  fail,
} from "./paper-editor.fixtures.tsx"

afterEach(() => {
  cleanup()
  document
    .querySelectorAll("[data-paper-measure]")
    .forEach((node) => node.remove())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("CV editor favorite", () => {
  it("uses the stored favorite and lets a failed save retry", async () => {
    const favoriteInput: Array<{ docId: string; isFavorite: boolean }> = []
    let attempts = 0
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.setFavorite")) {
        favoriteInput.push(inputOf(init))
        attempts += 1
        return Promise.resolve(
          attempts === 1
            ? fail(500, "INTERNAL", "Favorite save failed")
            : ok({ docId: record.id, isFavorite: false })
        )
      }
      return Promise.resolve(ok({ ...record, isFavorite: false }))
    })
    const view = render(
      <PaperCvEditor
        initial={{ ...record, isFavorite: true }}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    const favorite = screen.getByRole("button", { name: "Favorite" })
    expect(favorite).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(favorite)
    await screen.findByText("Favorite save failed")
    expect(favorite).toBeEnabled()
    expect(favorite).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(favorite)
    await vi.waitFor(() => expect(attempts).toBe(2))
    expect(favoriteInput).toEqual([
      { docId: record.id, isFavorite: false },
      { docId: record.id, isFavorite: false },
    ])
    view.rerender(
      <PaperCvEditor
        initial={{ ...record, isFavorite: false }}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(favorite).toHaveAttribute("aria-pressed", "false")
  })
})
