import "fake-indexeddb/auto"

import { expect, vi } from "vitest"
import { cleanup } from "@testing-library/react"

import { closeWritingDb } from "../canvas-save.ts"

export const DOC = "11111111-1111-7111-8111-111111111111"
export const PARAGRAPH = "33333333-3333-4333-8333-333333333333"
const INCARNATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const HASH = "ab".repeat(32)

export function revisionNumber(n: number) {
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

type Busy = { status: number; retryAfter: string | null }

export function fakeServer(text: string) {
  const state = {
    revision: revisionNumber(0),
    lines: [{ handle: PARAGRAPH, text }] as Line[],
    batches: [] as Batch[],
    committed: [] as string[],
    requests: [] as string[],
    attempts: [] as { input: { batch: Batch }; idempotencyKey: string }[],
    offline: false,
    loseReplies: 0,
    failSends: 0,
    busy: [] as Busy[],
  }
  const receipts = new Map<string, { input: string; data: unknown }>()
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
            headers:
              busy.retryAfter === null
                ? {}
                : { "Retry-After": busy.retryAfter },
          }
        )
      )
    }
    if (url.includes("/api/commands/paper.canvas")) {
      const body = JSON.parse(String(init?.body)) as {
        input: { batch: Batch }
        idempotencyKey: string
      }
      state.attempts.push(body)
      if (state.failSends > 0) {
        state.failSends -= 1
        return Promise.reject(new TypeError("Failed to fetch"))
      }
      const prior = receipts.get(body.idempotencyKey)
      if (prior) {
        expect(JSON.stringify(body.input)).toBe(prior.input)
        return Promise.resolve(Response.json({ ok: true, data: prior.data }))
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
      const data = {
        generation: "package",
        docId: DOC,
        revision: state.revision,
        name: "Page.docx",
        kind: "letter",
        packageHash: HASH,
        byteSize: 128,
        incarnation: INCARNATION,
        restore: null,
      }
      receipts.set(body.idempotencyKey, {
        input: JSON.stringify(body.input),
        data,
      })
      if (state.loseReplies > 0) {
        state.loseReplies -= 1
        return Promise.reject(new TypeError("Failed to fetch"))
      }
      return Promise.resolve(Response.json({ ok: true, data }))
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

const realTimeout = globalThis.setTimeout

export function realTurn() {
  return new Promise<void>((resolve) => realTimeout(resolve, 0))
}

export async function realTurns(count = 50) {
  for (let turn = 0; turn < count; turn += 1) await realTurn()
}

export async function turnsUntil(check: () => boolean) {
  for (let turn = 0; turn < 500; turn += 1) {
    if (check()) return
    await realTurn()
  }
  throw new Error("the page never reached the expected step")
}

export function reconnect(state: { offline: boolean }) {
  state.offline = false
  window.dispatchEvent(new Event("online"))
}

export async function cleanNetworkPage() {
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
}
