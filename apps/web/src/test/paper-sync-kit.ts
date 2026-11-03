import { QueryClient } from "@tanstack/react-query"
import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"
import { knownAfter, seedYDoc, writeAsEditor } from "@workspace/paper-crdt"
import { afterEach, beforeEach, expect, vi } from "vitest"
import * as Y from "yjs"

import {
  fromBase64,
  openPaperSync,
  toBase64,
  type PaperSync,
} from "@/lib/paper-sync.ts"
import { memoryStore } from "@/lib/paper-sync-store.ts"

export const server = {
  run: null as null | ((input: unknown, options: unknown) => Promise<unknown>),
}

export const DOC = "00000000-0000-4000-8000-000000000001" as never

export const letter = (...blocks: [string, string][]): PaperDocument =>
  paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks: blocks.map(([id, text]) => ({
      id,
      type: "paragraph",
      content: [{ text }],
    })),
    clashes: [],
  })

export function fakeServer(initial: PaperDocument) {
  let doc = new Y.Doc()
  Y.applyUpdate(doc, seedYDoc(initial))
  const state = {
    doc,
    epoch: 1,
    revision: 1,
    online: true,
    active: 0,
    peak: 0,
    gate: null as Promise<void> | null,
    calls: [] as {
      update: number
      options: unknown
      basedOn: number | undefined
    }[],
  }
  server.run = async (input, options) => {
    const body = input as {
      epoch: number
      update: string
      stateVector: string
      basedOn?: number
    }
    state.active += 1
    state.peak = Math.max(state.peak, state.active)
    try {
      await Promise.resolve()
      if (state.gate) await state.gate
      if (!state.online) throw new Error("offline")
      const update = fromBase64(body.update)
      state.calls.push({
        update: update.length,
        options,
        basedOn: body.basedOn,
      })
      if (body.epoch !== 0 && body.epoch !== state.epoch) {
        return reply(true, new Uint8Array())
      }
      if (body.basedOn !== undefined && body.basedOn !== state.revision) {
        return reply(false, fromBase64(body.stateVector), true)
      }
      if (update.length > 2) {
        Y.applyUpdate(state.doc, update)
        state.revision += 1
      }
      return reply(
        false,
        knownAfter(fromBase64(body.stateVector), update) ?? new Uint8Array()
      )
    } finally {
      state.active -= 1
    }
  }
  function reply(reset: boolean, since: Uint8Array, stale = false) {
    const update =
      since.length === 0
        ? Y.encodeStateAsUpdate(state.doc)
        : Y.encodeStateAsUpdate(state.doc, since)
    return {
      epoch: state.epoch,
      revision: state.revision,
      reset,
      stale,
      update: toBase64(update),
      stateVector: toBase64(Y.encodeStateVector(state.doc)),
    }
  }
  return {
    state,
    reseed(next: PaperDocument) {
      doc = new Y.Doc()
      Y.applyUpdate(doc, seedYDoc(next))
      state.doc = doc
      state.epoch += 1
      state.revision += 1
    },
  }
}

export function type(sync: PaperSync, id: string, text: string) {
  const client = sync.client()!
  const current = client.document()!
  const next = {
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === id && "content" in block
        ? { ...block, content: [{ text }] }
        : block
    ),
  } as PaperDocument
  writeAsEditor(client.ydoc, next, "person")
}

export const textOf = (sync: PaperSync, id: string) => {
  const block = sync
    .client()!
    .document()!
    .blocks.find((b) => b.id === id)
  return block && "content" in block
    ? block.content.map((run) => run.text).join("")
    : null
}

let opened: PaperSync[] = []

export async function open(options: Parameters<typeof openPaperSync>[2] = {}) {
  const sync = openPaperSync(DOC, new QueryClient(), {
    store: memoryStore(),
    tabId: "tab-a",
    run: ((
      _client: unknown,
      _name: unknown,
      input: unknown,
      options: unknown
    ) => server.run!(input, options)) as never,
    ...options,
  })
  opened.push(sync)
  await vi.waitFor(() => expect(sync.client()).not.toBeNull())
  await vi.advanceTimersByTimeAsync(0)
  return sync
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
})

afterEach(() => {
  for (const sync of opened) sync.destroy()
  opened = []
  vi.useRealTimers()
})
