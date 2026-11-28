import { expect, it } from "vitest"
import type { Change, DocCommand, Pos } from "@workspace/domain/paper-doc"

import { createEngine, documentText, seededIds } from "./index.js"
import { coach, paperOf, person, textBlock } from "./engine.test-support.js"

function world() {
  let time = 0
  const engine = createEngine({ ids: seededIds("tab"), now: () => time })
  const server = createEngine({ ids: seededIds("srv"), now: () => time })
  const block = textBlock("line", { text: "Built dashboards" })
  const original = paperOf([block])
  let tab = engine.load(original, 3, person.client)
  let head = original
  let version = 3
  const at = (offset: number): Pos => ({ block: block.attrs.id, offset })
  const accepted = new Map<string, string>()
  const own = (change: Change) =>
    change.origin.proposal === undefined
      ? null
      : (accepted.get(change.origin.proposal) ?? null)

  const land = (change: Change) => {
    const result = server.apply(head, change.steps)
    if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
    head = result.doc
    version += change.steps.length
  }
  const fromServer = (commands: DocCommand[], proposal?: string) => {
    const origin = proposal ? { ...coach, proposal } : coach
    const result = server.run(
      server.load(head, version, "srv"),
      commands,
      origin
    )
    if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
    const change = result.change
    land(change)
    tab = engine.receive(tab, [change], own).state
    return change
  }
  const push = () => {
    for (const change of engine.sendable(tab)) {
      land(change)
      tab = engine.receive(tab, [change], own).state
    }
  }
  return {
    accept: (proposal: string, batch: string, text: string) => {
      accepted.set(proposal, batch)
      return fromServer(
        [{ op: "insertText", range: { from: at(0), to: at(0) }, text }],
        proposal
      )
    },
    remote: (text: string, proposal?: string) =>
      fromServer(
        [{ op: "insertText", range: { from: at(0), to: at(0) }, text }],
        proposal
      ),
    type: (offset: number, text: string) => {
      time += 1000
      const result = engine.run(
        tab,
        [
          {
            op: "insertText",
            range: { from: at(offset), to: at(offset) },
            text,
          },
        ],
        person,
        { kind: "typing" }
      )
      if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
      tab = result.state
    },
    undo: () => {
      const result = engine.undo(tab)
      if (!result) return null
      tab = result.state
      return result.change
    },
    redo: () => {
      const result = engine.redo(tab)
      if (!result) return null
      tab = result.state
      return result.change
    },
    push,
    history: () => engine.history(tab),
    text: () => documentText(engine.read(tab).doc),
    headText: () => documentText(head),
  }
}

it("takes back an accepted Coach change in one undo saved as the person", () => {
  const w = world()
  w.accept("p1", "b1", "Reviewed. ")
  expect(w.text()).toBe("Reviewed. Built dashboards")
  expect(w.history().undo).toBe(true)
  const change = w.undo()
  expect(change?.origin.kind).toBe("person")
  expect(change?.origin.proposal).toBeUndefined()
  expect(w.text()).toBe("Built dashboards")
  w.push()
  expect(w.headText()).toBe("Built dashboards")
  expect(w.history().undo).toBe(false)
})

it("undoes typing after the Accept first, then the Accept", () => {
  const w = world()
  w.accept("p1", "b1", "Reviewed. ")
  w.type(26, " daily")
  expect(w.text()).toBe("Reviewed. Built dashboards daily")
  w.undo()
  expect(w.text()).toBe("Reviewed. Built dashboards")
  w.undo()
  expect(w.text()).toBe("Built dashboards")
})

it("redo puts the accepted change back as the person", () => {
  const w = world()
  w.accept("p1", "b1", "Reviewed. ")
  w.undo()
  const change = w.redo()
  expect(change?.origin.kind).toBe("person")
  expect(w.text()).toBe("Reviewed. Built dashboards")
})

it("takes back an Accept all of two proposals in one undo", () => {
  const w = world()
  w.accept("p1", "b1", "One. ")
  w.remote("Elsewhere. ")
  w.accept("p2", "b1", "Two. ")
  expect(w.text()).toBe("Two. Elsewhere. One. Built dashboards")
  w.undo()
  expect(w.text()).toBe("Elsewhere. Built dashboards")
  expect(w.history().undo).toBe(false)
})

it("keeps separate Accepts as separate undo steps", () => {
  const w = world()
  w.accept("p1", "b1", "One. ")
  w.accept("p2", "b2", "Two. ")
  w.undo()
  expect(w.text()).toBe("One. Built dashboards")
  w.undo()
  expect(w.text()).toBe("Built dashboards")
})

it("never puts a change this tab did not accept in its undo history", () => {
  const w = world()
  w.remote("Elsewhere. ")
  w.remote("Other tab. ", "p9")
  expect(w.history().undo).toBe(false)
  w.accept("p1", "b1", "Coach. ")
  w.undo()
  expect(w.text()).toBe("Other tab. Elsewhere. Built dashboards")
  expect(w.history().undo).toBe(false)
})
