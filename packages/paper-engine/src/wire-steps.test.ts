import { Transform, Step } from "prosemirror-transform"
import { expect, it } from "vitest"
import {
  changeSchema,
  isSafeHref,
  markSchema,
  stepJsonSchema,
} from "@workspace/domain/paper-doc"

import { fromDocument } from "./document-json.js"
import { newEngine, paperOf, person, textBlock } from "./engine.test-support.js"
import { paperSchema } from "./schema.js"

const block = textBlock("line", {
  runs: [
    {
      type: "text",
      text: "link",
      marks: [
        markSchema.parse({
          type: "link",
          attrs: { href: "https://example.org" },
        }),
      ],
    },
  ],
})
const original = paperOf([block])
const testHref = "https://example.com"
if (!isSafeHref(testHref)) throw new Error("Expected a safe link")
const href = testHref

it("refuses a compound inverse and accepts its primitive parts at the wire boundary", () => {
  const doc = fromDocument(original)
  const tr = new Transform(doc).addMark(
    1,
    5,
    paperSchema.marks.link!.create({ href })
  )
  const inverse = tr.steps.at(-1)!.invert(tr.docs.at(-1)!).toJSON()
  expect(inverse.stepType).toBe("markSet")
  expect(stepJsonSchema.safeParse(inverse).success).toBe(false)
  expect(stepJsonSchema.array().safeParse(inverse.steps).success).toBe(true)
})

it("emits decodable forward and inverse steps when replacing an existing link", () => {
  const engine = newEngine()
  const state = engine.load(original, 0, person.client)
  const result = engine.run(
    state,
    [
      {
        op: "setLink",
        href,
        range: {
          from: { block: block.attrs.id, offset: 0 },
          to: { block: block.attrs.id, offset: 4 },
        },
      },
    ],
    person
  )
  if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
  const change = changeSchema.parse(result.change)
  const apply = (tr: Transform, steps: typeof change.steps) => {
    for (const json of steps) tr.step(Step.fromJSON(paperSchema, json))
  }

  const before = fromDocument(original)
  const replay = new Transform(before)
  apply(replay, change.steps)
  expect(replay.doc.eq(fromDocument(engine.read(result.state).doc))).toBe(true)
  apply(replay, change.inverse)
  expect(replay.doc.eq(before)).toBe(true)
})
