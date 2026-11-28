import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import { PaperDocumentShare } from "./document-share.tsx"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it("copies the authenticated document URL without a share command", async () => {
  const previous = window.location.href
  window.history.replaceState(
    null,
    "",
    "/paper/16590000-0000-4000-8000-000000000001"
  )
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  render(<PaperDocumentShare docId="16590000-0000-4000-8000-000000000001" />)
  try {
    const copy = screen.getByRole("button", { name: "Copy link" })
    fireEvent.click(copy)
    await waitFor(() => expect(copy).toHaveAttribute("data-state", "copied"))
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(fetch).not.toHaveBeenCalled()
  } finally {
    window.history.replaceState(null, "", previous)
  }
})
