import "fake-indexeddb/auto"

import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"

import { WritingCanvas } from "./canvas.tsx"
import { closeWritingDb, savedNote, settlePage } from "./canvas-save.ts"

const DOC = "11111111-1111-7111-8111-111111111111"
const PACKAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PARAGRAPH = "33333333-3333-4333-8333-333333333333"
const INCARNATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const HASH = "ab".repeat(32)

function revisionNumber(n: number) {
  return `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`
}

function handleNumber(n: number) {
  return `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`
}

type Line = { handle: string; text: string }
type Op =
  | { op: "setText"; handle: string; text: string }
  | { op: "insert"; after: string | null; text: string }
  | { op: "delete"; handle: string }
type Batch = { doc: string; basedOn: string; ops: Op[] }

type Busy = { status: number; retryAfter: string }

function fakeServer(text: string) {
  const state = {
    revision: revisionNumber(0),
    lines: [{ handle: PARAGRAPH, text }] as Line[],
    batches: [] as Batch[],
    committed: [] as string[],
    requests: [] as string[],
    offline: false,
    loseReplies: 0,
    busy: [] as Busy[],
  }
  let revisions = 0
  let handles = 0
  const words = () => state.lines.map((line) => line.text).join("\n")
  const lineOf = (line: Line) => ({
    handle: line.handle,
    text: line.text,
    pieces: line.text === "" ? [] : [{ text: line.text, editable: true }],
    held: false,
    message: "",
    code: null,
  })
  const apply = (batch: Batch) => {
    for (const op of batch.ops) {
      if (op.op === "setText") {
        const line = state.lines.find((item) => item.handle === op.handle)
        if (!line) throw new Error(`unknown handle ${op.handle}`)
        line.text = op.text
      } else if (op.op === "insert") {
        handles += 1
        const at =
          op.after === null
            ? 0
            : state.lines.findIndex((item) => item.handle === op.after) + 1
        state.lines.splice(at, 0, {
          handle: handleNumber(handles),
          text: op.text,
        })
      } else {
        state.lines = state.lines.filter((item) => item.handle !== op.handle)
      }
    }
    revisions += 1
    state.revision = revisionNumber(revisions)
    state.committed.push(words())
  }
  const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    state.requests.push(url)
    if (state.offline) return Promise.reject(new TypeError("Failed to fetch"))
    const busy = state.busy.shift()
    if (busy) {
      return Promise.resolve(
        Response.json(
          {
            ok: false,
            error: { code: "BUSY", message: "The server is busy." },
          },
          {
            status: busy.status,
            headers: { "Retry-After": busy.retryAfter },
          }
        )
      )
    }
    if (url.includes("/api/commands/paper.canvas")) {
      const body = JSON.parse(String(init?.body)) as {
        input: { batch: Batch }
      }
      const batch = body.input.batch
      state.batches.push(batch)
      if (batch.basedOn !== state.revision) {
        return Promise.resolve(
          Response.json(
            {
              ok: false,
              error: {
                code: "STALE",
                message:
                  "This Word document has changed. Read it again before editing.",
              },
            },
            { status: 409 }
          )
        )
      }
      apply(batch)
      if (state.loseReplies > 0) {
        state.loseReplies -= 1
        return Promise.reject(new TypeError("Failed to fetch"))
      }
      return Promise.resolve(
        Response.json({
          ok: true,
          data: {
            generation: "package",
            docId: PACKAGE,
            revision: state.revision,
            name: "Page.docx",
            kind: "letter",
            packageHash: HASH,
            byteSize: 128,
            incarnation: INCARNATION,
            restore: null,
          },
        })
      )
    }
    if (url.includes("/api/reads/paper.read")) {
      return Promise.resolve(
        Response.json({
          ok: true,
          data: {
            doc: DOC,
            revision: state.revision,
            name: "Page.docx",
            label: "letter",
            paragraphs: state.lines.map(lineOf),
          },
        })
      )
    }
    return Promise.resolve(new Response("missing", { status: 404 }))
  }
  vi.stubGlobal("fetch", fetch)
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => !state.offline)
  return { state, words }
}

function realTurn() {
  return new Promise<void>((resolve) => setImmediate(resolve))
}

async function realTurns(count = 50) {
  for (let turn = 0; turn < count; turn += 1) await realTurn()
}

async function turnsUntil(check: () => boolean) {
  for (let turn = 0; turn < 500; turn += 1) {
    if (check()) return
    await realTurn()
  }
  throw new Error("the page never reached the expected step")
}

function reconnect(state: { offline: boolean }) {
  state.offline = false
  window.dispatchEvent(new Event("online"))
}

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await closeWritingDb()
  await new Promise<void>((resolve, reject) => {
    const deleting = indexedDB.deleteDatabase("opencv-writing")
    deleting.onsuccess = () => resolve()
    deleting.onerror = () => reject(deleting.error)
    deleting.onblocked = () => resolve()
  })
})

describe("a save whose reply is lost after the server wrote it", () => {
  it("does not say Saved while the reply is missing, then says Saved without writing the words twice", async () => {
    const { state } = fakeServer("Hello")
    state.loseReplies = 1
    const claim = {
      basis: { revision: revisionNumber(0), words: "Hello" },
      typed: true,
    }
    const lost = await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      new AbortController().signal,
      claim
    )
    expect(lost).toMatchObject({ saved: false, words: "Hello there" })
    expect(savedNote("Hello there", lost)).toBeNull()
    expect(state.committed).toEqual(["Hello there"])

    const again = await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      new AbortController().signal,
      claim
    )
    expect(again).toMatchObject({
      saved: true,
      words: "Hello there",
      revision: revisionNumber(1),
    })
    expect(savedNote("Hello there", again)).toBe("Saved")
    expect(state.committed).toEqual(["Hello there"])
  })

  it("saves words typed after the lost reply on top of the page's own write instead of calling it a conflict", async () => {
    const { state, words } = fakeServer("Hello")
    state.loseReplies = 1
    const claim = {
      basis: { revision: revisionNumber(0), words: "Hello" },
      typed: true,
    }
    await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      new AbortController().signal,
      claim
    )
    const next = await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there friend" }],
      new AbortController().signal,
      claim
    )
    expect(next).not.toHaveProperty("conflict")
    expect(next).toMatchObject({
      saved: true,
      words: "Hello there friend",
      revision: revisionNumber(2),
    })
    expect(state.batches.at(-1)).toEqual({
      doc: DOC,
      basedOn: revisionNumber(1),
      ops: [{ op: "setText", handle: PARAGRAPH, text: "Hello there friend" }],
    })
    expect(state.committed).toEqual(["Hello there", "Hello there friend"])
    expect(words()).toBe("Hello there friend")
  })

  it("still reports a real conflict when someone else changed the page after the lost reply", async () => {
    const { state } = fakeServer("Hello")
    state.loseReplies = 1
    const claim = {
      basis: { revision: revisionNumber(0), words: "Hello" },
      typed: true,
    }
    await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      new AbortController().signal,
      claim
    )
    const line = state.lines[0]
    if (!line) throw new Error("missing line")
    line.text = "Hello from another tab"
    state.revision = revisionNumber(9)
    const next = await settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there friend" }],
      new AbortController().signal,
      claim
    )
    expect(next).toMatchObject({ saved: false, conflict: true })
    expect(state.committed).toEqual(["Hello there"])
  })
})

describe("words typed while the connection is down", () => {
  it("saves the latest words once, in order, when the connection returns", async () => {
    const { state, words } = fakeServer("Hello")
    state.offline = true
    const claim = {
      basis: { revision: revisionNumber(0), words: "Hello" },
      typed: true,
    }
    const first = new AbortController()
    const firstSave = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello th" }],
      first.signal,
      claim
    )
    first.abort()
    const second = new AbortController()
    const secondSave = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      second.signal,
      claim
    )
    second.abort()
    const lastSave = settlePage(
      DOC,
      [
        { id: PARAGRAPH, text: "Hello there" },
        { id: "typed-offline", text: "See you" },
      ],
      new AbortController().signal,
      claim
    )
    expect(await firstSave).toMatchObject({ saved: false })
    expect(await secondSave).toMatchObject({ saved: false })
    await turnsUntil(() => state.requests.length > 0)
    await realTurns()
    expect(state.committed).toEqual([])
    reconnect(state)
    expect(await lastSave).toMatchObject({
      saved: true,
      words: "Hello there\nSee you",
    })
    expect(state.committed).toEqual(["Hello there\nSee you"])
    expect(words()).toBe("Hello there\nSee you")
  })

  it("keeps Saved off on the page until the words reach the server after the connection returns", async () => {
    const { state } = fakeServer("")
    state.offline = true
    render(<WritingCanvas docId={DOC} />)
    const article = screen.getByRole("article", { name: "Page" })
    for (const data of ["Hello", " there"]) {
      const before = state.requests.length
      await act(async () => {
        article.dispatchEvent(
          new InputEvent("beforeinput", {
            inputType: "insertText",
            data,
            bubbles: true,
            cancelable: true,
          })
        )
      })
      await act(() => turnsUntil(() => state.requests.length > before))
    }
    await act(() => realTurns())
    expect(article.textContent?.replaceAll("​", "")).toContain("Hello there")
    expect(screen.getByRole("status").textContent).toMatch(/not saved yet/)
    expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
    expect(state.committed).toEqual([])
    await act(async () => {
      reconnect(state)
    })
    expect(await screen.findByText("Saved")).toBeVisible()
    expect(state.committed).toEqual(["Hello there"])
  })
})

describe.each([429, 503])("a %i reply with Retry-After", (status) => {
  it("waits the time the server asked before trying again, then saves the latest words once", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    const { state } = fakeServer("Hello")
    state.busy.push({ status, retryAfter: "5" })
    const claim = {
      basis: { revision: revisionNumber(0), words: "Hello" },
      typed: true,
    }
    const first = new AbortController()
    const firstSave = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      first.signal,
      claim
    )
    await turnsUntil(() => state.requests.length === 1)
    await realTurns()
    const refusedAt = state.requests.length
    first.abort()
    expect(await firstSave).toMatchObject({ saved: false })
    const latest = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there friend" }],
      new AbortController().signal,
      claim
    )
    await realTurns()
    await vi.advanceTimersByTimeAsync(4900)
    expect(state.requests.length).toBe(refusedAt)
    expect(state.committed).toEqual([])
    await vi.advanceTimersByTimeAsync(100)
    await turnsUntil(() => state.committed.length > 0)
    expect(await latest).toMatchObject({
      saved: true,
      words: "Hello there friend",
    })
    expect(state.committed).toEqual(["Hello there friend"])
  })

  it("tries again on its own after the wait when the person stops typing", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    const { state } = fakeServer("Hello")
    state.busy.push({ status, retryAfter: "3" })
    const pending = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      new AbortController().signal,
      { basis: { revision: revisionNumber(0), words: "Hello" }, typed: true }
    )
    await turnsUntil(() => state.requests.length === 1)
    await realTurns()
    await vi.advanceTimersByTimeAsync(2900)
    expect(state.requests.length).toBe(1)
    await vi.advanceTimersByTimeAsync(100)
    await turnsUntil(() => state.committed.length > 0)
    const outcome = await pending
    expect(outcome).toMatchObject({ saved: true, words: "Hello there" })
    expect(savedNote("Hello there", outcome)).toBe("Saved")
    expect(state.committed).toEqual(["Hello there"])
  })
})
