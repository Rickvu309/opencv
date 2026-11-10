import "fake-indexeddb/auto"

import { afterEach, describe, expect, it, vi } from "vitest"

import { draftFromRegions, replaceVisible } from "./canvas-edit.ts"
import { closeWritingDb, settlePage } from "./canvas-save.ts"

const DOC = "11111111-1111-7111-8111-111111111111"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PARAGRAPH = "1dc024e9-1111-4111-8111-111111111111"
const EMAIL = "22222222-2222-4222-8222-222222222222"
const PROOF =
  "This text sits inside a spelling or grammar mark. Paper leaves that mark and its words unchanged."
const TARGET_A = `t_${"ab".repeat(32)}`
const TARGET_B = `t_${"cd".repeat(32)}`
const TARGET_EMAIL = `t_${"ef".repeat(32)}`
const PROJECTION =
  "This Word projection is no longer available. No document was changed."

function editable(
  paragraph: string,
  text: string,
  targetId: string,
  ordinal: number
) {
  return {
    kind: "editable" as const,
    paragraph,
    targetId,
    text,
    location: { paragraph: ordinal, kind: "paragraph" as const },
    formatting: {
      kind: "inherited" as const,
      scope: "preserved-uncomputed" as const,
    },
    context: { paragraphText: text },
  }
}

function proof(paragraph: string, text: string, ordinal: number) {
  return {
    kind: "locked" as const,
    paragraph,
    text,
    location: { paragraph: ordinal, kind: "paragraph" as const },
    reason: { code: "PROOFING_RANGE", message: PROOF },
    complete: true,
    continuation: false,
  }
}

function mixed() {
  return [
    proof(PARAGRAPH, "Name :", 1),
    editable(PARAGRAPH, "Your Name", TARGET_A, 1),
    editable(EMAIL, "Email: name@gmail.com", TARGET_EMAIL, 2),
    proof(PARAGRAPH, "MobileNo", 1),
    editable(PARAGRAPH, "555", TARGET_B, 1),
  ]
}

function read(regions: ReturnType<typeof mixed>) {
  return {
    generation: "package" as const,
    docId: DOC,
    revision: REVISION,
    name: "CV09.docx",
    kind: "cv" as const,
    packageHash: "ab".repeat(32),
    byteSize: 20623,
    projector: "paper-package-spans-1",
    regions,
    nextCursor: null,
  }
}

function ok(data: unknown) {
  return Response.json({ ok: true, data })
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

describe("mixed pieces", () => {
  it("keeps a held piece from replacing the open text beside it", () => {
    const draft = draftFromRegions(mixed())
    expect(draft).not.toBeNull()
    const ids = draft!.blocks.map((block) => block.id)
    expect(new Set(ids).size).toBe(ids.length)
    const next = replaceVisible(
      draft!,
      draft!.blocks.map((block) => ({
        id: block.id,
        text: block.text === "Your Name" ? "Your Name QA" : block.text,
      })),
      draft!.caret
    )
    expect(next.blocks.map((block) => block.text)).toEqual([
      "Name :",
      "Your Name QA",
      "Email: name@gmail.com",
      "MobileNo",
      "555",
    ])
    expect(next.blocks[0]?.held).toBe(true)
    expect(next.blocks[1]?.held).toBeUndefined()
  })

  it("does not copy a held piece when two rows share its identity", () => {
    const draft = {
      blocks: [
        { id: PARAGRAPH, text: "Name :", held: true, reason: PROOF },
        { id: PARAGRAPH, text: "Your Name" },
      ],
      caret: { blockId: PARAGRAPH, offset: 0 },
      nextId: 3,
    }
    const next = replaceVisible(
      draft,
      [
        { id: PARAGRAPH, text: "Name :" },
        { id: PARAGRAPH, text: "Your Name QA" },
      ],
      draft.caret
    )
    expect(next.blocks.map((block) => block.text)).toEqual([
      "Name :",
      "Your Name QA",
    ])
    expect(next.blocks[1]?.held).toBeUndefined()
  })

  it("sends only the edited email line", async () => {
    const calls: string[] = []
    const bodies: unknown[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(url)
      bodies.push(init?.body ? JSON.parse(String(init.body)) : null)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(ok(read(mixed())))
      }
      if (url.includes("/api/commands/paper.edit")) {
        return Promise.resolve(
          ok({
            generation: "package",
            docId: DOC,
            revision: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            name: "CV09.docx",
            kind: "cv",
            packageHash: "ab".repeat(32),
            byteSize: 20623,
            incarnation: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            restore: null,
          })
        )
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const draft = draftFromRegions(mixed())
    const blocks = draft!.blocks.map((block) =>
      block.text === "Email: name@gmail.com"
        ? { ...block, text: "Email: name@gmail.com QA" }
        : block
    )
    const saved = await settlePage(DOC, blocks, new AbortController().signal)
    expect(calls.some((url) => url.includes("/api/commands/paper.edit"))).toBe(
      true
    )
    const edit = bodies.find(
      (body): body is { input: { edits: unknown[] } } =>
        !!body &&
        typeof body === "object" &&
        "input" in body &&
        !!body.input &&
        typeof body.input === "object" &&
        "edits" in body.input &&
        Array.isArray(body.input.edits)
    )
    expect(edit?.input.edits).toEqual([
      {
        op: "replaceText",
        targetId: TARGET_EMAIL,
        before: "Email: name@gmail.com",
        after: "Email: name@gmail.com QA",
      },
    ])
    expect(saved.saved).toBe(false)
  })
})

describe("a refused save", () => {
  it("shows why a tab was not saved", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          ok(read([editable(EMAIL, "Email", TARGET_EMAIL, 1)]))
        )
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: EMAIL, text: "Email\t" }],
      new AbortController().signal
    )
    expect(calls.some((url) => url.includes("/api/commands/paper.edit"))).toBe(
      false
    )
    expect(saved.note).toBe(
      "This replacement contains text controls Paper cannot safely insert. Use plain text without tabs or line breaks."
    )
    expect(saved.saved).toBe(false)
    expect(saved.words).toBe("Email\t")
  })

  it("shows the old projection reason and what to do next", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          ok(read([editable(EMAIL, "Email", TARGET_EMAIL, 1)]))
        )
      }
      if (url.includes("/api/commands/paper.edit")) {
        return Promise.resolve(
          Response.json(
            { ok: false, error: { code: "CONFLICT", message: PROJECTION } },
            { status: 409 }
          )
        )
      }
      return Promise.resolve(new Response("missing", { status: 404 }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: EMAIL, text: "Email QA" }],
      new AbortController().signal
    )
    expect(saved.saved).toBe(false)
    expect(saved.words).toBe("Email QA")
    expect(saved.note).toBe(
      `${PROJECTION} Reload the page, then edit the text that is there.`
    )
  })
})
