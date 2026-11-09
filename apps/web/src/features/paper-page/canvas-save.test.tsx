import "fake-indexeddb/auto"

import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, screen, waitFor } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { draftFromWrite } from "@/lib/paper-package-ack.ts"

import { WritingCanvas } from "./canvas.tsx"
import {
  closeWritingDb,
  commitWords,
  decideSave,
  pageWords,
  savedNote,
  settlePage,
  wordsFromRegions,
} from "./canvas-save.ts"

const DOC = "11111111-1111-7111-8111-111111111111"
const PACKAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const INCARNATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const HASH = "ab".repeat(32)

function packageResult() {
  return {
    generation: "package" as const,
    docId: PACKAGE,
    revision: REVISION,
    name: "Page.docx",
    kind: "letter" as const,
    packageHash: HASH,
    byteSize: 128,
    incarnation: INCARNATION,
    restore: null,
  }
}

function readResult(text: string) {
  return {
    generation: "package" as const,
    docId: PACKAGE,
    revision: REVISION,
    name: "Page.docx",
    kind: "letter" as const,
    packageHash: HASH,
    byteSize: 128,
    projector: "paper-package-spans-1",
    regions: [
      {
        kind: "locked" as const,
        text,
        location: { paragraph: 1, kind: "paragraph" as const },
        reason: {
          code: "EMPTY_TARGET",
          message: "This text region is empty.",
        },
        complete: true,
        continuation: false,
      },
      {
        kind: "locked" as const,
        text: "",
        location: { paragraph: 2, kind: "paragraph" as const },
        reason: {
          code: "UNSUPPORTED_TARGET_PROPERTY",
          message:
            "Paper cannot safely preserve a property attached to this text yet.",
        },
        complete: true,
        continuation: false,
      },
    ],
    nextCursor: null,
  }
}

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  await closeWritingDb()
  await new Promise<void>((resolve, reject) => {
    const deleting = indexedDB.deleteDatabase("opencv-writing")
    deleting.onsuccess = () => resolve()
    deleting.onerror = () => reject(deleting.error)
    deleting.onblocked = () => resolve()
  })
})

describe("decideSave", () => {
  const words = "Hello"
  const draft = () =>
    draftFromWrite({ commandId: "cmd-1", generation: 3, words })

  it("says saved only when the local transaction and the receipt match", () => {
    const saved = decideSave(
      draft(),
      { transaction: "complete", generation: 3, words },
      { kind: "receipt", receipt: { commandId: "cmd-1", generation: 3, words } }
    )
    expect(saved.saved).toBe(true)
    expect(saved.words).toBe(words)
    expect(
      decideSave(
        draft(),
        { transaction: "pending", generation: 3, words },
        {
          kind: "receipt",
          receipt: { commandId: "cmd-1", generation: 3, words },
        }
      ).saved
    ).toBe(false)
    expect(
      decideSave(
        draft(),
        { transaction: "complete", generation: 3, words },
        {
          kind: "receipt",
          receipt: { commandId: "cmd-1", generation: 3, words: "Hello!" },
        }
      )
    ).toMatchObject({ saved: false, words })
  })

  it("keeps the words when the save is refused", () => {
    const refused = decideSave(
      draft(),
      { transaction: "complete", generation: 3, words },
      {
        kind: "refusal",
        commandId: "cmd-1",
        generation: 3,
      }
    )
    expect(refused).toMatchObject({ saved: false, words })
  })

  it("does not let an older receipt clear newer words", () => {
    const current = decideSave(
      draft(),
      { transaction: "complete", generation: 3, words },
      {
        kind: "receipt",
        receipt: { commandId: "cmd-1", generation: 1, words: "Gone" },
      }
    )
    expect(current).toMatchObject({ saved: false, words })
  })
})

describe("wordsFromRegions", () => {
  it("drops the section carrier and keeps the writing", () => {
    expect(
      wordsFromRegions([
        { text: "Hello", reason: { code: "EMPTY_TARGET" } },
        { text: "", reason: { code: "OPAQUE_OR_SECTION_BOUNDARY" } },
        { text: "", reason: { code: "UNSUPPORTED_TARGET_PROPERTY" } },
      ])
    ).toBe("Hello")
    expect(pageWords([{ text: "Hello" }, { text: "World" }])).toBe(
      "Hello\nWorld"
    )
  })
})

describe("commitWords", () => {
  it("completes a local transaction for the exact words", async () => {
    const first = await commitWords(DOC, "")
    expect(first.local).toEqual({
      transaction: "complete",
      generation: 1,
      words: "",
    })
    const again = await commitWords(DOC, "")
    expect(again.local.generation).toBe(1)
    const typed = await commitWords(DOC, "Hello")
    expect(typed.local).toEqual({
      transaction: "complete",
      generation: 2,
      words: "Hello",
    })
    expect(typed.record.commandId).toBe(first.record.commandId)
  })
})

describe("savedNote", () => {
  it("says Saved only for typed words that match the receipt", () => {
    expect(savedNote("", { saved: true, words: "" })).toBeNull()
    expect(savedNote("Hello", { saved: true, words: "" })).toBeNull()
    expect(savedNote("Hello", { saved: false, words: "Hello" })).toBeNull()
    expect(savedNote("Hello", { saved: true, words: "Hello!" })).toBeNull()
    expect(savedNote("Hello", { saved: true, words: "Hello" })).toBe("Saved")
  })
})

describe("settlePage", () => {
  it("mints once and says saved when the read-back matches", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(url)
      if (init?.signal?.aborted) return Promise.reject(new Error("aborted"))
      if (url.includes("/api/commands/paper.canvas"))
        return Promise.resolve(ok(packageResult()))
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(ok(readResult("")))
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const signal = new AbortController().signal
    const saved = await settlePage(DOC, "", signal)
    expect(saved).toEqual({ saved: true, words: "" })
    const replay = await settlePage(DOC, "", signal)
    expect(replay.saved).toBe(true)
    expect(calls.filter((url) => url.includes("paper.canvas"))).toHaveLength(1)
  })

  it("keeps the words when the server refuses", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("no", { status: 500 }))
    )
    const saved = await settlePage(DOC, "Hello", new AbortController().signal)
    expect(saved).toEqual({ saved: false, words: "Hello" })
  })

  it("does not say saved when the read-back has different words", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.canvas")) {
        return Promise.resolve(ok(packageResult()))
      }
      return Promise.resolve(ok(readResult("Other")))
    })
    const saved = await settlePage(DOC, "", new AbortController().signal)
    expect(saved).toEqual({ saved: false, words: "" })
  })
})

describe("WritingCanvas save", () => {
  function page() {
    const article = screen.getByRole("article", { name: "Page" })
    if (!(article instanceof HTMLElement)) throw new Error("missing page")
    return article
  }

  function stubRead(text: string) {
    let reads = 0
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.canvas")) {
        return Promise.resolve(ok(packageResult()))
      }
      if (url.includes("/api/reads/paper.read")) {
        reads += 1
        return Promise.resolve(ok(readResult(text)))
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    return () => reads
  }

  async function typeHello() {
    await act(async () => {
      page().dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertText",
          data: "Hello",
          bubbles: true,
          cancelable: true,
        })
      )
    })
  }

  it("does not say Saved for an empty document", async () => {
    const reads = stubRead("")
    render(<WritingCanvas docId={DOC} />)
    await waitFor(() => expect(reads()).toBeGreaterThan(0))
    expect(screen.getByRole("status").textContent).toMatch(/not saved yet/)
    expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
  })

  it("keeps typed words and does not say Saved when only the empty document was stored", async () => {
    const reads = stubRead("")
    render(<WritingCanvas docId={DOC} />)
    await waitFor(() => expect(reads()).toBeGreaterThan(0))
    const before = reads()
    await typeHello()
    await waitFor(() => expect(reads()).toBeGreaterThan(before))
    expect(page().textContent?.replaceAll("\u200b", "")).toContain("Hello")
    expect(screen.getByRole("status").textContent).toMatch(/not saved yet/)
    expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
  })

  it("says Saved when the typed words match the read-back", async () => {
    stubRead("Hello")
    render(<WritingCanvas docId={DOC} />)
    await typeHello()
    expect(await screen.findByText("Saved")).toBeVisible()
    expect(page().textContent?.replaceAll("\u200b", "")).toContain("Hello")
  })

  it("keeps the words when saving is refused", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("no", { status: 500 }))
    )
    render(<WritingCanvas docId={DOC} />)
    await act(async () => {
      page().dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertText",
          data: "Hello",
          bubbles: true,
          cancelable: true,
        })
      )
    })
    expect(await screen.findByText(/not saved yet/)).toBeVisible()
    expect(page().textContent?.replaceAll("\u200b", "")).toContain("Hello")
    expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
  })
})
