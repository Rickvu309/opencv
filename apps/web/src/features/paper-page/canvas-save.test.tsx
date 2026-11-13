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
  savedNote,
  settlePage,
} from "./canvas-save.ts"

const DOC = "11111111-1111-7111-8111-111111111111"
const PACKAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const NEXT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const PARAGRAPH = "33333333-3333-4333-8333-333333333333"
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

function lineOf(handle: string, text: string) {
  return {
    handle,
    text,
    pieces: text === "" ? [] : [{ text, editable: true }],
    held: false,
    message: "",
    code: null,
  }
}

function readResult(
  text: string,
  revision = REVISION,
  paragraphs: unknown[] = [lineOf(PARAGRAPH, text)]
) {
  return {
    doc: DOC,
    revision,
    name: "Page.docx",
    label: "letter" as const,
    paragraphs,
  }
}

function sentBatch(bodies: unknown[]) {
  const found = bodies.find(
    (item) =>
      !!item &&
      typeof item === "object" &&
      "input" in item &&
      (item as { input?: { op?: string } }).input?.op === "write"
  ) as { input: { batch: unknown } } | undefined
  return found?.input.batch
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
  it("says Saved only for words, or a cleared page, that match the receipt", () => {
    const matched = {
      saved: true,
      words: "Hello",
      revision: NEXT,
      note: null,
    }
    expect(savedNote("", { ...matched, words: "" })).toBe("Saved")
    expect(savedNote("Hello", { ...matched, words: "" })).toBeNull()
    expect(savedNote("Hello", { ...matched, saved: false })).toBeNull()
    expect(savedNote("Hello", { ...matched, words: "Hello!" })).toBeNull()
    expect(savedNote("Hello", { ...matched, revision: null })).toBeNull()
    expect(savedNote("Hello", matched)).toBe("Saved")
    expect(
      savedNote("Hello", {
        saved: false,
        words: "Hello",
        revision: null,
        note: "This page change is not available. No document was changed.",
      })
    ).toBe("This page change is not available. No document was changed.")
  })
})

describe("settlePage", () => {
  it("does not say saved for an empty page and does not write", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(ok(readResult("")))
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: "p1", text: "" }],
      new AbortController().signal
    )
    expect(saved).toEqual({
      saved: false,
      words: "",
      revision: null,
      note: null,
    })
    expect(calls.some((url) => url.includes("paper.canvas"))).toBe(false)
  })

  it("saves the first words when the receipt revision matches the read-back", async () => {
    const bodies: unknown[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
      bodies.push(body)
      if (url.includes("/api/commands/paper.canvas")) {
        return Promise.resolve(
          ok({
            ...packageResult(),
            revision: NEXT,
            restore: { id: INCARNATION, digest: HASH },
          })
        )
      }
      if (url.includes("/api/reads/paper.read")) {
        const wrote = bodies.some(
          (item) =>
            item &&
            typeof item === "object" &&
            "input" in item &&
            (item as { input?: { op?: string } }).input?.op === "write"
        )
        return Promise.resolve(
          ok(wrote ? readResult("Hello", NEXT) : readResult(""))
        )
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: "p1", text: "Hello" }],
      new AbortController().signal
    )
    expect(saved).toMatchObject({
      saved: true,
      words: "Hello",
      revision: NEXT,
      note: null,
      blocks: [{ id: PARAGRAPH, text: "Hello" }],
    })
    expect(sentBatch(bodies)).toEqual({
      doc: DOC,
      basedOn: REVISION,
      ops: [{ op: "setText", handle: PARAGRAPH, text: "Hello" }],
    })
  })

  it("keeps the words and shows why a save was refused", async () => {
    const reason =
      "This line mixes formatting, such as bold or a different font. Paper will not rewrite words across that formatting. No document was changed."
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(ok(readResult("Hello")))
      }
      if (url.includes("/api/commands/paper.canvas")) {
        return Promise.resolve(
          Response.json(
            { ok: false, error: { code: "CONFLICT", message: reason } },
            { status: 409 }
          )
        )
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello!" }],
      new AbortController().signal
    )
    expect(saved).toMatchObject({
      saved: false,
      words: "Hello!",
      note: null,
      refusedLines: [{ id: PARAGRAPH, text: "Hello!", note: reason }],
      pageRefusal: null,
    })
  })

  it("keeps the words when the server refuses", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("no", { status: 500 }))
    )
    const saved = await settlePage(
      DOC,
      [{ id: "p1", text: "Hello" }],
      new AbortController().signal
    )
    expect(saved).toEqual({
      saved: false,
      words: "Hello",
      revision: null,
      note: null,
    })
  })

  it("does not say saved when the read-back has different words", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.canvas")) {
        return Promise.resolve(ok({ ...packageResult(), revision: NEXT }))
      }
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(ok(readResult("Other", NEXT)))
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: "p1", text: "Hello" }],
      new AbortController().signal
    )
    expect(saved).toEqual({
      saved: false,
      words: "Hello",
      revision: null,
      note: null,
    })
  })

  it("saves a line typed after the first as one batch and reads it back", async () => {
    const next = "44444444-4444-4444-8444-444444444444"
    const table = "55555555-5555-4555-8555-555555555555"
    const cell = {
      handle: table,
      text: "Cell",
      pieces: [{ text: "Cell", editable: false }],
      held: true,
      message: "Stays.",
      code: "NOT_BODY",
    }
    const bodies: unknown[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      bodies.push(typeof init?.body === "string" ? JSON.parse(init.body) : null)
      if (url.includes("/api/commands/paper.canvas")) {
        return Promise.resolve(ok({ ...packageResult(), revision: NEXT }))
      }
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          ok(
            sentBatch(bodies)
              ? readResult("He", NEXT, [
                  lineOf(PARAGRAPH, "He"),
                  lineOf(next, "llo"),
                  lineOf(INCARNATION, "There"),
                  cell,
                ])
              : readResult("Hello", REVISION, [
                  lineOf(PARAGRAPH, "Hello"),
                  cell,
                ])
          )
        )
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [
        { id: PARAGRAPH, text: "He" },
        { id: "p2", text: "llo" },
        { id: "p3", text: "There" },
        { id: table, text: "Cell", held: true },
      ],
      new AbortController().signal,
      { basis: null, typed: true, caret: { blockId: "p3", offset: 5 } }
    )
    expect(sentBatch(bodies)).toEqual({
      doc: DOC,
      basedOn: REVISION,
      ops: [
        { op: "setText", handle: PARAGRAPH, text: "He" },
        { op: "insert", after: PARAGRAPH, text: "llo" },
        { op: "insert", after: PARAGRAPH, text: "There" },
      ],
    })
    expect(saved).toMatchObject({
      saved: true,
      words: "He\nllo\nThere\nCell",
      revision: NEXT,
      blocks: [
        { id: PARAGRAPH, text: "He" },
        { id: next, text: "llo" },
        { id: INCARNATION, text: "There" },
        { id: table, text: "Cell", held: true, reason: "Stays." },
      ],
    })
  })
  it("builds on its own write when the person typed again before it settled", async () => {
    const later = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    const server = { revision: REVISION, text: "Hello" }
    const replies = [
      { revision: NEXT, text: "Hello there" },
      { revision: later, text: "Hello there friend" },
    ]
    const outrun = new AbortController()
    const batches: unknown[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.canvas")) {
        batches.push(sentBatch([JSON.parse(String(init?.body))]))
        const reply = replies.shift()
        if (!reply)
          return Promise.resolve(new Response("gone", { status: 500 }))
        Object.assign(server, reply)
        outrun.abort()
        if (init?.signal?.aborted)
          return Promise.reject(new DOMException("aborted", "AbortError"))
        return Promise.resolve(
          ok({ ...packageResult(), revision: reply.revision })
        )
      }
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(ok(readResult(server.text, server.revision)))
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const claim = {
      basis: { revision: REVISION, words: "Hello" },
      typed: true,
    }
    const first = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      outrun.signal,
      claim
    )
    const second = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there friend" }],
      new AbortController().signal,
      claim
    )
    await first
    expect(await second).toMatchObject({
      saved: true,
      words: "Hello there friend",
      revision: later,
    })
    expect(batches[1]).toEqual({
      doc: DOC,
      basedOn: NEXT,
      ops: [{ op: "setText", handle: PARAGRAPH, text: "Hello there friend" }],
    })
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

  it("keeps the not-saved line when an empty page cannot read a Word document", async () => {
    let reads = 0
    vi.stubGlobal("fetch", () => {
      reads += 1
      return Promise.resolve(
        Response.json(
          {
            ok: false,
            error: {
              code: "NOT_FOUND",
              message: "This document could not be found.",
            },
          },
          { status: 404 }
        )
      )
    })
    render(<WritingCanvas docId={DOC} />)
    await waitFor(() => expect(reads).toBeGreaterThan(0))
    expect(await screen.findByText(/not saved yet/)).toBeVisible()
    expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
  })

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
