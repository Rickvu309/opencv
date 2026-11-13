import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"

import { ApiError } from "@/lib/api-error.ts"

import { PaperLibrary } from "./paper-library.tsx"
import { importPaperFile } from "./paper-api.ts"

vi.mock("./paper-api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./paper-api.ts")>()),
  importPaperFile: vi.fn(),
}))

const PAGE = {
  generation: "package" as const,
  docId: "22222222-2222-4222-8222-222222222222",
  revision: "33333333-3333-4333-8333-333333333333",
  name: "Linh_CV",
  kind: "cv" as const,
  packageHash: "a".repeat(64),
  byteSize: 1200,
  notice: null,
}

const WAIT = "File not imported yet"
const REFUSED = "Can't read this file"

type Outcome = {
  label: string
  error: unknown
  sentence: string
  waitAndRetry: boolean
}

const OUTCOMES: Outcome[] = [
  {
    label: "one read at a time for the account",
    error: new ApiError(
      429,
      "IMPORT_READ_LIMITED",
      "Your last file is still being read. Import this one when it finishes."
    ),
    sentence:
      "Your last file is still being read. Import this one when it finishes.",
    waitAndRetry: true,
  },
  {
    label: "the hourly reading budget",
    error: new ApiError(
      429,
      "IMPORT_READ_LIMITED",
      "Your recent files took a long time to read, so reading files is paused for your account. Try again in 12 minutes."
    ),
    sentence: "Try again in 12 minutes.",
    waitAndRetry: true,
  },
  {
    label: "the service busy",
    error: new ApiError(
      503,
      "IMPORT_READ_BUSY",
      "Many files are being read right now. Try again in a minute."
    ),
    sentence: "Many files are being read right now. Try again in a minute.",
    waitAndRetry: true,
  },
  {
    label: "a gateway time-out with no JSON",
    error: new ApiError(
      504,
      "REQUEST_FAILED",
      "Could not import that file. Try it again."
    ),
    sentence: "Could not import that file. Try it again.",
    waitAndRetry: true,
  },
  {
    label: "a network error",
    error: new TypeError("Failed to fetch"),
    sentence: "Could not reach OpenCV. Check your connection, then try again.",
    waitAndRetry: true,
  },
  {
    label: "a reply the web cannot read",
    error: new Error('[{"code":"invalid_type","path":["data"]}]'),
    sentence: "Could not import that file. Try it again.",
    waitAndRetry: true,
  },
  {
    label: "PDF reading switched off",
    error: new ApiError(
      503,
      "IMPORT_READER_OFF",
      "Reading PDF files is switched off on this server for now. Import a Word or text file instead."
    ),
    sentence: "Import a Word or text file instead.",
    waitAndRetry: false,
  },
  {
    label: "a PDF over 20 pages",
    error: new ApiError(
      422,
      "FILE_UNSUPPORTED",
      "This PDF has more than 20 pages. Import a shorter CV."
    ),
    sentence: "This PDF has more than 20 pages. Import a shorter CV.",
    waitAndRetry: false,
  },
  {
    label: "a scanned PDF",
    error: new ApiError(
      422,
      "FILE_UNSUPPORTED",
      "This PDF has no text we can read. It may be a scan or a photo. Export it again from the app you wrote it in, or import a Word or text file."
    ),
    sentence: "It may be a scan or a photo.",
    waitAndRetry: false,
  },
  {
    label: "a file over 8 MB",
    error: new ApiError(
      413,
      "VALIDATION_ERROR",
      "File must be 8 MB or smaller."
    ),
    sentence: "File must be 8 MB or smaller.",
    waitAndRetry: false,
  },
  {
    label: "a PDF that cannot be read",
    error: new ApiError(
      415,
      "FILE_UNSUPPORTED",
      "We could not read this PDF. Export it again from the app you wrote it in, or import a Word or text file."
    ),
    sentence: "We could not read this PDF.",
    waitAndRetry: false,
  },
  {
    label: "a wrong file type",
    error: new ApiError(
      415,
      "FILE_UNSUPPORTED",
      "Upload a PDF, Word, or text file."
    ),
    sentence: "Upload a PDF, Word, or text file.",
    waitAndRetry: false,
  },
]

const FILES = [
  new File(["%PDF"], "Linh_CV.pdf", { type: "application/pdf" }),
  new File(["%PDF"], "Scan.pdf", { type: "application/pdf" }),
  new File(["Linh"], "Linh_CV.txt", { type: "text/plain" }),
  new File(["PK"], "Linh_CV.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
  new File(["{}"], "cv.json", { type: "application/json" }),
]

function abortable(signal: AbortSignal | undefined) {
  return new Promise<typeof PAGE>((_resolve, reject) => {
    signal?.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError"))
    )
  })
}

function serverCalls() {
  const calls: string[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    calls.push(String(input instanceof Request ? input.url : input))
    return Promise.resolve(Response.json({ ok: true, data: [] }))
  })
  return calls
}

function mount() {
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
  return onOpen
}

function pick(file: File) {
  const input = document.querySelector('input[type="file"]')
  if (!input) throw new Error("Missing import input")
  fireEvent.change(input, { target: { files: [file] } })
}

function signalOf(call: number) {
  const signal = vi.mocked(importPaperFile).mock.calls[call]?.[1]
  if (!signal) throw new Error(`Import ${call} had no cancel signal`)
  return signal
}

async function expectDialogClosed() {
  await vi.waitFor(() => {
    const dialog = screen.queryByRole("dialog")
    if (!dialog) return
    expect(dialog).toHaveAttribute("data-closed")
    expect(dialog.className).toContain("data-closed:pointer-events-none")
  })
  const dialog = screen.queryByRole("dialog")
  if (!dialog) return
  expect(dialog).toHaveAttribute("data-closed")
  expect(dialog.className).toContain("data-closed:pointer-events-none")
  const overlay = document.querySelector("[data-slot=dialog-overlay]")
  if (overlay) {
    expect(overlay).toHaveAttribute("data-closed")
    expect(overlay.className).toContain("data-closed:pointer-events-none")
  }
  dialog.dispatchEvent(new Event("transitionend", { bubbles: true }))
  overlay?.dispatchEvent(new Event("transitionend", { bubbles: true }))
}

afterEach(() => {
  cleanup()
  vi.mocked(importPaperFile).mockReset()
  vi.unstubAllGlobals()
})

describe("importing a file on Paper home", () => {
  it.each(FILES)(
    "sends $name with a cancel signal and opens the page it makes",
    async (file) => {
      serverCalls()
      vi.mocked(importPaperFile).mockResolvedValueOnce(PAGE)
      const onOpen = mount()
      pick(file)
      await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith(PAGE.docId))
      expect(vi.mocked(importPaperFile)).toHaveBeenCalledWith(
        file,
        expect.any(AbortSignal)
      )
      await expectDialogClosed()
      await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    }
  )

  it.each(OUTCOMES)(
    "shows the server's sentence for $label and a way on",
    async ({ error, sentence, waitAndRetry }) => {
      serverCalls()
      const file = FILES[0] ?? new File(["%PDF"], "Linh_CV.pdf")
      vi.mocked(importPaperFile)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(PAGE)
      const onOpen = mount()
      pick(file)
      expect(
        await screen.findByRole("heading", {
          name: waitAndRetry ? WAIT : REFUSED,
        })
      ).toBeVisible()
      expect(screen.getByRole("alert")).toHaveTextContent(sentence)
      expect(screen.queryByText(/Something went wrong/)).toBeNull()
      expect(screen.queryByRole("status")).toBeNull()
      if (waitAndRetry) {
        const again = screen.getByRole("button", { name: "Try again" })
        expect(again).toBeEnabled()
        fireEvent.click(again)
        await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith(PAGE.docId))
        expect(vi.mocked(importPaperFile).mock.calls[1]?.[0]).toBe(file)
        expect(screen.queryByRole("dialog")).toBeNull()
        return
      }
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
      const picker = document.querySelector('input[type="file"]')
      if (!picker) throw new Error("Missing import input")
      const opened = vi.spyOn(picker as HTMLInputElement, "click")
      const choose = screen.getByRole("button", { name: "Choose another file" })
      expect(choose).toBeEnabled()
      fireEvent.click(choose)
      expect(opened).toHaveBeenCalledOnce()
      expect(onOpen).not.toHaveBeenCalled()
    }
  )

  it("lets the person close a refusal and import again", async () => {
    serverCalls()
    vi.mocked(importPaperFile)
      .mockRejectedValueOnce(
        new ApiError(503, "IMPORT_READ_BUSY", "Many files are being read.")
      )
      .mockResolvedValueOnce(PAGE)
    const onOpen = mount()
    pick(FILES[2] ?? new File(["x"], "a.txt"))
    await screen.findByRole("heading", { name: WAIT })
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    pick(FILES[2] ?? new File(["x"], "a.txt"))
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith(PAGE.docId))
  })

  it.each([
    ["the Cancel button", () => fireEvent.click(cancelButton())],
    [
      "closing the dialog",
      () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }),
    ],
  ])(
    "stops the upload when the person uses %s, and makes and opens nothing",
    async (_how, stop) => {
      const calls = serverCalls()
      vi.mocked(importPaperFile).mockImplementation((_file, signal) =>
        abortable(signal)
      )
      const onOpen = mount()
      pick(FILES[0] ?? new File(["%PDF"], "Linh_CV.pdf"))
      expect(await screen.findByRole("status")).toHaveTextContent("Linh_CV.pdf")
      expect(signalOf(0).aborted).toBe(false)
      stop()
      expect(signalOf(0).aborted).toBe(true)
      await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
      expect(onOpen).not.toHaveBeenCalled()
      expect(calls.filter((url) => url.includes("paper.delete"))).toEqual([])
      expect(screen.getByText("Start a document")).toBeInTheDocument()
    }
  )

  it("stops the first upload when the person starts a second, and opens only the second", async () => {
    serverCalls()
    vi.mocked(importPaperFile)
      .mockImplementationOnce((_file, signal) => abortable(signal))
      .mockResolvedValueOnce({
        ...PAGE,
        docId: "44444444-4444-4444-8444-444444444444",
      })
    const onOpen = mount()
    pick(FILES[0] ?? new File(["%PDF"], "Linh_CV.pdf"))
    await screen.findByRole("status")
    pick(FILES[3] ?? new File(["PK"], "Linh_CV.docx"))
    await vi.waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(
        "44444444-4444-4444-8444-444444444444"
      )
    )
    expect(signalOf(0).aborted).toBe(true)
    expect(signalOf(1).aborted).toBe(false)
    expect(onOpen).toHaveBeenCalledOnce()
    expect(screen.queryByRole("heading", { name: WAIT })).toBeNull()
  })

  it("stops the upload when the person leaves Paper home", async () => {
    serverCalls()
    vi.mocked(importPaperFile).mockImplementation((_file, signal) =>
      abortable(signal)
    )
    mount()
    pick(FILES[0] ?? new File(["%PDF"], "Linh_CV.pdf"))
    await screen.findByRole("status")
    cleanup()
    expect(signalOf(0).aborted).toBe(true)
  })
})

function cancelButton() {
  return screen.getByRole("button", { name: "Cancel" })
}
