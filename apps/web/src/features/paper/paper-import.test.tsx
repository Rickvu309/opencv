import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { emptyCvDocument } from "@workspace/domain"

import { PaperCvEditor } from "./paper-editor.tsx"
import { PaperLibrary } from "./paper-library.tsx"
import type { PaperPages, PaperRecord } from "./paper-api.ts"

const record: PaperRecord = {
  id: "doc-1",
  name: "notes",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: emptyCvDocument(),
  contentVersion: 1,
  checks: [
    {
      id: "source-file",
      kind: "source",
      message: "notes.pdf",
      blockId: "",
      resolved: true,
    },
    {
      id: "phone",
      kind: "phone",
      message: "No phone number in your file.",
      blockId: "header.phone",
      resolved: false,
    },
  ],
  pageChoice: "unset",
  sourceFileId: "file-1",
  applyCardId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

const pages: PaperPages = { docId: record.id, pages: 1, pageChoice: "unset" }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("file import", () => {
  it("shows Importing and Cancel while the upload is in flight", async () => {
    vi.stubGlobal("fetch", () => new Promise(() => undefined))
    render(
      <PaperLibrary
        docs={[]}
        files={[]}
        loading={false}
        error={null}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />
    )
    const input = document.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement))
      throw new Error("missing file input")
    const file = new File(["hello"], "notes.pdf", { type: "application/pdf" })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText("Importing…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByText("Importing…")).not.toBeInTheDocument()
  })

  it("shows the phone check with Add phone and Skip", () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    render(
      <PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />
    )
    expect(screen.getByText("Phone missing")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add phone" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument()
    expect(screen.getByText("Imported from notes.pdf")).toBeInTheDocument()
  })
})
