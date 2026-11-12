import "fake-indexeddb/auto"

import { afterEach, describe, expect, it, vi } from "vitest"

import { closeWritingDb, settlePage } from "./canvas-save.ts"

const DOC = "11111111-1111-7111-8111-111111111111"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const NEXT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const PARAGRAPH = "33333333-3333-4333-8333-333333333333"
const ADDRESS = "66666666-6666-4666-8666-666666666666"
const HASH = "ab".repeat(32)
const REASON =
  "Paper cannot safely preserve a property attached to this text yet."

function ok(data: unknown) {
  return Response.json({ ok: true, data })
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

function heldOf(handle: string, text: string, message: string) {
  return {
    handle,
    text,
    pieces: [{ text, editable: false }],
    held: true,
    message,
    code: "NOT_BODY",
  }
}

function read(text: string, revision: string) {
  return {
    doc: DOC,
    revision,
    name: "Page.docx",
    label: "letter" as const,
    paragraphs: [
      heldOf(ADDRESS, "1 Main Street", REASON),
      lineOf(PARAGRAPH, text),
    ],
  }
}

function receipt(revision: string) {
  return {
    generation: "package" as const,
    docId: DOC,
    revision,
    name: "Page.docx",
    kind: "letter" as const,
    packageHash: HASH,
    byteSize: 128,
    incarnation: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    restore: null,
  }
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await closeWritingDb()
  await new Promise<void>((resolve) => {
    const deleting = indexedDB.deleteDatabase("opencv-writing")
    deleting.onsuccess = () => resolve()
    deleting.onerror = () => resolve()
    deleting.onblocked = () => resolve()
  })
})

describe("imported letter save", () => {
  it("says saved when the page matches the locked line and the letter", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(ok(read("Thank you", REVISION)))
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [
        { id: ADDRESS, text: "1 Main Street", held: true },
        { id: PARAGRAPH, text: "Thank you" },
      ],
      new AbortController().signal,
      {
        basis: { revision: REVISION, words: "1 Main Street\nThank you" },
        typed: false,
      }
    )
    expect(saved.saved).toBe(true)
    expect(saved.basis).toEqual({
      revision: REVISION,
      words: "1 Main Street\nThank you",
    })
    expect(calls.some((url) => url.includes("paper.edit"))).toBe(false)
    expect(calls.some((url) => url.includes("paper.canvas"))).toBe(false)
  })

  it("says saved after the letter line is stored", async () => {
    const bodies: unknown[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
      bodies.push(body)
      const edited = bodies.some(
        (item) =>
          !!item &&
          typeof item === "object" &&
          "input" in item &&
          (item as { input?: { op?: string } }).input?.op === "write"
      )
      if (url.includes("/api/commands/paper.canvas")) {
        return Promise.resolve(ok(receipt(NEXT)))
      }
      if (url.includes("/api/reads/paper.read")) {
        const text = edited ? "Thank you QA." : "Thank you"
        return Promise.resolve(ok(read(text, edited ? NEXT : REVISION)))
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [
        { id: ADDRESS, text: "1 Main Street", held: true },
        { id: PARAGRAPH, text: "Thank you QA." },
      ],
      new AbortController().signal,
      {
        basis: { revision: REVISION, words: "1 Main Street\nThank you" },
        typed: true,
      }
    )
    expect(saved.saved).toBe(true)
    expect(saved.words).toBe("1 Main Street\nThank you QA.")
    const write = bodies.find(
      (item) =>
        !!item &&
        typeof item === "object" &&
        "input" in item &&
        (item as { input?: { op?: string } }).input?.op === "write"
    ) as { input: { batch: { ops: unknown[] } } }
    expect(write.input.batch.ops).toEqual([
      { op: "setText", handle: PARAGRAPH, text: "Thank you QA." },
    ])
  })
})
