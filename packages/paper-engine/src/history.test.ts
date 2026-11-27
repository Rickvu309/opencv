import { expect, it } from "vitest"
import type { DocCommand, Origin, Pos } from "@workspace/domain/paper-doc"
import { Step } from "prosemirror-transform"

import { fromDocument, toDocument } from "./document-json.js"
import { paperSchema } from "./schema.js"

import { createEngine, documentText, seededIds } from "./index.js"
import { coach, paperOf, person, textBlock } from "./engine.test-support.js"

function session() {
  let time = 0
  const engine = createEngine({ ids: seededIds("test"), now: () => time })
  const block = textBlock("line", { text: "Ti" })
  const original = paperOf([block])
  let state = engine.load(original, 4, person.client)
  const at = (offset: number): Pos => ({ block: block.attrs.id, offset })
  const range = (from: number, to = from) => ({ from: at(from), to: at(to) })
  const run = (
    commands: DocCommand[],
    origin: Origin = person,
    input?: Parameters<typeof engine.run>[3]
  ) => {
    const result = engine.run(state, commands, origin, input)
    if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
    state = result.state
    return result.change
  }
  const select = (offset: number) => {
    state = engine.select(state, {
      op: "select",
      selection: { kind: "text", anchor: at(offset), head: at(offset) },
    })
  }
  const undo = () => {
    const result = engine.undo(state)
    if (result) state = result.state
    return result
  }
  return {
    engine,
    original,
    at,
    range,
    run,
    select,
    undo,
    doc: () => engine.read(state).doc,
    text: () => documentText(engine.read(state).doc),
    advance: (duration: number) => {
      time += duration
    },
    type: (offset: number, text: string) =>
      run([{ op: "insertText", range: range(offset), text }]),
  }
}

it("isolates paste on both sides of a typing burst", () => {
  const s = session()
  s.type(2, "a")
  s.run([
    {
      op: "pasteFragment",
      range: s.range(3),
      fragment: [{ type: "text", text: "paste" }],
    },
  ])
  s.type(8, "b")
  s.undo()
  expect(s.text()).toBe("Tiapaste")
  s.undo()
  expect(s.text()).toBe("Tia")
  s.undo()
  expect(s.doc()).toEqual(s.original)
})

it("joins one-shot Latin composition and follows the caret past the trimmed suffix", () => {
  const s = session()
  s.type(2, "ê")
  s.type(3, "ng")
  s.run([{ op: "insertText", range: s.range(2, 3), text: "ế" }], person, {
    kind: "composition",
    id: "tone",
    oneShot: true,
    caret: s.at(5),
  })
  s.type(5, " ")
  expect(s.text()).toBe("Tiếng ")
  s.undo()
  expect(s.doc()).toEqual(s.original)
  expect(s.undo()).toBeNull()
})

it("groups one composition across time and separates it from typing and the next composition", () => {
  const s = session()
  s.type(2, "m")
  s.run([{ op: "insertText", range: s.range(3), text: "日" }], person, {
    kind: "composition",
    id: "a",
    oneShot: true,
  })
  s.advance(2000)
  s.run([{ op: "insertText", range: s.range(3, 4), text: "日本" }], person, {
    kind: "composition",
    id: "a",
  })
  s.run([{ op: "insertText", range: s.range(5), text: "語" }], person, {
    kind: "composition",
    id: "b",
  })
  s.undo()
  expect(s.text()).toBe("Tim日本")
  s.undo()
  expect(s.text()).toBe("Tim")
  s.undo()
  expect(s.doc()).toEqual(s.original)
})

it("splits typing after 500 ms or a selection move", () => {
  const s = session()
  s.type(2, "a")
  s.advance(500)
  s.type(3, "b")
  s.advance(501)
  s.type(4, "c")
  s.select(0)
  s.select(5)
  s.type(5, "d")
  s.undo()
  expect(s.text()).toBe("Tiabc")
  s.undo()
  expect(s.text()).toBe("Tiab")
  s.undo()
  expect(s.doc()).toEqual(s.original)
})

it("skips another tab's steps and undoes a local accepted proposal as one event", () => {
  const s = session()
  s.type(2, "a")
  s.run([{ op: "insertText", range: s.range(0), text: "R" }], {
    ...person,
    client: "remote",
  })
  s.run(
    [
      { op: "insertText", range: s.range(4), text: "b" },
      { op: "insertText", range: s.range(5), text: "c" },
    ],
    { ...coach, client: person.client, proposal: "accepted" }
  )
  s.undo()
  expect(s.text()).toBe("RTia")
  s.undo()
  expect(s.text()).toBe("RTi")
  expect(s.undo()).toBeNull()
})

it("maps a multi-step receipt Undo over later edits and refuses an overwritten target", () => {
  const s = session()
  const accepted = s.run(
    [
      { op: "insertText", range: s.range(2), text: "a" },
      { op: "insertText", range: s.range(0), text: "b" },
    ],
    { ...coach, client: person.client, proposal: "accepted" }
  )
  const later = s.run([{ op: "insertText", range: s.range(2), text: "R" }])
  const result = s.engine.revert(s.doc(), accepted, [later])
  if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
  const restored = result.steps.reduce((doc, json) => {
    const applied = Step.fromJSON(paperSchema, json).apply(doc)
    if (!applied.doc)
      throw new Error(applied.failed ?? "Could not apply receipt Undo")
    return applied.doc
  }, fromDocument(s.doc()))
  expect(documentText(toDocument(restored))).toBe("TRi")
  const overwrite = s.run([
    { op: "insertText", range: s.range(0, 1), text: "X" },
  ])
  expect(s.engine.revert(s.doc(), accepted, [later, overwrite])).toEqual({
    refusal: { code: "unmappable", edit: accepted.edit },
  })
})

it("joins the space and punctuation after a composed word and a bold toggle to its undo step", () => {
  const s = session()
  const composed = { kind: "composition", id: "word" } as const
  s.run([{ op: "insertText", range: s.range(2), text: "ế" }], person, composed)
  s.run([{ op: "insertText", range: s.range(2, 3), text: "ếng" }], person, {
    ...composed,
  })
  s.run([
    { op: "setMark", range: s.range(5), mark: { type: "bold" }, on: true },
  ])
  s.advance(2000)
  s.run([{ op: "insertText", range: s.range(5), text: "," }], person, {
    kind: "typing",
  })
  s.run([{ op: "insertText", range: s.range(6), text: " " }], person, {
    kind: "typing",
  })
  s.run([{ op: "insertText", range: s.range(7), text: "b" }], person, {
    kind: "typing",
  })
  expect(s.text()).toBe("Tiếng, b")
  s.undo()
  expect(s.text()).toBe("Tiếng, ")
  s.undo()
  expect(s.doc()).toEqual(s.original)
})

it("keeps the marks of a deleted word for the next letters typed in its place", () => {
  const s = session()
  s.select(2)
  s.run([
    { op: "setMark", range: s.range(2), mark: { type: "bold" }, on: true },
  ])
  s.type(2, "xy")
  s.run([{ op: "deleteRange", range: s.range(3, 4) }])
  s.run([{ op: "deleteRange", range: s.range(2, 3) }])
  s.type(2, "z")
  const runs = s.doc().content[0]!
  expect(runs.type === "text_block" ? runs.content : []).toEqual([
    { type: "text", text: "Ti" },
    { type: "text", text: "z", marks: [{ type: "bold" }] },
  ])
})

it("keeps a replacement behind the caret in the replaced word's marks after bold is turned off", () => {
  const s = session()
  s.run([
    { op: "setMark", range: s.range(0, 2), mark: { type: "bold" }, on: true },
  ])
  s.run([
    { op: "setMark", range: s.range(2), mark: { type: "bold" }, on: false },
  ])
  s.run([{ op: "insertText", range: s.range(1, 2), text: "ì" }], person, {
    kind: "typing",
    caret: s.at(2),
  })
  const runs = s.doc().content[0]!
  expect(runs.type === "text_block" ? runs.content : []).toEqual([
    { type: "text", text: "Tì", marks: [{ type: "bold" }] },
  ])
})
