import "fake-indexeddb/auto"

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import {
  setWritingConflict,
  WRITING_CONFLICT_NOTE,
} from "@/lib/writing-refresh.ts"

import { WritingCanvas } from "./canvas.tsx"
import {
  loadDraft,
  loadDraftBasis,
  storeDraft,
  type WritingDraft,
} from "./canvas-edit.ts"
import { closeWritingDb, settlePage } from "./canvas-save.ts"

const DOC = "11111111-1111-7111-8111-111111111111"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const NEXT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const PARAGRAPH = "33333333-3333-4333-8333-333333333333"
const TARGET = `t_${"cd".repeat(32)}`
const BLUE = "The second line stays blue."
const GREEN = "The second line stays green."

function draft(text: string): WritingDraft {
  return {
    blocks: [{ id: "p1", text }],
    caret: { blockId: "p1", offset: text.length },
    nextId: 2,
  }
}

function readResult(text: string, revision = NEXT) {
  return {
    generation: "package" as const,
    docId: DOC,
    revision,
    name: "Page.docx",
    kind: "letter" as const,
    packageHash: "ab".repeat(32),
    byteSize: 128,
    projector: "paper-package-spans-1",
    regions: [
      {
        kind: "editable" as const,
        paragraph: PARAGRAPH,
        targetId: TARGET,
        text,
        location: { paragraph: 1, kind: "paragraph" as const },
        formatting: {
          kind: "inherited" as const,
          scope: "preserved-uncomputed" as const,
        },
        context: { paragraphText: text },
      },
    ],
    nextCursor: null,
  }
}

function articleWords() {
  const article = screen.getByRole("article", { name: "Page" })
  return [...article.querySelectorAll(":scope > p")]
    .map((block) => (block.textContent ?? "").replaceAll("\u200b", ""))
    .join("\n")
}

function stubGreen() {
  const calls: string[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes("/api/reads/paper.read")) {
      return Promise.resolve(
        Response.json({ ok: true, data: readResult(GREEN) })
      )
    }
    return Promise.resolve(Response.json({ ok: true, data: {} }))
  })
  return calls
}

afterEach(async () => {
  cleanup()
  localStorage.clear()
  setWritingConflict(null)
  vi.unstubAllGlobals()
  await closeWritingDb()
  await new Promise<void>((resolve, reject) => {
    const deleting = indexedDB.deleteDatabase("opencv-writing")
    deleting.onsuccess = () => resolve()
    deleting.onerror = () => reject(deleting.error)
    deleting.onblocked = () => resolve()
  })
})

describe("draft base", () => {
  it("reads a draft stored before a base existed", () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
    }
    storeDraft(DOC, draft(BLUE), storage)
    expect(loadDraft(DOC, storage)).toEqual(draft(BLUE))
    expect(loadDraftBasis(DOC, storage)).toBeNull()
    storeDraft(DOC, draft(`${BLUE} extra`), storage, {
      revision: REVISION,
      words: BLUE,
    })
    expect(loadDraft(DOC, storage)?.blocks[0]?.text).toBe(`${BLUE} extra`)
    expect(loadDraftBasis(DOC, storage)).toEqual({
      revision: REVISION,
      words: BLUE,
    })
  })

  it("adopts a newer read when the unchanged draft is empty", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          Response.json({ ok: true, data: readResult(GREEN) })
        )
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "" }],
      new AbortController().signal,
      { basis: { revision: REVISION, words: "" }, typed: false }
    )
    expect(saved.saved).toBe(false)
    expect(saved.replace?.blocks.map((block) => block.text)).toEqual([GREEN])
    expect(calls.some((url) => url.includes("/api/commands/"))).toBe(false)
  })

  it("does not write an unchanged draft over a newer read", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          Response.json({ ok: true, data: readResult(GREEN) })
        )
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: BLUE }],
      new AbortController().signal,
      { basis: { revision: REVISION, words: BLUE }, typed: false }
    )
    expect(saved.saved).toBe(false)
    expect(saved.replace?.blocks.map((block) => block.text)).toEqual([GREEN])
    expect(calls.some((url) => url.includes("/api/commands/"))).toBe(false)
  })

  it("keeps real unsent words when the read moved", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          Response.json({ ok: true, data: readResult(GREEN) })
        )
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const saved = await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: `${BLUE} extra` }],
      new AbortController().signal,
      { basis: { revision: REVISION, words: BLUE }, typed: true }
    )
    expect(saved.conflict).toBe(true)
    expect(saved.saved).toBe(false)
    expect(saved.words).toBe(`${BLUE} extra`)
    expect(saved.replace).toBeUndefined()
    expect(calls.some((url) => url.includes("/api/commands/"))).toBe(false)
  })
})

describe("WritingCanvas adopted edit", () => {
  it("shows a newer read when the stored page is still empty", async () => {
    const calls = stubGreen()
    storeDraft(DOC, draft(""), localStorage, {
      revision: REVISION,
      words: "",
    })
    render(
      <WritingCanvas docId={DOC} seed={draft("")} seedRevision={REVISION} />
    )
    await waitFor(() => expect(articleWords()).toBe(GREEN))
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/\bSaved\b/)
    )
    expect(calls.some((url) => url.includes("/api/commands/"))).toBe(false)
  })

  it("shows an approved edit after the page opens again", async () => {
    const calls = stubGreen()
    localStorage.setItem(`opencv-writing:${DOC}`, JSON.stringify(draft(BLUE)))
    render(
      <WritingCanvas docId={DOC} seed={draft(GREEN)} seedRevision={NEXT} />
    )
    await waitFor(() => expect(articleWords()).toBe(GREEN))
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/\bSaved\b/)
    )
    expect(calls.some((url) => url.includes("/api/commands/"))).toBe(false)
  })

  it("shows a conflict and keeps unsent typing", async () => {
    const calls = stubGreen()
    storeDraft(DOC, draft(`${BLUE} extra`), localStorage, {
      revision: REVISION,
      words: BLUE,
    })
    render(
      <WritingCanvas docId={DOC} seed={draft(BLUE)} seedRevision={REVISION} />
    )
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        WRITING_CONFLICT_NOTE
      )
    )
    expect(articleWords()).toBe(`${BLUE} extra`)
    expect(calls.some((url) => url.includes("/api/commands/"))).toBe(false)
    expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
  })
})
