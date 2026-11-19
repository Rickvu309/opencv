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
  it("adds every dropped file without opening any of them", async () => {
    vi.mocked(importPaperFile).mockResolvedValue({
      docId: "11111111-1111-4111-8111-000000000001",
      notice: null,
    } as Awaited<ReturnType<typeof importPaperFile>>)
    renderLibrary([cv("My CV")])
    const first = new File(["A"], "CV_Grab.docx")
    const second = new File(["B"], "Letter_to_MoMo.pdf")
    const dataTransfer = { types: ["Files"], files: [first, second] }
    fireEvent.dragOver(document.body, { dataTransfer })
    fireEvent.drop(document.body, { dataTransfer })
    await waitFor(() =>
      expect(vi.mocked(importPaperFile)).toHaveBeenCalledTimes(2)
    )
    expect(vi.mocked(importPaperFile).mock.calls.map(([file]) => file)).toEqual(
      [first, second]
    )
  })
})
