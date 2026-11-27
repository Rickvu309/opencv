import { afterEach, expect, it, vi } from "vitest"
import {
  nativeProvenance,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
import { storedFlowFixture } from "../../../../packages/paper-crdt/src/test/flow-fixture.ts"
import { apiRequest } from "./api.ts"
import { identity } from "./paper-sync-native.fixtures.ts"
import { downloadSavedRichWord } from "./paper-rich-word.ts"

vi.mock("./api.ts", () => ({ apiRequest: vi.fn() }))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.mocked(apiRequest).mockReset()
})

function fixture() {
  const provenance = nativeProvenance(storedFlowFixture("cv"))
  let current = true
  const saved = {
    canonical: '{"saved":"Việt 😀"}',
    kind: "cv" as const,
    identity: { ...identity, provenance, writer: RICH_NATIVE_WRITER },
    basis: { provenance, epoch: 1, revision: 7 },
    current: () => current,
  }
  const basis = { ...saved.basis, digest: "00".repeat(32) }
  const digest = vi.fn(async () => new ArrayBuffer(32))
  vi.stubGlobal("crypto", { subtle: { digest } })
  const create = vi.fn(() => "blob:word")
  const revoke = vi.fn()
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create
      static revokeObjectURL = revoke
    }
  )
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {})
  const response = new Response("DOCX bytes", {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "x-paper-basis": JSON.stringify(basis),
      "content-disposition":
        "attachment; filename=\"Paper.docx\"; filename*=UTF-8''CV%20Vi%E1%BB%87t.docx",
    },
  })
  vi.mocked(apiRequest).mockResolvedValue(response)
  return {
    saved,
    basis,
    digest,
    create,
    revoke,
    click,
    response,
    signal: new AbortController(),
    change: () => {
      current = false
    },
  }
}

it("downloads the qualified saved revision with its Unicode name and releases the URL", async () => {
  vi.useFakeTimers()
  const h = fixture()
  let name = ""
  h.click.mockImplementation(function (this: HTMLAnchorElement) {
    name = this.download
  })
  await downloadSavedRichWord(h.saved, h.signal.signal)
  expect(apiRequest).toHaveBeenCalledWith(
    `/api/paper/${identity.docId}/native-word?kind=cv`,
    expect.objectContaining({
      signal: h.signal.signal,
      headers: {
        "x-paper-writer": JSON.stringify(RICH_NATIVE_WRITER),
        "x-paper-basis": JSON.stringify(h.basis),
      },
    })
  )
  expect(name).toBe("CV Việt.docx")
  expect(h.click).toHaveBeenCalledTimes(1)
  expect(h.revoke).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1000)
  expect(h.revoke).toHaveBeenCalledWith("blob:word")
  expect(document.querySelector("a[download]")).toBeNull()
})

it.each(["CV%00.docx", "CV%7F.docx", "folder%2FCV.docx", "folder%5CCV.docx"])(
  "uses a safe fallback for an unsafe filename %s",
  async (encoded) => {
    vi.useFakeTimers()
    const h = fixture()
    h.response.headers.set(
      "content-disposition",
      `attachment; filename*=UTF-8''${encoded}`
    )
    let name = ""
    h.click.mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download
    })
    await downloadSavedRichWord(h.saved, h.signal.signal)
    expect(name).toBe("Paper.docx")
    await vi.advanceTimersByTimeAsync(1000)
  }
)

it.each(["digest", "response", "blob", "trigger"] as const)(
  "refuses a document change during %s",
  async (stage) => {
    const h = fixture()
    if (stage === "digest")
      h.digest.mockImplementation(async () => {
        h.change()
        return new ArrayBuffer(32)
      })
    if (stage === "response")
      vi.mocked(apiRequest).mockImplementation(async () => {
        h.change()
        return h.response
      })
    if (stage === "blob")
      vi.spyOn(h.response, "blob").mockImplementation(async () => {
        h.change()
        return new Blob(["late"])
      })
    if (stage === "trigger")
      h.create.mockImplementation(() => {
        h.change()
        return "blob:word"
      })
    await expect(
      downloadSavedRichWord(h.saved, h.signal.signal)
    ).rejects.toThrow("document changed")
    expect(h.click).not.toHaveBeenCalled()
    if (stage === "digest") expect(apiRequest).not.toHaveBeenCalled()
    if (stage === "trigger") expect(h.revoke).toHaveBeenCalledWith("blob:word")
  }
)

it.each(["missing", "revision", "digest", "mime"])(
  "refuses unqualified %s metadata",
  async (fault) => {
    const h = fixture()
    if (fault === "missing") h.response.headers.delete("x-paper-basis")
    if (fault === "revision")
      h.response.headers.set(
        "x-paper-basis",
        JSON.stringify({ ...h.basis, revision: 8 })
      )
    if (fault === "digest")
      h.response.headers.set(
        "x-paper-basis",
        JSON.stringify({ ...h.basis, digest: "ff".repeat(32) })
      )
    if (fault === "mime") h.response.headers.set("content-type", "text/html")
    await expect(
      downloadSavedRichWord(h.saved, h.signal.signal)
    ).rejects.toThrow()
    expect(h.create).not.toHaveBeenCalled()
    expect(h.click).not.toHaveBeenCalled()
  }
)

it("refuses an aborted session even when the response resolves successfully", async () => {
  const h = fixture()
  vi.mocked(apiRequest).mockImplementation(async () => {
    h.signal.abort()
    return h.response
  })
  await expect(
    downloadSavedRichWord(h.saved, h.signal.signal)
  ).rejects.toThrow()
  expect(h.click).not.toHaveBeenCalled()
})

it.each(["after", "during"])(
  "retains the file URL when its session ends %s the click",
  async (stage) => {
    vi.useFakeTimers()
    const h = fixture()
    if (stage === "during") h.click.mockImplementation(() => h.signal.abort())
    await downloadSavedRichWord(h.saved, h.signal.signal)
    h.signal.abort()
    expect(h.revoke).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(999)
    expect(h.revoke).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(h.revoke).toHaveBeenCalledExactlyOnceWith("blob:word")
  }
)

it.each([
  [
    "attachment; filename=\"Quoted.docx\"; filename*=UTF-8''CV%ZZ.docx",
    "Quoted.docx",
  ],
  ["attachment; filename*=UTF-8''CV%E1.docx", "Paper.docx"],
])(
  "falls back when an encoded filename is malformed: %s",
  async (disposition, expected) => {
    vi.useFakeTimers()
    const h = fixture()
    h.response.headers.set("content-disposition", disposition)
    let name = ""
    h.click.mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download
    })
    await downloadSavedRichWord(h.saved, h.signal.signal)
    expect(name).toBe(expected)
    await vi.advanceTimersByTimeAsync(1000)
  }
)

it("accepts a case-insensitive Word media type with parameters", async () => {
  vi.useFakeTimers()
  const h = fixture()
  h.response.headers.set(
    "content-type",
    "Application/Vnd.Openxmlformats-Officedocument.Wordprocessingml.Document; charset=binary"
  )
  await downloadSavedRichWord(h.saved, h.signal.signal)
  expect(h.click).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1000)
})
