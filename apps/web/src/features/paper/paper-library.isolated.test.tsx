import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import { parsePaperId } from "@workspace/domain/kernel"
import { type PaperView } from "@workspace/domain/paper-doc"

import { ApiError } from "@/lib/api-error.ts"

import { PaperLibrary } from "./paper-library.tsx"

vi.mock("@/features/apply/apply-api.ts", () => ({
  listJobs: vi.fn(() => Promise.resolve([])),
}))
import {
  cv,
  letterPaper,
  libraryRouter,
  renderLibrary,
} from "./paper-library.fixtures.tsx"
import { importPaperFile, importPaperLink } from "./paper-api.ts"

vi.mock("./paper-api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./paper-api.ts")>()),
  importPaperFile: vi.fn(),
  importPaperLink: vi.fn(),
}))

afterEach(() => {
  document.body.removeAttribute("data-print")
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("Paper library", () => {
  it("opens the Letter picker and can move into the Coach draft flow and back to Paper", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(Response.json({ ok: true, data: [] }))
        )
    )
    renderLibrary([])
    fireEvent.click(screen.getByRole("button", { name: "New Letter" }))
    const chooser = within(screen.getByRole("dialog", { name: "New Letter" }))
    expect(chooser.getByRole("radio", { name: "Blank" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(chooser.getByRole("button", { name: "Start blank" })).toBeEnabled()
    fireEvent.click(chooser.getByRole("button", { name: "Draft with Coach" }))
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
    fireEvent.click(screen.getByRole("button", { name: "Paper" }))
    expect(screen.queryByText("Start your first document")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus()
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
      libraryRouter(
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
    expect(screen.queryByText("Start your first document")).toBeInTheDocument()
  })

  it("shows a failed import and lets the user retry with another file", async () => {
    vi.mocked(importPaperFile).mockRejectedValueOnce(
      new ApiError(
        415,
        "FILE_UNSUPPORTED",
        "Pages files aren't supported. Try a PDF or Word file."
      )
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
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(
      document.querySelectorAll("[data-slot='dialog-content']")
    ).toHaveLength(1)
    const retryInput =
      document.querySelector<HTMLInputElement>('input[type="file"]')
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
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    fireEvent.drop(screen.getByRole("region", { name: "Import a file" }), {
      dataTransfer: { files: [file] },
    })
    expect(await screen.findByRole("status")).toHaveTextContent("Dropped.pdf")
    expect(
      screen.getByRole("heading", { name: "Importing…" })
    ).toBeInTheDocument()
    expect(vi.mocked(importPaperFile)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(importPaperFile)).toHaveBeenCalledWith(
      file,
      expect.any(AbortSignal)
    )
  })

  it("posts a pasted link and shows the server sentence", async () => {
    vi.mocked(importPaperLink).mockRejectedValueOnce(
      new Error("Google Docs aren't supported. Download a PDF or Word file.")
    )
    renderLibrary([])
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    const dialog = screen.getByRole("dialog", { name: "Import" })
    const field = within(dialog).getByRole("textbox", {
      name: "Paste a link",
    })
    const submit = within(dialog).getByRole("button", { name: "Import" })
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(vi.mocked(importPaperLink)).not.toHaveBeenCalled()
    fireEvent.change(field, {
      target: { value: "https://docs.google.com/document/d/abc" },
    })
    fireEvent.click(submit)
    expect(
      await screen.findByRole("heading", { name: "Can't read this file" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: "Import" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Paste a link" })).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google Docs aren't supported. Download a PDF or Word file."
    )
    expect(vi.mocked(importPaperLink)).toHaveBeenCalledWith(
      "https://docs.google.com/document/d/abc"
    )
  })

  it("offers section actions and opens import when there are no documents", () => {
    renderLibrary([])
    expect(screen.queryByText("Start your first document")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New CV" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New Letter" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("searchbox", { name: "Search Paper" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Show All" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    expect(screen.getByRole("dialog", { name: "Import" })).toBeInTheDocument()
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
      id: parsePaperId("22222222-2222-4222-8222-222222222222"),
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

  it("prints once in strict mode and unmounts the library sheet", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    render(
      libraryRouter(
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
})
