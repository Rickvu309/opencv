import "fake-indexeddb/auto"

import { afterEach, describe, expect, it, vi } from "vitest"

import { closeWritingDb, settlePage } from "./canvas-save.ts"

const DOC = "11111111-1111-7111-8111-111111111111"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const NEXT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const PARAGRAPH = "33333333-3333-4333-8333-333333333333"
const ADDRESS = "66666666-6666-4666-8666-666666666666"
const HASH = "ab".repeat(32)
const TARGET = `t_${"cd".repeat(32)}`
const REASON =
  "Paper cannot safely preserve a property attached to this text yet."

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function locked() {
  return {
    kind: "locked" as const,
    paragraph: ADDRESS,
    text: "1 Main Street",
    location: { paragraph: 1, kind: "paragraph" as const },
    reason: { code: "UNSUPPORTED_TARGET_PROPERTY", message: REASON },
    complete: true,
    continuation: false,
  }
}

function line(text: string) {
  return {
    kind: "editable" as const,
    paragraph: PARAGRAPH,
    targetId: TARGET,
    text,
    location: { paragraph: 2, kind: "paragraph" as const },
    formatting: {
      kind: "inherited" as const,
      scope: "preserved-uncomputed" as const,
    },
    context: { paragraphText: text },
  }
}

function read(text: string, revision: string) {
  return {
    generation: "package" as const,
    docId: DOC,
    revision,
    name: "Page.docx",
    kind: "letter" as const,
    packageHash: HASH,
    byteSize: 128,
    projector: "paper-package-spans-1",
    regions: [locked(), line(text)],
    nextCursor: null,
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
          Array.isArray((item as { input?: { edits?: unknown } }).input?.edits)
      )
      if (url.includes("/api/commands/paper.edit")) {
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
    const edit = bodies.find(
      (item) =>
        !!item &&
        typeof item === "object" &&
        "input" in item &&
        Array.isArray((item as { input?: { edits?: unknown } }).input?.edits)
    ) as { input: { edits: { before: string; after: string }[] } }
    expect(edit.input.edits[0]).toMatchObject({
      op: "replaceText",
      before: "Thank you",
      after: "Thank you QA.",
    })
  })
})
