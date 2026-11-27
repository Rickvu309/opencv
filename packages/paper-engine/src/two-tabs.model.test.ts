import fc from "fast-check"
import type { BlockId, Document } from "@workspace/domain/paper-doc"
import { describe, expect, it } from "vitest"

import {
  Server,
  Tab,
  docText,
  runsText,
  tokensOf,
} from "./collab-world.test-support.js"
import { newEngine, paperOf, textBlock } from "./engine.test-support.js"
import { paper } from "./model.test-support.js"

const kinds = [
  "type",
  "type",
  "type",
  "erase",
  "split",
  "dropBlock",
  "push",
  "push",
  "deliver",
  "deliver",
  "loseReply",
  "retry",
  "pull",
  "offline",
  "online",
  "reload",
  "coach",
  "compact",
] as const

const action = fc.record({
  kind: fc.constantFrom(...kinds),
  tab: fc.constantFrom(0, 1),
  seed: fc.nat(500),
  length: fc.nat(20),
})

type Action = typeof action extends fc.Arbitrary<infer A> ? A : never

function world(doc: Document) {
  const trace: string[] = []
  const server = new Server(doc)
  const tabs = [new Tab("a", server, trace), new Tab("b", server, trace)]
  const coach = new Tab("c", server, trace)
  return { trace, server, tabs, coach, all: [...tabs, coach] }
}

type World = ReturnType<typeof world>

function step({ server, tabs, coach, trace }: World, act: Action) {
  const tab = tabs[act.tab]!
  switch (act.kind) {
    case "type":
      return tab.type(act.seed)
    case "erase":
      return tab.erase(act.seed, act.length)
    case "split":
      return tab.split(act.seed)
    case "dropBlock":
      return tab.dropBlock(act.seed)
    case "push":
      return tab.push(server)
    case "deliver":
      return tab.deliver()
    case "loseReply":
      return tab.loseReply()
    case "retry":
      return tab.retry()
    case "pull":
      return tab.pull(server)
    case "offline":
      return tab.setOnline(false)
    case "online":
      return tab.setOnline(true)
    case "reload":
      return tab.reload()
    case "coach":
      coach.pull(server)
      coach.type(act.seed)
      coach.push(server)
      return coach.deliver()
    case "compact":
      server.compact()
      trace.push(`server: compacts its log at version ${server.head}`)
  }
}

function settle(w: World) {
  for (let round = 0; round < 4; round++)
    for (const tab of w.all) tab.settle(w.server)
}

function checkPromises(w: World) {
  const final = w.server.doc()
  const present = tokensOf(docText(final))
  for (const tab of w.all) {
    expect(tab.pending).toEqual([])
    expect(tab.version).toBe(w.server.head)
    expect(tab.doc).toEqual(final)
  }
  const deleted = new Set(w.all.flatMap((tab) => [...tab.deleted]))
  for (const tab of w.all) {
    const lost = tokensOf(runsText(tab.lost))
    for (const token of lost) {
      expect(tab.typed).toContain(token)
      expect(present.has(token)).toBe(false)
    }
    for (const token of tab.typed)
      expect(
        present.has(token) || lost.has(token) || deleted.has(token),
        `${token} vanished\n${w.trace.join("\n")}`
      ).toBe(true)
  }
}

describe("two tabs, offline edits and Coach land in one order", () => {
  it("keeps every typed text in the Paper, deleted on purpose, or in lost, and all tabs converge", () => {
    fc.assert(
      fc.property(paper, fc.array(action, { maxLength: 40 }), (doc, acts) => {
        const w = world(doc)
        for (const act of acts) step(w, act)
        settle(w)
        checkPromises(w)
      }),
      { numRuns: 400 }
    )
  })

  const start = () =>
    world(
      paperOf([
        textBlock("intro", { text: "Analyst" }),
        textBlock("skills", { text: "SQL" }),
      ])
    )

  it("keeps both tabs' text when they type at once", () => {
    const w = start()
    const [a, b] = w.tabs as [Tab, Tab]
    a.type(0)
    b.type(3)
    a.push(w.server)
    b.push(w.server)
    a.deliver()
    b.deliver()
    settle(w)
    expect(docText(w.server.doc())).toBe("[a1]Ana[b1]lystSQL")
    checkPromises(w)
  })

  it("sends text typed offline once it is back online, after a lost acknowledgement and a reload", () => {
    const w = start()
    const [a, b] = w.tabs as [Tab, Tab]
    a.setOnline(false)
    a.type(7)
    b.type(0)
    b.push(w.server)
    b.loseReply()
    b.reload()
    a.setOnline(true)
    a.push(w.server)
    a.deliver()
    a.push(w.server)
    a.deliver()
    settle(w)
    expect(docText(w.server.doc())).toBe("[b1]Analyst[a1]SQL")
    expect(a.lost).toEqual([])
    checkPromises(w)
  })

  it("returns pending text as lost when its block was deleted, and after compaction past its base", () => {
    const w = start()
    const [a, b] = w.tabs as [Tab, Tab]
    a.setOnline(false)
    a.type(9)
    b.dropBlock(1)
    b.push(w.server)
    b.deliver()
    a.setOnline(true)
    a.pull(w.server)
    expect(runsText(a.lost)).toBe("[a1]")
    a.setOnline(false)
    a.type(0)
    w.coach.pull(w.server)
    w.coach.type(2)
    w.coach.push(w.server)
    w.coach.deliver()
    w.server.compact()
    settle(w)
    expect(runsText(a.lost)).toBe("[a1][a2]")
    expect(docText(w.server.doc())).toBe("An[c1]alyst")
    checkPromises(w)
    console.log(w.trace.join("\n"))
  })

  it("never lets Ctrl+Z undo another tab's change", () => {
    const engine = newEngine()
    const doc = paperOf([textBlock("intro", { text: "Analyst" })])
    const at = { block: "intro" as BlockId, offset: 0 }
    const typed = engine.run(
      engine.load(doc, 0, "tab-a"),
      [{ op: "insertText", range: { from: at, to: at }, text: "Data " }],
      { kind: "person", actor: "p1", client: "tab-a" }
    )
    const other = engine.run(
      engine.load(doc, 0, "tab-b"),
      [{ op: "insertText", range: { from: at, to: at }, text: "Lead " }],
      { kind: "person", actor: "p1", client: "tab-b" }
    )
    if ("refusal" in typed || "refusal" in other) throw new Error("refused")
    const received = engine.receive(typed.state, [other.change])
    expect(docText(engine.read(received.state).doc)).toBe("Lead Data Analyst")
    const undone = engine.undo(received.state)!
    expect(docText(engine.read(undone.state).doc)).toBe("Lead Analyst")
    expect(engine.undo(undone.state)).toBeNull()
  })
})
