import { afterEach, describe, expect, it, vi } from "vitest"
import { act, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { WritingCanvas } from "./canvas.tsx"
import { savedNote, settlePage } from "./canvas-save.ts"
import {
  DOC,
  cleanNetworkPage,
  PARAGRAPH,
  revisionNumber,
  fakeServer,
  realTurns,
  turnsUntil,
  reconnect,
} from "./test/canvas-network.fixtures.ts"

afterEach(cleanNetworkPage)

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
    expect(state.attempts).toHaveLength(2)
    expect(state.attempts[1]).toEqual(state.attempts[0])
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
    expect(state.attempts).toHaveLength(3)
    expect(state.attempts[1]).toEqual(state.attempts[0])
    expect(state.attempts[2]?.idempotencyKey).not.toBe(
      state.attempts[0]?.idempotencyKey
    )
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

describe("saves queued behind a lost reply", () => {
  it("sends no second command when the retry finds the words already on the server", async () => {
    const { state } = fakeServer("Hello")
    state.loseReplies = 1
    const claim = {
      basis: { revision: revisionNumber(0), words: "Hello" },
      typed: true,
    }
    const blocks = [{ id: PARAGRAPH, text: "Hello there" }]
    await settlePage(DOC, blocks, new AbortController().signal, claim)
    const retried = await settlePage(
      DOC,
      blocks,
      new AbortController().signal,
      claim
    )
    expect(retried).toMatchObject({ saved: true, revision: revisionNumber(1) })
    expect(state.batches).toHaveLength(1)
    expect(state.committed).toEqual(["Hello there"])
  })

  it("saves the second of two queued saves on top of the first when the first reply is lost", async () => {
    const { state, words } = fakeServer("Hello")
    state.loseReplies = 1
    const claim = {
      basis: { revision: revisionNumber(0), words: "Hello" },
      typed: true,
    }
    const first = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      new AbortController().signal,
      claim
    )
    const second = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there friend" }],
      new AbortController().signal,
      claim
    )
    const [lost, next] = await Promise.all([first, second])
    expect(lost).toMatchObject({ saved: false })
    expect(savedNote("Hello there", lost)).toBeNull()
    expect(next).not.toHaveProperty("conflict")
    expect(next).toMatchObject({
      saved: true,
      words: "Hello there friend",
      revision: revisionNumber(2),
    })
    expect(state.batches.map((batch) => batch.basedOn)).toEqual([
      revisionNumber(0),
      revisionNumber(1),
    ])
    expect(state.committed).toEqual(["Hello there", "Hello there friend"])
    expect(words()).toBe("Hello there friend")
    expect(state.attempts).toHaveLength(3)
    expect(state.attempts[1]).toEqual(state.attempts[0])
    expect(state.attempts[2]?.idempotencyKey).not.toBe(
      state.attempts[0]?.idempotencyKey
    )
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
    expect(article.textContent?.replaceAll("\u200b", "")).toContain(
      "Hello there"
    )
    expect(screen.getByRole("status").textContent).toMatch(/not saved yet/)
    expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
    expect(state.committed).toEqual([])
    await act(async () => {
      reconnect(state)
    })
    expect(await screen.findByText("Saved")).toBeVisible()
    expect(state.committed).toEqual(["Hello there"])
  })

  it("reports a conflict and leaves the server's words alone when the page moved while the connection was down", async () => {
    const { state, words } = fakeServer("Hello")
    state.offline = true
    const pending = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      new AbortController().signal,
      { basis: { revision: revisionNumber(0), words: "Hello" }, typed: true }
    )
    await turnsUntil(() => state.requests.length > 0)
    await realTurns()
    const line = state.lines[0]
    if (!line) throw new Error("missing line")
    line.text = "Hello from the Coach"
    state.revision = revisionNumber(9)
    reconnect(state)
    const outcome = await pending
    expect(outcome).toMatchObject({ saved: false, conflict: true })
    expect(savedNote("Hello there", outcome)).toBeNull()
    expect(state.batches).toEqual([])
    expect(words()).toBe("Hello from the Coach")
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

describe("how long the page waits for a busy server", () => {
  it.each([
    ["an HTTP date eight seconds away", "Thu, 12 Nov 2026 10:00:08 GMT", 8000],
    ["a day in seconds, capped at a minute", "86400", 60000],
    ["no Retry-After header", null, 5000],
  ])("waits for %s", async (_name, retryAfter, waitMs) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    vi.setSystemTime(Date.parse("2026-11-12T10:00:00Z"))
    const { state } = fakeServer("Hello")
    state.busy.push({ status: 503, retryAfter })
    const pending = settlePage(
      DOC,
      [{ id: PARAGRAPH, text: "Hello there" }],
      new AbortController().signal,
      { basis: { revision: revisionNumber(0), words: "Hello" }, typed: true }
    )
    await turnsUntil(() => state.requests.length === 1)
    await realTurns()
    await vi.advanceTimersByTimeAsync(waitMs - 100)
    expect(state.requests.length).toBe(1)
    expect(state.committed).toEqual([])
    await vi.advanceTimersByTimeAsync(100)
    await turnsUntil(() => state.committed.length > 0)
    expect(await pending).toMatchObject({ saved: true, words: "Hello there" })
    expect(state.committed).toEqual(["Hello there"])
  })
})
