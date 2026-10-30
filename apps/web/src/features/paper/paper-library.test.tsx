import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "@/test/render-with-client.tsx"
import { emptyCvDocument, type PaperView } from "@workspace/domain"

import { PaperLibrary } from "./paper-library.tsx"
import { importPaperFile, importPaperLink } from "./paper-api.ts"

vi.mock("./paper-api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./paper-api.ts")>()),
  importPaperFile: vi.fn(),
  importPaperLink: vi.fn(),
}))

function cv(name: string): PaperView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name,
    kind: "cv",
    templateId: "simple",
    status: "draft",
    document: emptyCvDocument(),
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
  }
}

function letter(name: string): PaperView {
  return {
    ...cv(name),
    id: "22222222-2222-4222-8222-222222222222",
    kind: "letter",
    templateId: null,
    document: { markdown: "A cover letter." },
  }
}

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
})

function renderLibrary(docs: PaperView[]) {
  render(
    <PaperLibrary
      docs={docs}
      files={[]}
      loading={false}
      error={null}
      onRetry={() => undefined}
      onOpen={() => undefined}
    />
  )
}

describe("Paper library", () => {
  it("shows import progress and cancels without opening a document", async () => {
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

  it("deletes the uploaded file when a cancelled import still returns", async () => {
    const created = {
      ...cv("sample"),
      sourceFileId:
        "22222222-2222-4222-8222-222222222222" as PaperView["sourceFileId"],
    }
    let finish: (value: PaperView) => void = () => undefined
    vi.mocked(importPaperFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Promise.resolve(
        Response.json({
          ok: true,
          data: { id: created.id, fileId: created.sourceFileId },
        })
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
      />
    )
    const input = document.querySelector('input[type="file"]')
    if (!input) throw new Error("Missing import input")
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
        calls.some((url) =>
          url.split("?")[0]?.endsWith("/api/commands/paper.delete")
        )
      ).toBe(true)
    })
    expect(onOpen).not.toHaveBeenCalled()
    expect(calls.some((url) => url.includes("paper.deleteFile"))).toBe(true)
    expect(screen.getByText("Start a document")).toBeInTheDocument()
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

  it("shows the three start cards and the import row when there are no documents", () => {
    renderLibrary([])
    expect(screen.getByText("Start a document")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "CV" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Cover letter" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Proof" })).toHaveAttribute(
      "href",
      "/proof"
    )
    expect(
      screen.getByRole("button", { name: "Choose file" })
    ).toBeInTheDocument()
  })

  it("names a CV card from the document and hides it when search misses", async () => {
    renderLibrary([cv("PM track CV")])
    expect(
      screen.getByRole("button", { name: /^PM track CV,/ })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Search Paper" }), {
      target: { value: "portfolio" },
    })

    expect(screen.getByText('No results for "portfolio"')).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^PM track CV,/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Try another word, or clear the search.")
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
      document: { markdown: "One line for the letter." },
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
      .mockResolvedValue(Response.json({ ok: true, data: { id: doc.id } }))
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
})
