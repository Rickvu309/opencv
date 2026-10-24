// @vitest-environment jsdom
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { samplePaperDocs } from "@/test/paper-fixtures.ts"

import { PaperDrive } from "./paper-drive.tsx"

afterEach(cleanup)

const noop = () => undefined

function drive(props: Partial<Parameters<typeof PaperDrive>[0]> = {}) {
  const docs = samplePaperDocs()
  const onOpen = vi.fn()
  const onKind = vi.fn()
  render(
    createElement(PaperDrive, {
      docs,
      kind: "all",
      onKind,
      counts: { all: docs.length, cv: 1, letter: 1, proof: 1 },
      isLoading: false,
      loadFailed: false,
      onReload: noop,
      creating: false,
      query: "",
      onQuery: noop,
      companyOf: () => undefined,
      zeroStates: [],
      onZeroState: noop,
      onCreate: noop,
      onOpen,
      rowActions: () => ({
        onMakeMine: noop,
        onRename: noop,
        onStatus: noop,
        onLink: noop,
        onDelete: noop,
      }),
      ...props,
    })
  )
  return { onOpen, onKind }
}

describe("PaperDrive", () => {
  it("says it is loading, shows skeleton rows and mounts no table while the call is held", () => {
    drive({
      isLoading: true,
      docs: [],
      counts: { all: 0, cv: 0, letter: 0, proof: 0 },
    })
    expect(screen.getByText("Loading documents…")).toBeInTheDocument()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByText(/No documents yet/)).toBeNull()
    expect(screen.queryByRole("radiogroup")).toBeNull()
    expect(
      document.querySelectorAll("[data-slot='shimmer-skeleton']")
    ).toHaveLength(9)
  })

  it("lists the documents in a stock table once the call answers", () => {
    drive()
    const table = screen.getByRole("table")
    expect(table).toHaveAttribute("data-slot", "table")
    expect(screen.getAllByRole("row")).toHaveLength(
      samplePaperDocs().length + 1
    )
    expect(screen.queryByText("Loading documents…")).toBeNull()
  })

  it("opens a document from its name with no pointer row click", () => {
    const { onOpen } = drive()
    fireEvent.click(screen.getByRole("button", { name: "Open PM track CV" }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith("11111111-1111-7111-8111-111111111111")
  })

  it("filters by kind through the segmented control and shows counts", async () => {
    const { onKind } = drive()
    const group = await screen.findByRole("radiogroup", { name: "Show" })
    expect(group).toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: /Letter/ }))
    expect(onKind).toHaveBeenCalledWith("letter")
  })

  it("shows the layer stack and a different sentence for an empty drive", async () => {
    drive({ docs: [], counts: { all: 0, cv: 0, letter: 0, proof: 0 } })
    expect(screen.getByText(/No documents yet/)).toBeInTheDocument()
    expect(
      await screen.findByRole("tablist", { name: "Layers" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByRole("radiogroup")).toBeNull()
  })

  it("keeps the match sentence when a search or a kind filter finds nothing", () => {
    drive({ docs: [], query: "zzz" })
    expect(
      screen.getByText("No documents match that search.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("tablist", { name: "Layers" })).toBeNull()
  })
})
