import fc from "fast-check"
import { describe, expect, it } from "vitest"
import {
  documentSchema,
  markSchema,
  type DocCommand,
  type Document,
} from "@workspace/domain/paper-doc"

import { documentText, selectionRange, type EditorState } from "./index.js"
import { newEngine, person } from "./engine.test-support.js"
import {
  blockStart,
  globalOf,
  paper,
  posAt,
  typed,
} from "./model.test-support.js"

const safeHref = (() => {
  const mark = markSchema.parse({
    type: "link",
    attrs: { href: "https://a.example" },
  })
  if (mark.type !== "link") throw new Error("link mark expected")
  return mark.attrs.href
})()

const nat = fc.nat({ max: 400 })
const expectation = fc.constantFrom("none", "right", "wrong")

const action = fc.oneof(
  fc.record({
    t: fc.constant("insert" as const),
    a: nat,
    b: nat,
    text: typed,
    expect: expectation,
  }),
  fc.record({
    t: fc.constant("delete" as const),
    a: nat,
    b: nat,
    expect: expectation,
  }),
  fc.record({ t: fc.constant("split" as const), a: nat }),
  fc.record({
    t: fc.constant("join" as const),
    i: nat,
    backward: fc.boolean(),
  }),
  fc.record({
    t: fc.constant("kind" as const),
    i: nat,
    kind: fc.constantFrom("title", "heading", "paragraph" as const),
  }),
  fc.record({
    t: fc.constant("list" as const),
    i: nat,
    list: fc.constantFrom(null, "bullet", "numbered" as const),
  }),
  fc.record({
    t: fc.constant("shift" as const),
    i: nat,
    by: fc.constantFrom(1, -1 as const),
  }),
  fc.record({
    t: fc.constant("align" as const),
    i: nat,
    align: fc.constantFrom("left", "center", "justify" as const),
  }),
  fc.record({
    t: fc.constant("mark" as const),
    a: nat,
    b: nat,
    on: fc.boolean(),
    mark: fc.constantFrom("bold", "italic", "underline" as const),
  }),
  fc.record({ t: fc.constant("clear" as const), a: nat, b: nat }),
  fc.record({
    t: fc.constant("link" as const),
    a: nat,
    b: nat,
    text: fc.option(typed, { nil: undefined }),
    off: fc.boolean(),
  }),
  fc.record({
    t: fc.constant("move" as const),
    unit: fc.constantFrom(
      "char",
      "word",
      "line",
      "lineEdge",
      "block",
      "doc" as const
    ),
    dir: fc.constantFrom(1, -1 as const),
    extend: fc.boolean(),
  }),
  fc.record({ t: fc.constant("selectAll" as const) }),
  fc.record({ t: fc.constant("selectWord" as const) }),
  fc.record({ t: fc.constant("selectBlock" as const) }),
  fc.record({ t: fc.constant("type" as const), text: typed })
)

type Action = typeof action extends fc.Arbitrary<infer A> ? A : never
type Plan = { commands: DocCommand[]; text: string | null; refuse: boolean }

const splice = (text: string, from: number, to: number, insert: string) =>
  text.slice(0, from) + insert + text.slice(to)

function plan(
  doc: Document,
  text: string,
  step: Action,
  selection: ReturnType<ReturnType<typeof newEngine>["read"]>["selection"]
): Plan | null {
  const blocks = doc.content
  const blockAt = (i: number) => blocks[i % blocks.length]!
  const range = (a: number, b: number) => {
    const from = posAt(doc, a)
    const to = posAt(doc, b)
    const [lo, hi] = [globalOf(doc, from), globalOf(doc, to)].sort(
      (x, y) => x - y
    )
    return { range: { from, to }, lo: lo!, hi: hi! }
  }
  const same = (command: DocCommand): Plan => ({
    commands: [command],
    text,
    refuse: false,
  })
  switch (step.t) {
    case "insert":
    case "delete": {
      const { range: r, lo, hi } = range(step.a, step.b)
      const insert = step.t === "insert" ? step.text : ""
      const found = text.slice(lo, hi)
      const expect =
        step.expect === "none"
          ? undefined
          : step.expect === "right"
            ? found
            : `${found}x`
      const command: DocCommand =
        step.t === "insert"
          ? {
              op: "insertText",
              range: r,
              text: insert,
              ...(expect === undefined ? {} : { expect }),
            }
          : {
              op: "deleteRange",
              range: r,
              ...(expect === undefined ? {} : { expect }),
            }
      const refuse = step.expect === "wrong"
      return {
        commands: [command],
        text: refuse ? text : splice(text, lo, hi, insert),
        refuse,
      }
    }
    case "split": {
      const at = posAt(doc, step.a)
      const target = blocks.find((each) => each.attrs.id === at.block)!
      const emptyItem =
        target.type === "text_block" &&
        target.attrs.list !== null &&
        !target.content?.length
      const g = globalOf(doc, at)
      return {
        commands: [{ op: "splitBlock", at }],
        text: emptyItem ? text : splice(text, g, g, "\n"),
        refuse: false,
      }
    }
    case "join": {
      const index = step.i % blocks.length
      const edge = step.backward ? index === 0 : index === blocks.length - 1
      const { start, container } = blockStart(doc, index)
      const cut = step.backward ? start - 1 : start + container.text.length
      return {
        commands: [
          {
            op: "joinBlocks",
            block: blockAt(index).attrs.id,
            direction: step.backward ? "backward" : "forward",
          },
        ],
        text: edge ? text : splice(text, cut, cut + 1, ""),
        refuse: edge,
      }
    }
    case "kind":
      return same({
        op: "setBlockKind",
        blocks: [blockAt(step.i).attrs.id],
        kind: step.kind,
      })
    case "list":
      return same({
        op: "setList",
        blocks: [blockAt(step.i).attrs.id],
        list: step.list,
      })
    case "shift":
      return same({
        op: "shiftLevel",
        blocks: [blockAt(step.i).attrs.id],
        by: step.by,
      })
    case "align":
      return same({
        op: "setAlign",
        blocks: [blockAt(step.i).attrs.id],
        align: step.align,
      })
    case "mark":
      return same({
        op: "setMark",
        range: range(step.a, step.b).range,
        mark: { type: step.mark },
        on: step.on,
      })
    case "clear":
      return same({ op: "clearFormatting", range: range(step.a, step.b).range })
    case "link": {
      const { range: r, lo, hi } = range(step.a, step.b)
      if (step.off) return same({ op: "setLink", range: r, href: null })
      const href = safeHref
      const replaces = step.text !== undefined || lo === hi
      return {
        commands: [
          {
            op: "setLink",
            range: r,
            href,
            ...(step.text === undefined ? {} : { text: step.text }),
          },
        ],
        text: replaces ? splice(text, lo, hi, step.text ?? href) : text,
        refuse: false,
      }
    }
    case "type": {
      const r = selectionRange(doc, selection)
      const [lo, hi] = [globalOf(doc, r.from), globalOf(doc, r.to)].sort(
        (x, y) => x - y
      )
      return {
        commands: [{ op: "insertText", range: r, text: step.text }],
        text: splice(text, lo!, hi!, step.text),
        refuse: false,
      }
    }
    default:
      return null
  }
}

describe("no command loses text outside its range", () => {
  it("holds for 10,000 random command and selection sequences", () => {
    fc.assert(
      fc.property(
        paper,
        fc.array(action, { maxLength: 12 }),
        (start, actions) => {
          const engine = newEngine()
          let state: EditorState = engine.load(start, 0, "tab-1")
          for (const step of actions) {
            const { doc, selection } = engine.read(state)
            const before = documentText(doc)
            const planned = plan(doc, before, step, selection)
            if (!planned) {
              const command =
                step.t === "move"
                  ? {
                      op: "move" as const,
                      unit: step.unit,
                      dir: step.dir,
                      extend: step.extend,
                    }
                  : { op: step.t as "selectAll" | "selectWord" | "selectBlock" }
              state = engine.select(state, command)
              const after = engine.read(state)
              expect(documentText(after.doc)).toBe(before)
              if (step.t === "move" && !step.extend) {
                expect(after.selection.kind).toBe("text")
                if (after.selection.kind === "text")
                  expect(after.selection.anchor).toEqual(after.selection.head)
              }
              continue
            }
            const result = engine.run(state, planned.commands, person)
            expect(
              "refusal" in result,
              JSON.stringify({
                step,
                result: "refusal" in result ? result.refusal : null,
              })
            ).toBe(planned.refuse)
            if ("refusal" in result) continue
            state = result.state
            const after = engine.read(state).doc
            expect(documentText(after), JSON.stringify(step)).toBe(planned.text)
            expect(documentSchema.safeParse(after).success).toBe(true)
          }
        }
      ),
      { numRuns: 10_000, seed: 2212 }
    )
  })
})
