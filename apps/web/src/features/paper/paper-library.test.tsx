import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "@/test/render-with-client.tsx"
import {
  paperPackageMetadataSchema,
  parsePaperId,
  type PaperView,
} from "@workspace/domain"

import { PaperLibrary } from "./paper-library.tsx"
import {
  cv,
  letter,
  letterPaper,
  renderLibrary,
} from "./paper-library.fixtures.tsx"
import { importPaperFile, importPaperLink } from "./paper-api.ts"

vi.mock("./paper-api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./paper-api.ts")>()),
  importPaperFile: vi.fn(),
  importPaperLink: vi.fn(),
}))

async function openRename(doc: PaperView) {
  const user = userEvent.setup()
  renderLibrary([doc])
  await user.click(screen.getByRole("button", { name: `${doc.name} menu` }))
  await user.click(await screen.findByRole("menuitem", { name: "Rename" }))
  return user
}

function renameCommands(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith("/api/commands/paper.rename"))
    .map(([, init]) => JSON.parse(String(init?.body)))
}

afterEach(() => {
  document.body.removeAttribute("data-print")
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function missingImport(): never {
  throw new Error("Missing Import button")
}

describe("Paper library", () => {
  it("opens the full-page letter picker and returns to Paper", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(Response.json({ ok: true, data: [] }))
        )
    )
    renderLibrary([])
    fireEvent.click(screen.getByRole("button", { name: "Cover letter" }))
    expect(
      screen.getByRole("region", { name: "New cover letter" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Start a cover letter" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Attach a file" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Draft letter" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Paper", exact: true }))
    expect(screen.getByText("Start a document")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New", exact: true })
    ).toHaveFocus()
  })

  it("does not pass the cancel signal to the upload, so a keep-alive cancel leaves the server request running", async () => {
    vi.mocked(importPaperFile).mockImplementation(
      () => new Promise(() => undefined)
    )
    renderLibrary([])
    const file = new File(["CV"], "Linh_CV.pdf", { type: "application/pdf" })
    const input = document.querySelector('input[type="file"]')
    if (!input) throw new Error("Missing import input")
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByRole("status")).toHaveTextContent("Linh_CV.pdf")
    expect(vi.mocked(importPaperFile).mock.calls[0]?.[1]).toBeUndefined()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(vi.mocked(importPaperFile).mock.calls[0]?.[1]).toBeUndefined()
    expect(screen.getByText("Start a document")).toBeInTheDocument()
  })

  it("deletes a Word page that finishes importing after Cancel, and neither opens it nor shows the note", async () => {
    const created = {
      generation: "package" as const,
      docId: "22222222-2222-4222-8222-222222222222",
      revision: "33333333-3333-4333-8333-333333333333",
      name: "Linh_CV",
      kind: "cv" as const,
      packageHash: "a".repeat(64),
      byteSize: 1200,
      notice:
        "Imported the text of your PDF. Layout, fonts and photo were not kept.",
    }
    let finish: (value: typeof created) => void = () => undefined
    vi.mocked(importPaperFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const calls: { url: string; body: string }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: String(init?.body ?? "") })
      return Promise.resolve(
        Response.json({ ok: true, data: { docId: created.docId } })
      )
    })
    const onOpen = vi.fn()
    render(
      <PaperLibrary
        docs={[]}
        files={[]}
        loading={false}
        error={null}
        onRetry={() => undefined}
        onOpen={onOpen}
        query=""
        onQueryChange={() => undefined}
      />
    )
    const input = document.querySelector('input[type="file"]')
    if (!input) throw new Error("Missing import input")
    expect(input.getAttribute("accept")).toBe(
      ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
    )
    fireEvent.change(input, {
      target: {
        files: [new File(["CV"], "Linh_CV.pdf", { type: "application/pdf" })],
      },
    })
    expect(await screen.findByRole("status")).toHaveTextContent("Linh_CV.pdf")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await act(async () => {
      finish(created)
    })
    await vi.waitFor(() => {
      expect(
        calls.filter((call) =>
          call.url.split("?")[0]?.endsWith("/api/commands/paper.delete")
        )
      ).toHaveLength(1)
    })
    expect(
      calls.find((call) => call.url.includes("paper.delete"))?.body
    ).toContain(created.docId)
    expect(screen.queryByText(created.notice)).toBeNull()
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByText("Start a document")).toBeInTheDocument()
  })

  it("opens a Word import on the writing page", async () => {
    const word = paperPackageMetadataSchema.parse({
      generation: "package",
      docId: "33333333-3333-4333-8333-333333333333",
      revision: "44444444-4444-4444-8444-444444444444",
      name: "Original.docx",
      kind: "cv",
      packageHash: "b".repeat(64),
      byteSize: 1200,
    })
    vi.mocked(importPaperFile).mockResolvedValueOnce(word)
    const onOpen = vi.fn()
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: { code: "NOT_FOUND", message: "Snapshot unavailable" },
          },
          { status: 404 }
        )
      )
    )
    render(
      <PaperLibrary
        docs={[]}
        files={[]}
        loading={false}
        error={null}
        onRetry={() => undefined}
        onOpen={onOpen}
        query=""
        onQueryChange={() => undefined}
      />
    )
    const input = document.querySelector('input[type="file"]')
    if (!input) throw new Error("Missing import input")
    fireEvent.change(input, {
      target: { files: [new File(["Word"], word.name)] },
    })
    await vi.waitFor(() => {
      expect(onOpen).toHaveBeenCalledWith(word.docId)
    })
    expect(screen.queryByRole("dialog", { name: word.name })).toBeNull()
  })

  it("shows a failed import and lets the user retry with another file", async () => {
    vi.mocked(importPaperFile).mockRejectedValueOnce(
      new Error("Pages files aren't supported. Try a PDF or Word file.")
    )
    renderLibrary([])
    const input = document.querySelector('input[type="file"]')
    if (!input) throw new Error("Missing import input")
    fireEvent.change(input, {
      target: { files: [new File(["CV"], "Linh.pages")] },
    })
    expect(
      await screen.findByRole("heading", { name: "Can't read this file" })
    ).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pages files aren't supported"
    )
    expect(
      screen.getByRole("button", { name: "Start blank" })
    ).toBeInTheDocument()
    const retryInput = document.querySelector('input[type="file"]')
    if (!retryInput) throw new Error("Missing retry input")
    const picker = vi.spyOn(retryInput, "click")
    fireEvent.click(screen.getByRole("button", { name: "Choose another file" }))
    expect(picker).toHaveBeenCalledOnce()
  })

  it("drops a file on the import row and starts the same import", async () => {
    vi.mocked(importPaperFile).mockImplementation(
      () => new Promise(() => undefined)
    )
    renderLibrary([])
    const file = new File(["CV"], "Dropped.pdf", { type: "application/pdf" })
    fireEvent.click(
      screen.getAllByRole("button", { name: "Import", exact: true }).at(0) ??
        missingImport()
    )
    fireEvent.drop(screen.getByRole("region", { name: "Import a file" }), {
      dataTransfer: { files: [file] },
    })
    expect(await screen.findByRole("status")).toHaveTextContent("Dropped.pdf")
    expect(
      screen.getByRole("heading", { name: "Importing…" })
    ).toBeInTheDocument()
    expect(vi.mocked(importPaperFile)).toHaveBeenCalledWith(file)
  })

  it("posts a pasted link and shows the server sentence", async () => {
    vi.mocked(importPaperLink).mockRejectedValueOnce(
      new Error("Google Docs aren't supported. Download a PDF or Word file.")
    )
    renderLibrary([])
    fireEvent.click(
      screen.getAllByRole("button", { name: "Import", exact: true }).at(0) ??
        missingImport()
    )
    const field = screen.getByRole("textbox", { name: "Paste a link" })
    fireEvent.change(field, {
      target: { value: "https://docs.google.com/document/d/abc" },
    })
    fireEvent.keyDown(field, { key: "Enter" })
    expect(
      await screen.findByRole("heading", { name: "Can't read this file" })
    ).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google Docs aren't supported. Download a PDF or Word file."
    )
    expect(vi.mocked(importPaperLink)).toHaveBeenCalledWith(
      "https://docs.google.com/document/d/abc"
    )
  })

  it("offers three starter cards and opens import when there are no documents", () => {
    renderLibrary([])
    expect(screen.getByText("Start a document")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "CV" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Cover letter" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("textbox", { name: "Search Paper" })
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getAllByRole("button", { name: "Import", exact: true }).at(0) ??
        missingImport()
    )
    expect(
      screen.getByRole("dialog", { name: "Import", exact: true })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Choose file" })
    ).toBeInTheDocument()
  })

  it("prints the card from Download PDF", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.body).toHaveAttribute("data-print", "paper")
      expect(
        document.querySelector("[data-paper-print] .cv-template-internship")
      ).not.toBeNull()
      window.dispatchEvent(new Event("afterprint"))
    })
    renderLibrary([cv("PM track CV")])
    fireEvent.click(screen.getByRole("button", { name: "PM track CV menu" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("prints a letter card from Download PDF", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.body).toHaveAttribute("data-print", "paper")
      expect(
        document.querySelector("[data-paper-letter]")?.textContent
      ).toContain("One line for the letter.")
      window.dispatchEvent(new Event("afterprint"))
    })
    const letter: PaperView = {
      ...cv("Northwind letter"),
      id: "22222222-2222-4222-8222-222222222222",
      kind: "letter",
      templateId: null,
      paper: letterPaper(["One line for the letter."]),
    }
    renderLibrary([letter])
    fireEvent.click(
      screen.getByRole("button", { name: "Northwind letter menu" })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("offers no Download PDF for a Word page, which has no print body", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    const wordPage: PaperView = {
      ...cv("CV.docx"),
      id: parsePaperId("33333333-3333-4333-8333-333333333333"),
      format: "word",
    }
    renderLibrary([wordPage, cv("Block CV")])
    fireEvent.click(screen.getByRole("button", { name: "CV.docx menu" }))
    expect(
      await screen.findByRole("menuitem", { name: "Open" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "Download PDF" })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    fireEvent.click(screen.getByRole("button", { name: "Block CV menu" }))
    expect(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    ).toBeInTheDocument()
    expect(print).not.toHaveBeenCalled()
  })

  it("prints once in strict mode and unmounts the library sheet", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    render(
      <StrictMode>
        <PaperLibrary
          docs={[cv("PM track CV")]}
          files={[]}
          loading={false}
          error={null}
          onRetry={() => undefined}
          onOpen={() => undefined}
          query=""
          onQueryChange={() => undefined}
        />
      </StrictMode>
    )
    fireEvent.click(screen.getByRole("button", { name: "PM track CV menu" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.querySelector("[data-paper-print]")).not.toBeNull()
    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })
    expect(document.querySelector("[data-paper-print]")).toBeNull()
  })

  it("exposes Rename and Delete on the card menu", async () => {
    renderLibrary([cv("PM track CV")])
    fireEvent.click(screen.getByRole("button", { name: "PM track CV menu" }))
    const menu = await screen.findByRole("menu")
    expect(menu).toHaveTextContent("Rename")
    expect(menu).toHaveTextContent("Delete")
  })

  it.each([
    ["CV", cv("CV draft")],
    ["cover letter", letter("Letter draft")],
  ] as const)("submits a %s rename with Enter", async (_kind, doc) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ ok: true, data: { id: doc.id } }))
      )
    vi.stubGlobal("fetch", fetchMock)
    const user = await openRename(doc)
    const field = screen.getByRole("textbox", { name: "Name" })
    await user.clear(field)
    await user.type(field, "  Updated name  ")
    await user.keyboard("{Enter}")

    await vi.waitFor(() => {
      expect(renameCommands(fetchMock)).toHaveLength(1)
    })
    expect(renameCommands(fetchMock)[0]).toMatchObject({
      input: { docId: doc.id, name: "Updated name" },
    })
    await vi.waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: "Name" })
      ).not.toBeInTheDocument()
    })
  })

  it.each([
    ["CV", cv("CV draft")],
    ["cover letter", letter("Letter draft")],
  ] as const)(
    "keeps a %s rename draft on Enter validation errors",
    async (_kind, doc) => {
      const fetchMock = vi.fn<typeof fetch>()
      vi.stubGlobal("fetch", fetchMock)
      const user = await openRename(doc)
      const field = screen.getByRole("textbox", { name: "Name" })

      for (const [value, error] of [
        ["", "Name is required"],
        ["A".repeat(201), "Name is too long"],
      ]) {
        await user.clear(field)
        if (value !== "") await user.type(field, value)
        await user.keyboard("{Enter}")
        expect(await screen.findByText(error)).toBeInTheDocument()
        expect(field).toHaveValue(value)
        expect(
          screen.getByRole("textbox", { name: "Name" })
        ).toBeInTheDocument()
        expect(renameCommands(fetchMock)).toHaveLength(0)
      }
    }
  )

  it.each([
    ["a Word page", { format: "word", name: "Word CV.docx" }, true],
    ["an older document", {}, false],
  ] as const)(
    "deletes %s from the card menu and offers Undo only when it can be undone",
    async (_kind, extra, undoable) => {
      const doc = undoable
        ? { ...cv("Word CV.docx"), format: "word" as const }
        : cv("Word CV.docx")
      const activityId = "55555555-5555-4555-8555-555555555555"
      const fetchMock = vi.fn<typeof fetch>().mockImplementation((url) => {
        const path = String(url).split("?")[0] ?? ""
        if (path.endsWith("/api/commands/paper.delete"))
          return Promise.resolve(
            Response.json({ ok: true, data: { id: doc.id, ...extra } })
          )
        if (path.endsWith("/api/activity"))
          return Promise.resolve(
            Response.json({ ok: true, data: [{ id: activityId }] })
          )
        return Promise.resolve(Response.json({ ok: true, data: [] }))
      })
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderLibrary([doc])
      await user.click(screen.getByRole("button", { name: `${doc.name} menu` }))
      await user.click(await screen.findByRole("menuitem", { name: "Delete" }))
      expect(
        await screen.findByText(
          undoable
            ? "You can undo this from the message that follows."
            : "This can't be undone."
        )
      ).toBeInTheDocument()
      await user.click(await screen.findByRole("button", { name: "Delete" }))
      await vi.waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([url]) =>
            String(url).endsWith("/api/commands/paper.delete")
          )
        ).toBe(true)
      })
      const askedForUndo = () =>
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("/api/activity?subjectId=")
        )
      if (undoable) await vi.waitFor(() => expect(askedForUndo()).toBe(true))
      else {
        await vi.waitFor(() =>
          expect(
            screen.queryByRole("button", { name: "Delete" })
          ).not.toBeInTheDocument()
        )
        expect(askedForUndo()).toBe(false)
      }
    }
  )
})
