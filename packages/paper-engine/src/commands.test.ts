import { describe, expect, it } from "vitest"

import { documentText, selectionRange, type PaperEngine } from "./index.js"
import {
  coach,
  newEngine,
  paperOf,
  person,
  textBlock,
} from "./engine.test-support.js"

const at = (block: string, offset: number) => ({ block, offset }) as never

function stateOf(...blocks: Parameters<typeof textBlock>[]) {
  const engine = newEngine()
  const state = engine.load(
    paperOf(blocks.map((b) => textBlock(...b))),
    0,
    "tab-1"
  )
  return { engine, state }
}

function ok(result: ReturnType<PaperEngine["run"]>) {
  if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
  return result
}

describe("lists", () => {
  it("Enter in a bullet makes the next bullet at the same level and Tab nests it", () => {
    let { engine, state } = stateOf([
      "a",
      { text: "one", list: "bullet", level: 1 },
    ])
    state = ok(
      engine.run(state, [{ op: "splitBlock", at: at("a", 3) }], person)
    ).state
    const second = engine.read(state).doc.content[1]!
    expect(second.attrs).toMatchObject({
      list: "bullet",
      level: 1,
      id: "new-1",
    })
    state = ok(
      engine.run(
        state,
        [{ op: "shiftLevel", blocks: [second.attrs.id], by: 1 }],
        person
      )
    ).state
    expect(engine.read(state).doc.content[1]!.attrs).toMatchObject({ level: 2 })
  })

  it("Enter on an empty bullet turns it into a paragraph and adds no block", () => {
    let { engine, state } = stateOf(
      ["a", { text: "one", list: "bullet" }],
      ["b", { list: "bullet", level: 2 }]
    )
    state = ok(
      engine.run(state, [{ op: "splitBlock", at: at("b", 0) }], person)
    ).state
    const doc = engine.read(state).doc
    expect(doc.content).toHaveLength(2)
    expect(doc.content[1]!.attrs).toMatchObject({ list: null, level: 0 })
  })

  it("Enter at the start of a line keeps that line's id and adds an empty line above", () => {
    let { engine, state } = stateOf(["a", { text: "one" }])
    state = ok(
      engine.run(state, [{ op: "splitBlock", at: at("a", 0) }], person)
    ).state
    const { doc, selection } = engine.read(state)
    expect(doc.content.map((block) => block.attrs.id)).toEqual(["new-1", "a"])
    expect(selection).toEqual({
      kind: "text",
      anchor: at("a", 0),
      head: at("a", 0),
    })
  })
})

describe("marks", () => {
  it("bold over three paragraphs bolds every character", () => {
    let { engine, state } = stateOf(
      ["a", { text: "alpha" }],
      ["b", { text: "beta" }],
      ["c", { text: "gamma" }]
    )
    state = ok(
      engine.run(
        state,
        [
          {
            op: "setMark",
            range: { from: at("a", 0), to: at("c", 5) },
            mark: { type: "bold" },
            on: true,
          },
        ],
        person
      )
    ).state
    for (const block of engine.read(state).doc.content) {
      if (block.type !== "text_block") throw new Error("text block expected")
      expect(block.content).toEqual([
        expect.objectContaining({ marks: [{ type: "bold" }] }),
      ])
    }
  })

  it("bold over a hard break marks the text and leaves the break bare", () => {
    let { engine, state } = stateOf([
      "a",
      {
        runs: [
          { type: "text", text: "ab" },
          { type: "hard_break" },
          { type: "text", text: "cd" },
        ],
      },
    ])
    state = ok(
      engine.run(
        state,
        [
          {
            op: "setMark",
            range: { from: at("a", 0), to: at("a", 5) },
            mark: { type: "bold" },
            on: true,
          },
        ],
        person
      )
    ).state
    expect(engine.read(state).doc.content[0]).toMatchObject({
      content: [
        { text: "ab", marks: [{ type: "bold" }] },
        { type: "hard_break" },
        { text: "cd", marks: [{ type: "bold" }] },
      ],
    })
    expect(engine.read(state).doc.content[0]).not.toMatchObject({
      content: [{}, { marks: expect.anything() }, {}],
    })
  })

  it("on false removes bold and clearFormatting keeps links", () => {
    let { engine, state } = stateOf([
      "a",
      {
        runs: [
          {
            type: "text",
            text: "site",
            marks: [
              { type: "bold" },
              { type: "link", attrs: { href: "https://a.example" as never } },
            ],
          },
        ],
      },
    ])
    state = ok(
      engine.run(
        state,
        [
          {
            op: "clearFormatting",
            range: { from: at("a", 0), to: at("a", 4) },
          },
        ],
        person
      )
    ).state
    const block = engine.read(state).doc.content[0]!
    expect(block).toMatchObject({ content: [{ marks: [{ type: "link" }] }] })
  })

  it("setLink with text inserts linked text and refuses unsafe hrefs", () => {
    const { engine, state } = stateOf(["a", { text: "see " }])
    const linked = ok(
      engine.run(
        state,
        [
          {
            op: "setLink",
            range: { from: at("a", 4), to: at("a", 4) },
            href: "https://x.example" as never,
            text: "here",
          },
        ],
        person
      )
    )
    expect(documentText(engine.read(linked.state).doc)).toBe("see here")
    const refused = engine.run(
      state,
      [
        {
          op: "setLink",
          range: { from: at("a", 0), to: at("a", 3) },
          href: "javascript:alert(1)" as never,
        },
      ],
      person
    )
    expect(refused).toMatchObject({ refusal: { code: "schema" } })
  })
})

describe("refusals and changes", () => {
  it("expect mismatch refuses and changes nothing", () => {
    const { engine, state } = stateOf(["a", { text: "hello" }])
    const result = engine.run(
      state,
      [
        {
          op: "deleteRange",
          range: { from: at("a", 0), to: at("a", 5) },
          expect: "help",
        },
      ],
      coach
    )
    expect(result).toEqual({
      refusal: { code: "expect-mismatch", at: at("a", 0), found: "hello" },
    })
  })

  it("an unknown block is no-such-position and an unbuilt op is refused", () => {
    const { engine, state } = stateOf(["a", { text: "hi" }])
    expect(
      engine.run(state, [{ op: "splitBlock", at: at("zz", 0) }], person)
    ).toMatchObject({
      refusal: { code: "no-such-position" },
    })
    expect(
      engine.run(state, [{ op: "setTemplate", template: "modern" }], person)
    ).toMatchObject({
      refusal: { code: "schema" },
    })
  })

  it("a change carries steps, inverse, base, origin and commands", () => {
    const { engine, state } = stateOf(["a", { text: "hi" }])
    const command = {
      op: "insertText",
      range: { from: at("a", 2), to: at("a", 2) },
      text: "!",
    } as const
    const { change } = ok(engine.run(state, [command], coach))
    expect(change).toMatchObject({
      origin: coach,
      base: 0,
      commands: [command],
    })
    expect(change.steps.map((step) => step.stepType)).toEqual(["replace"])
    expect(change.inverse).toHaveLength(1)
  })

  it("selectionRange of a block selection covers the block text", () => {
    const { engine, state } = stateOf(
      ["a", { text: "one" }],
      ["b", { text: "two" }]
    )
    const selected = engine.select(state, {
      op: "select",
      selection: { kind: "block", block: "b" as never },
    })
    const { doc, selection } = engine.read(selected)
    expect(selectionRange(doc, selection)).toEqual({
      from: at("b", 0),
      to: at("b", 3),
    })
  })
})
