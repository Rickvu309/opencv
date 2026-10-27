import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { emptyCvDocument } from "@workspace/domain"

import { PaperCvEditor } from "./paper-editor.tsx"
import type { PaperPages, PaperRecord } from "./paper-api.ts"

const record: PaperRecord = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: emptyCvDocument(),
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  applyCardId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

const pages: PaperPages = { docId: record.id, pages: 1, pageChoice: "unset" }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function openMenu(index: number) {
  fireEvent.click(screen.getAllByRole("button", { name: "Block menu" })[index]!)
}

describe("block menu", () => {
  it("offers turn into, duplicate, move, Ask Coach and delete", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    render(
      <PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />
    )
    openMenu(0)
    expect(
      await screen.findByRole("menuitem", { name: /Turn into/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: /Duplicate/ })
    ).toHaveTextContent("⌘ D")
    expect(screen.getByRole("menuitem", { name: /Move up/ })).toHaveTextContent(
      "⌘ ⇧ ↑"
    )
    expect(
      screen.getByRole("menuitem", { name: /Move down/ })
    ).toHaveTextContent("⌘ ⇧ ↓")
    expect(
      screen.getByRole("menuitem", { name: "Ask Coach" })
    ).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveTextContent(
      "Del"
    )
  })

  it("duplicates a block and deletes the middle block", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    render(
      <PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />
    )
    const before = screen.getAllByRole("textbox").length
    openMenu(1)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Duplicate/ }))
    expect(screen.getAllByRole("textbox").length).toBe(before + 1)

    openMenu(1)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }))
    expect(
      screen.queryByRole("textbox", { name: "Dates" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Role, company" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", {
        name: "What you did, and what changed because of it",
      })
    ).toBeInTheDocument()
  })
})
