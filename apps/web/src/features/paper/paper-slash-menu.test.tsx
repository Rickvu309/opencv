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

describe("slash menu", () => {
  it("opens Insert from an empty block and inserts Projects", () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    render(
      <PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />
    )
    const field = screen.getByRole("textbox", {
      name: "What you did, and what changed because of it",
    })
    fireEvent.keyDown(field, { key: "/" })
    expect(screen.getByRole("listbox", { name: "Insert" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Summary/ })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Divider/ })).toBeInTheDocument()
    const filter = screen.getByRole("textbox", { name: "Type to filter" })
    fireEvent.keyDown(filter, { key: "ArrowDown" })
    fireEvent.keyDown(filter, { key: "Enter" })
    expect(document.querySelector('[data-section="projects"]')).not.toBeNull()
    expect(field.textContent).toBe("")
  })
})
