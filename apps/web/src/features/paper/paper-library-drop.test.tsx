import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { cv, renderLibrary } from "./paper-library.fixtures.tsx"
import { importPaperFile } from "./paper-api.ts"

vi.mock("@/features/apply/apply-api.ts", () => ({
  listJobs: vi.fn(() => Promise.resolve([])),
}))

vi.mock("./paper-api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./paper-api.ts")>()),
  importPaperFile: vi.fn(),
  importPaperLink: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("Paper library drop", () => {
  it("shows Drop to add over the hand and imports a file dropped on the page", async () => {
    vi.mocked(importPaperFile).mockImplementation(
      () => new Promise(() => undefined)
    )
    renderLibrary([cv("My CV")])
    const file = new File(["CV"], "Page.pdf", { type: "application/pdf" })
    const dataTransfer = { types: ["Files"], files: [file] }
    fireEvent.dragOver(document.body, { dataTransfer })
    expect(screen.getByText("Drop to add")).toBeInTheDocument()
    fireEvent.drop(document.body, { dataTransfer })
    expect(await screen.findByText("Adding")).toBeInTheDocument()
    expect(screen.getAllByText("Page.pdf").length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(vi.mocked(importPaperFile)).toHaveBeenCalledTimes(1)
    )
    expect(vi.mocked(importPaperFile)).toHaveBeenCalledWith(
      file,
      expect.any(AbortSignal)
    )
  })
})
