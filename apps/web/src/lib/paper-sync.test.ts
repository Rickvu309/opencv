import {
  paperEngineBlank,
  type Change,
  type Document,
} from "@workspace/domain/paper-doc"
import {
  createEngine,
  documentText,
  fixedClock,
  seededIds,
  type EditorState,
} from "@workspace/paper-engine"
import { describe, expect, it } from "vitest"

import { memoryPendingStore, type PendingStore } from "./paper-pending-store.ts"
import {
  openPaperSync,
  POLL_MS,
  PUSH_IDLE_MS,
  RefusedSave,
  type ChangesReply,
  type PaperSync,
  type SaveInput,
  type SaveReply,
  type SyncTransport,
  type TabChannel,
  type TabMessage,
} from "./paper-sync.ts"

const DOC = "00000000-0000-4000-8000-000000000001"

type Follow = SyncTransport["follow"]

function scriptedServer(start: Document) {
  const engine = createEngine({ ids: seededIds("server"), now: fixedClock() })
  let snapshot = start
  let snapshotVersion = 0
  let log: Change[] = []
  let head = 0
  const followers = new Set<(change: Change) => void>()

  function current() {
    let doc = snapshot
    for (const change of log) {
      const applied = engine.apply(doc, change.steps)
      if ("refusal" in applied) throw new Error("log does not apply")
      doc = applied.doc
    }
    return doc
  }

  function append(change: Change) {
    if ("refusal" in engine.apply(current(), change.steps))
      throw new RefusedSave("steps do not apply")
    log.push(change)
    head += change.steps.length
    for (const follower of [...followers]) follower(structuredClone(change))
  }

  function since(version: number): ChangesReply {
    if (version < snapshotVersion) return { head, compacted: true }
    return { head, changes: log.filter((change) => change.base >= version) }
  }

  function save(input: SaveInput): SaveReply {
    if (input.base !== head) {
      const found = since(input.base)
      if ("compacted" in found)
        return {
          stale: true,
          head,
          compacted: { doc: current(), version: head, head },
        }
      const known = new Set(found.changes.map((change) => change.edit))
      return input.changes.every((change) => known.has(change.edit))
        ? { ok: true, head }
        : { stale: true, head, since: structuredClone(found.changes) }
    }
    for (const change of input.changes) append(change)
    return { ok: true, head }
  }

  const follow: Follow = (_docId, from, onChange, signal) =>
    new Promise((resolve) => {
      const found = since(from)
      if ("compacted" in found) return resolve("reset")
      for (const change of found.changes) onChange(structuredClone(change))
      followers.add(onChange)
      signal.addEventListener("abort", () => {
        followers.delete(onChange)
        resolve("ended")
      })
    })

  const silent: Follow = (_docId, _from, _onChange, signal) =>
    new Promise((resolve) =>
      signal.addEventListener("abort", () => resolve("ended"))
    )

  function transport(): SyncTransport {
    return {
      head: async () => ({ doc: current(), version: head }),
      save: async (input) => save(structuredClone(input)),
      changes: async (_docId, from) => structuredClone(since(from)),
      follow,
    }
  }

  function link() {
    const base = transport()
    let gate: Promise<void> | null = null
    let loseReply = false
    const state = {
      up: true,
      hold() {
        let release = () => undefined as void
        gate = new Promise<void>((done) => {
          release = done
        })
        return { release: () => release() }
      },
      loseNextReply() {
        loseReply = true
      },
      transport: {} as SyncTransport,
    }
    const down = () => new TypeError("Failed to fetch")
    state.transport = {
      head: (docId) => (state.up ? base.head(docId) : Promise.reject(down())),
      changes: (docId, from) =>
        state.up ? base.changes(docId, from) : Promise.reject(down()),
      async save(input) {
        if (gate) {
          const waiting = gate
          gate = null
          await waiting
        }
        if (!state.up) throw down()
        const reply = await base.save(input)
        if (loseReply) {
          loseReply = false
          throw down()
        }
        return reply
      },
      follow: (docId, from, onChange, signal) => {
        if (!state.up) return Promise.reject(down())
        const ended = new AbortController()
        signal.addEventListener("abort", () => ended.abort())
        const stream = base.follow(
          docId,
          from,
          (change) => {
            if (state.up) onChange(change)
            else ended.abort()
          },
          ended.signal
        )
        return stream
      },
    }
    return state
  }

  return {
    transport,
    link,
    silent,
    text: () => documentText(current()),
    saved: () => [...log],
    compact() {
      snapshot = current()
      snapshotVersion = head
      log = []
    },
    typeAsOther(text: string, proposal?: string) {
      const doc = current()
      const pos = { block: doc.content[0]!.attrs.id, offset: 0 }
      const result = engine.run(
        engine.load(doc, head, "other"),
        [{ op: "insertText", range: { from: pos, to: pos }, text }],
        proposal
          ? { kind: "coach", actor: "coach", client: "other", proposal }
          : { kind: "person", actor: "ada", client: "other" }
      )
      if ("refusal" in result) throw new Error("other tab refused")
      append(result.change)
      return result.change.edit
    },
  }
}

type ScriptedServer = ReturnType<typeof scriptedServer>

async function drain() {
  for (let i = 0; i < 200; i += 1) await Promise.resolve()
}

function manualClock() {
  let now = 0
  let timers: { at: number; run: () => void }[] = []
  return {
    later(ms: number, run: () => void) {
      const timer = { at: now + ms, run }
      timers.push(timer)
      return () => {
        timers = timers.filter((other) => other !== timer)
      }
    },
    async tick(ms: number) {
      now += ms
      const due = timers.filter((timer) => timer.at <= now)
      timers = timers.filter((timer) => timer.at > now)
      for (const timer of due) timer.run()
      await drain()
    },
  }
}

function channelHub() {
  const tabs = new Set<(message: TabMessage) => void>()
  return (): TabChannel => {
    const mine = new Set<(message: TabMessage) => void>()
    return {
      post(message) {
        const copy = structuredClone(message)
        queueMicrotask(() => {
          for (const listener of tabs) if (!mine.has(listener)) listener(copy)
        })
      },
      listen(listener) {
        tabs.add(listener)
        mine.add(listener)
        return () => {
          tabs.delete(listener)
          mine.delete(listener)
        }
      },
      close() {
        for (const listener of mine) tabs.delete(listener)
      },
    }
  }
}

type Tab = {
  sync: PaperSync
  type(text: string): void
  undo(): boolean
  text(): string
}

async function openTab(
  name: string,
  options: {
    server: ScriptedServer
    transport?: SyncTransport
    store?: PendingStore
    clock?: ReturnType<typeof manualClock>
    channel?: () => TabChannel
    online?: { up: boolean }
  }
): Promise<Tab> {
  const engine = createEngine({ ids: seededIds(name), now: fixedClock() })
  const online = options.online ?? { up: true }
  const clock = options.clock ?? manualClock()
  const sync = await openPaperSync(DOC, {
    engine,
    transport: options.transport ?? options.server.transport(),
    store: options.store ?? memoryPendingStore(),
    channel: options.channel?.() ?? null,
    later: clock.later,
    claimWriter: async (_docId, stored) => ({
      writer: stored[0] ?? name,
      release: () => undefined,
    }),
    online: { now: () => online.up, listen: () => () => undefined },
  })
  let state: EditorState = sync.current()
  sync.attach({
    state: () => state,
    adopt: (next) => {
      state = next
    },
    caret: () => ({
      block: engine.read(state).doc.content[0]!.attrs.id,
      offset: 0,
    }),
  })
  await drain()
  return {
    sync,
    type(text) {
      const doc = engine.read(state).doc
      const block = doc.content[0]!.attrs.id
      const offset = documentText({ ...doc, content: [doc.content[0]!] }).length
      const pos = { block, offset }
      const result = engine.run(
        state,
        [{ op: "insertText", range: { from: pos, to: pos }, text }],
        { kind: "person", actor: "ada", client: sync.writer }
      )
      if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
      state = result.state
      sync.local()
    },
    undo() {
      const result = engine.undo(state)
      if (!result) return false
      state = result.state
      sync.local()
      return true
    },
    text: () => documentText(engine.read(state).doc),
  }
}

describe("paper sync keeps unsent edits until the server has them", () => {
  it("keeps typing made offline on the device and saves it on reconnect", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const store = memoryPendingStore()
    const clock = manualClock()
    const link = server.link()
    const online = { up: true }
    const tab = await openTab("tab-a", {
      server,
      transport: link.transport,
      store,
      clock,
      online,
    })
    expect(tab.sync.view().status).toBe("saved")
    link.up = false
    online.up = false
    tab.type("Offline words")
    await drain()
    expect(tab.sync.view().status).toBe("offline")
    expect(store.records()[0]!.pending.length).toBe(1)
    await clock.tick(PUSH_IDLE_MS)
    expect(server.text()).toBe("")
    link.up = true
    online.up = true
    await clock.tick(30_000)
    expect(server.text()).toBe("Offline words")
    expect(tab.sync.view().status).toBe("saved")
    expect(store.records()).toEqual([])
  })

  it("says Saved only after the server acknowledged and the device copy is cleared", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const store = memoryPendingStore()
    const clock = manualClock()
    const link = server.link()
    const tab = await openTab("tab-a", {
      server,
      transport: link.transport,
      store,
      clock,
    })
    const held = link.hold()
    tab.type("Hello")
    await clock.tick(PUSH_IDLE_MS)
    expect(tab.sync.view().status).toBe("saving")
    expect(store.records()).toHaveLength(1)
    held.release()
    await drain()
    expect(server.text()).toBe("Hello")
    expect(tab.sync.view().status).toBe("saved")
    expect(store.records()).toEqual([])
  })

  it("brings back edits after a reload in the middle of a write", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const store = memoryPendingStore()
    const clock = manualClock()
    const link = server.link()
    const first = await openTab("tab-a", {
      server,
      transport: { ...link.transport, follow: server.silent },
      store,
      clock,
    })
    first.type("Before reload")
    await drain()
    link.loseNextReply()
    await clock.tick(PUSH_IDLE_MS)
    first.sync.close()
    await drain()
    expect(store.records()).toHaveLength(1)
    server.typeAsOther("Elsewhere. ")
    const reloaded = await openTab("tab-b", { server, store })
    await reloaded.sync.settled()
    expect(server.text()).toBe("Elsewhere. Before reload")
    expect(reloaded.text()).toBe("Elsewhere. Before reload")
    expect(store.records()).toEqual([])
  })

  it("resends after a lost acknowledgement and the server keeps one copy", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const clock = manualClock()
    const link = server.link()
    const tab = await openTab("tab-a", {
      server,
      transport: { ...link.transport, follow: server.silent },
      clock,
    })
    tab.type("Once")
    link.loseNextReply()
    await clock.tick(PUSH_IDLE_MS)
    expect(server.text()).toBe("Once")
    expect(tab.sync.view().status).toBe("offline")
    await clock.tick(1_000)
    expect(server.text()).toBe("Once")
    expect(server.saved()).toHaveLength(1)
    expect(tab.text()).toBe("Once")
    expect(tab.sync.view().status).toBe("saved")
  })

  it("keeps two tabs in step through the tab channel and shows the other caret", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const channel = channelHub()
    const clock = manualClock()
    const quiet = { ...server.transport(), follow: server.silent }
    const a = await openTab("tab-a", { server, clock, channel })
    const b = await openTab("tab-b", {
      server,
      clock,
      channel,
      transport: quiet,
    })
    a.type("Tab one ")
    await clock.tick(PUSH_IDLE_MS)
    expect(b.text()).toBe("Tab one ")
    b.type("tab two")
    await clock.tick(PUSH_IDLE_MS)
    await a.sync.settled()
    expect(a.text()).toBe("Tab one tab two")
    expect(server.text()).toBe("Tab one tab two")
    expect(b.sync.view().peers.map((peer) => peer.writer)).toEqual(["tab-a"])
  })

  it("falls back to polling when the change stream fails", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const clock = manualClock()
    const broken = {
      ...server.transport(),
      follow: () => Promise.reject(new Error("stream refused")),
    }
    const tab = await openTab("tab-a", { server, clock, transport: broken })
    server.typeAsOther("Polled")
    await clock.tick(POLL_MS)
    await clock.tick(POLL_MS)
    expect(tab.text()).toBe("Polled")
  })

  it("puts text whose place cannot be proved after compaction into the recovery panel", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const store = memoryPendingStore()
    const clock = manualClock()
    const link = server.link()
    const online = { up: true }
    const tab = await openTab("tab-a", {
      server,
      transport: link.transport,
      store,
      clock,
      online,
    })
    link.up = false
    online.up = false
    tab.type("Written on the train")
    await clock.tick(PUSH_IDLE_MS)
    server.typeAsOther("Newer text. ")
    server.compact()
    link.up = true
    online.up = true
    await clock.tick(30_000)
    expect(server.text()).toBe("Newer text. ")
    expect(tab.text()).toBe("Newer text. ")
    expect(tab.sync.view().recovered).toEqual(["Written on the train"])
    expect(await store.recovered(DOC)).toEqual(["Written on the train"])
    tab.sync.dismiss(0)
    expect(tab.sync.view().recovered).toEqual([])
    expect(tab.sync.view().status).toBe("saved")
  })

  it("never sends a change twice in one push", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const clock = manualClock()
    const sent: Change[][] = []
    const base = server.transport()
    const tab = await openTab("tab-a", {
      server,
      clock,
      transport: {
        ...base,
        save: (input) => {
          sent.push(input.changes)
          return base.save(input)
        },
      },
    })
    tab.type("A")
    tab.type("B")
    await clock.tick(PUSH_IDLE_MS)
    tab.type("C")
    await clock.tick(PUSH_IDLE_MS)
    const edits = sent.flat().map((change) => change.edit)
    expect(new Set(edits).size).toBe(edits.length)
    expect(server.text()).toBe("ABC")
  })

  it("lets one undo take back a Coach change this tab accepted and saves the reversal", async () => {
    const server = scriptedServer(paperEngineBlank.blankCv())
    const clock = manualClock()
    const tab = await openTab("tab-a", { server, clock })
    tab.type("Built dashboards")
    await clock.tick(PUSH_IDLE_MS)
    server.typeAsOther("Elsewhere. ", "proposal-elsewhere")
    const landed = tab.sync.accepting("batch-1")
    const edit = server.typeAsOther("Reviewed. ", "proposal-1")
    await drain()
    expect(tab.text()).toBe("Elsewhere. Built dashboards")
    landed(edit)
    await drain()
    expect(tab.text()).toBe("Reviewed. Elsewhere. Built dashboards")
    expect(tab.undo()).toBe(true)
    expect(tab.text()).toBe("Elsewhere. Built dashboards")
    await clock.tick(PUSH_IDLE_MS)
    expect(server.text()).toBe("Elsewhere. Built dashboards")
    expect(server.saved().at(-1)!.origin.kind).toBe("person")
  })
})
