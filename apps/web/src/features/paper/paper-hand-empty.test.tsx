import { describe, expect, it, vi } from "vitest"

import { emptyHandCopy } from "./paper-hand-empty.tsx"

function copy(
  view: Parameters<typeof emptyHandCopy>[0]["view"],
  query = "",
  elsewhere = 0
) {
  return emptyHandCopy({
    view,
    query,
    elsewhere,
    onClearSearch: vi.fn(),
    onSearchAll: vi.fn(),
    onNewCV: vi.fn(),
    onNewLetter: vi.fn(),
    onOpenImport: vi.fn(),
  })
}

describe("empty hand copy", () => {
  it("gives each empty view its reason and one way to start", () => {
    expect(copy("cv")).toMatchObject({
      title: "No CVs yet",
      action: { label: "New CV", primary: true },
    })
    expect(copy("letter")).toMatchObject({
      title: "No letters yet",
      action: { label: "New Letter" },
    })
    expect(copy("files")).toMatchObject({
      title: "No files yet",
      action: { label: "Import a file" },
    })
  })

  it("names the search that missed and offers the way out", () => {
    expect(copy("all", " zzz ")).toMatchObject({
      title: "No documents match “zzz”",
      action: { label: "Clear search", primary: false },
    })
    expect(copy("letter", "simple", 1)).toMatchObject({
      title: "No letters match “simple”",
      why: "1 other document does.",
      action: { label: "Search all documents" },
    })
    expect(copy("cv", "grab", 3).why).toBe("3 other documents do.")
  })
})
