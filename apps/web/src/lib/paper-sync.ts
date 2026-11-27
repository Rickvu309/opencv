import type { Change, Document, Pos, Run } from "@workspace/domain/paper-doc"
import type { EditorState, PaperEngine } from "@workspace/paper-engine"

import type { PendingStore } from "./paper-pending-store.ts"

export type SaveStatus = "saving" | "saved" | "offline"

export const SAVE_LABEL: Record<SaveStatus, string> = {
  saving: "Saving",
  saved: "Saved",
  offline: "Offline, kept on this device",
}

export type SaveReply =
  | { ok: true; head: number }
  | { stale: true; head: number; since: Change[] }
  | {
      stale: true
      head: number
      compacted: { doc: Document; version: number; head: number }
    }

export type ChangesReply =
  { head: number; changes: Change[] } | { head: number; compacted: true }

export type SaveInput = {
  docId: string
  client: string
  base: number
  changes: Change[]
}

export class RefusedSave extends Error {}

export type SyncTransport = {
  head(docId: string): Promise<{ doc: Document; version: number }>
  save(input: SaveInput): Promise<SaveReply>
  changes(docId: string, since: number): Promise<ChangesReply>
  follow(
    docId: string,
    since: number,
    onChange: (change: Change) => void,
    signal: AbortSignal
  ): Promise<"ended" | "reset">
}

export type TabMessage =
  | { kind: "changes"; writer: string; changes: Change[] }
  | { kind: "caret"; writer: string; pos: Pos | null }

export type TabChannel = {
  post(message: TabMessage): void
  listen(listener: (message: TabMessage) => void): () => void
  close(): void
}

export type SyncPorts = {
  engine: PaperEngine
  transport: SyncTransport
  store: PendingStore
  channel: TabChannel | null
  later(ms: number, run: () => void): () => void
  claimWriter(docId: string, stored: readonly string[]): Promise<WriterClaim>
  online: {
    now(): boolean
    listen(listener: (online: boolean) => void): () => void
  }
}

export type WriterClaim = { writer: string; release(): void }

export type SyncSeat = {
  state(): EditorState
  adopt(state: EditorState): void
  caret(): Pos | null
}

export type PeerCaret = { writer: string; pos: Pos }

export type SyncView = {
  status: SaveStatus
  recovered: readonly string[]
  peers: readonly PeerCaret[]
}

export type PaperSync = {
  writer: string
  doc: Document
  current(): EditorState
  attach(seat: SyncSeat): () => void
  local(): void
  accepting(proposal: string, batch: string): void
  view(): SyncView
  subscribe(listener: () => void): () => void
  dismiss(index: number): void
  settled(): Promise<void>
  close(): void
}

export const PUSH_IDLE_MS = 300
export const POLL_MS = 2_500
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
const POLLS_BEFORE_STREAM = 4

export function runsText(runs: readonly Run[]): string {
  return runs
    .map((run) => (run.type === "text" ? run.text : "\n"))
    .join("")
    .trim()
}

const stepsIn = (changes: readonly Change[]) =>
  changes.reduce((sum, change) => sum + change.steps.length, 0)

export async function openPaperSync(
  docId: string,
  ports: SyncPorts
): Promise<PaperSync> {
  const { engine, transport, store } = ports
  const claim = await ports.claimWriter(docId, await store.writers(docId))
  const writer = claim.writer
  let record: Awaited<ReturnType<PendingStore["load"]>>
  let recovered: string[]
  try {
    record = await store.load(docId, writer)
    recovered = await store.recovered(docId)
  } catch (error) {
    claim.release()
    throw error
  }
  let status: SaveStatus = "saved"
  let state: EditorState
  let version: number
  let head: { doc: Document; version: number } | null = null
  try {
    head = await transport.head(docId)
  } catch (error) {
    if (!record) {
      claim.release()
      throw error
    }
    status = "offline"
  }
  if (record) {
    state = engine.load(record.doc, record.version, writer, record.pending)
    version = record.version
  } else {
    state = engine.load(head!.doc, head!.version, writer)
    version = head!.version
  }
  if (record && record.pending.length) status = "saving"

  let seat: SyncSeat | null = null
  let adopting = false
  let closed = false
  let pushing = false
  let queued: Change[] = []
  let cancelPush: (() => void) | null = null
  let failures = 0
  let persisting: Promise<void> | null = null
  let dirty = false
  let lastPersisted = record?.pending.length ? "pending" : ""
  const peers = new Map<string, Pos>()
  const listeners = new Set<() => void>()
  const stream = new AbortController()
  const idle = new Set<() => void>()
  const accepted = new Map<string, string>()

  const current = () => (seat ? seat.state() : state)
  const notify = () => {
    for (const listener of listeners) listener()
  }
  function setStatus(next: SaveStatus) {
    if (next === status) return
    status = next
    notify()
  }
  function adopt(next: EditorState) {
    state = next
    if (!seat) return
    adopting = true
    try {
      seat.adopt(next)
    } finally {
      adopting = false
    }
  }

  function acceptedBatch(change: Change) {
    const proposal = change.origin.proposal
    return proposal === undefined ? null : (accepted.get(proposal) ?? null)
  }

  function keepLost(lost: readonly Run[]) {
    const text = runsText(lost)
    if (!text) return
    recovered = [...recovered, text]
    void store.keepRecovered(docId, recovered)
    notify()
  }

  function pendingKey(pending: readonly Change[]) {
    return pending.map((change) => change.edit).join(",")
  }

  function persist(): Promise<void> {
    if (persisting) {
      dirty = true
      return persisting
    }
    persisting = (async () => {
      do {
        dirty = false
        const saved = engine.saved(current())
        const key = pendingKey(saved.pending)
        if (key === lastPersisted) continue
        if (saved.pending.length) await store.put({ docId, writer, ...saved })
        else await store.drop(docId, writer)
        lastPersisted = key
      } while (dirty && !closed)
    })().finally(() => {
      persisting = null
    })
    return persisting
  }

  function settle() {
    if (pushing || closed) return
    if (engine.sendable(current()).length) return
    void persist().then(() => {
      if (pushing || closed || engine.sendable(current()).length) return
      if (status !== "offline" || ports.online.now()) setStatus("saved")
      if (status === "saved") for (const done of [...idle]) done()
    })
  }

  function apply(changes: readonly Change[]): "applied" | "gap" {
    const fresh = changes.filter(
      (change) => change.base + change.steps.length > version
    )
    if (!fresh.length) return "applied"
    if (fresh[0]!.base !== version) return "gap"
    const received = engine.receive(current(), fresh, acceptedBatch)
    for (const change of fresh)
      if (change.origin.proposal) accepted.delete(change.origin.proposal)
    version += stepsIn(fresh)
    adopt(received.state)
    keepLost(received.lost)
    return "applied"
  }

  async function rebaseOnto(doc: Document, at: number) {
    const rebased = engine.rebase(current(), doc, at, [])
    version = at
    adopt(rebased.state)
    keepLost(rebased.lost)
    await persist()
  }

  async function resync() {
    const fresh = await transport.head(docId)
    await rebaseOnto(fresh.doc, fresh.version)
  }

  async function pull() {
    const reply = await transport.changes(docId, version)
    if ("compacted" in reply) await resync()
    else if (apply(reply.changes) === "gap") await resync()
  }

  function incoming(changes: readonly Change[]) {
    if (pushing) {
      queued.push(...changes)
      return
    }
    let applied: "applied" | "gap"
    try {
      applied = apply(changes)
    } catch {
      applied = "gap"
    }
    if (applied === "gap") catchUp()
    else {
      void persist()
      settle()
    }
  }

  function catchUp() {
    void pull()
      .catch(() => resync())
      .catch(() => offline())
  }

  function offline() {
    setStatus("offline")
    const wait = RETRY_MS[Math.min(failures, RETRY_MS.length - 1)]!
    failures += 1
    schedule(wait)
  }

  function schedule(ms: number) {
    cancelPush?.()
    cancelPush = ports.later(ms, () => {
      cancelPush = null
      void push()
    })
  }

  async function answer(sent: Change[], base: number, reply: SaveReply) {
    if ("ok" in reply) {
      if (version === base) {
        const received = engine.receive(current(), sent)
        version += stepsIn(sent)
        adopt(received.state)
        ports.channel?.post({ kind: "changes", writer, changes: sent })
      }
      if (reply.head > version) await pull()
      return
    }
    if ("compacted" in reply)
      await rebaseOnto(reply.compacted.doc, reply.compacted.version)
    else if (apply(reply.since) === "gap") await pull()
  }

  async function push(): Promise<void> {
    if (pushing || closed) return
    const sent = engine.sendable(current())
    if (!sent.length) {
      settle()
      return
    }
    pushing = true
    setStatus(
      status === "offline" && !ports.online.now() ? "offline" : "saving"
    )
    const base = version
    let again = false
    try {
      const reply = await transport.save({
        docId,
        client: writer,
        base,
        changes: sent,
      })
      failures = 0
      await answer(sent, base, reply)
      again = true
    } catch (error) {
      if (error instanceof RefusedSave) {
        try {
          await resync()
          again = true
        } catch {
          offline()
        }
      } else offline()
    } finally {
      pushing = false
      const held = queued
      queued = []
      if (held.length) incoming(held)
    }
    await persist()
    if (again && !closed) {
      if (engine.sendable(current()).length) void push()
      else settle()
    }
  }

  function local() {
    if (adopting || closed) return
    ports.channel?.post({ kind: "caret", writer, pos: seat?.caret() ?? null })
    const pending = engine.sendable(current())
    if (pendingKey(pending) === lastPersisted) return
    void persist()
    if (status === "saved") setStatus("saving")
    if (!ports.online.now()) setStatus("offline")
    schedule(PUSH_IDLE_MS)
  }

  async function follow() {
    let polls = 0
    while (!closed) {
      try {
        if (polls > 0) {
          await pull()
          polls -= 1
          await new Promise<void>((resolve) => ports.later(POLL_MS, resolve))
          continue
        }
        const ended = await transport.follow(
          docId,
          version,
          (change) => incoming([change]),
          stream.signal
        )
        if (ended === "reset") await resync()
      } catch {
        if (closed) return
        polls = POLLS_BEFORE_STREAM
        await new Promise<void>((resolve) => ports.later(POLL_MS, resolve))
      }
    }
  }

  const unlisten = ports.channel?.listen((message) => {
    if (message.writer === writer) return
    if (message.kind === "changes") incoming(message.changes)
    else {
      if (message.pos) peers.set(message.writer, message.pos)
      else peers.delete(message.writer)
      notify()
    }
  })
  const unwatch = ports.online.listen((online) => {
    if (!online) {
      if (engine.sendable(current()).length) setStatus("offline")
      return
    }
    failures = 0
    void push()
  })

  let started = false

  return {
    writer,
    doc: engine.read(state).doc,
    current,
    attach(next) {
      seat = next
      state = next.state()
      const detach = () => {
        if (seat !== next) return
        state = next.state()
        seat = null
      }
      if (started) return detach
      started = true
      if (head && record) {
        const caughtUp = head
        void (async () => {
          if (caughtUp.version < version)
            await rebaseOnto(caughtUp.doc, caughtUp.version)
          else await pull()
        })()
          .catch(() => offline())
          .then(() => push())
      } else void push()
      void follow()
      return detach
    },
    local,
    accepting(proposal, batch) {
      accepted.set(proposal, batch)
    },
    view: () => ({
      status,
      recovered,
      peers: [...peers].map(([peer, pos]) => ({ writer: peer, pos })),
    }),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dismiss(index) {
      recovered = recovered.filter((_, at) => at !== index)
      void store.keepRecovered(docId, recovered)
      notify()
    },
    settled() {
      if (status === "saved" && !pushing && !engine.sendable(current()).length)
        return Promise.resolve()
      return new Promise((resolve) => {
        const done = () => {
          idle.delete(done)
          resolve()
        }
        idle.add(done)
      })
    },
    close() {
      if (closed) return
      void persist()
      closed = true
      cancelPush?.()
      stream.abort()
      ports.channel?.post({ kind: "caret", writer, pos: null })
      unlisten?.()
      unwatch()
      ports.channel?.close()
      void (persisting ?? Promise.resolve()).finally(() => claim.release())
    },
  }
}
