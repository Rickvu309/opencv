import fc from "fast-check"
import { Transform, Step } from "prosemirror-transform"
import { expect, it } from "vitest"
import {
  docCommandSchema,
  isSafeHref,
  markSchema,
} from "@workspace/domain/paper-doc"
import type {
  DocCommand,
  Document,
  StepJSON,
} from "@workspace/domain/paper-doc"

import { fromDocument, toDocument } from "./document-json.js"
import { documentText, textContainers } from "./index.js"
import { newEngine, paperOf, person, textBlock } from "./engine.test-support.js"
import { paperSchema } from "./schema.js"

const parsedPhoto = docCommandSchema.parse({
  op: "insertImage",
  at: { block: "first", offset: 0 },
  fileId: "c055b555-8e3d-4e41-ab24-4a170cd16d32",
  widthMpt: 50000,
  heightMpt: 60000,
})
if (parsedPhoto.op !== "insertImage")
  throw new Error("Expected a photo command")
const photo = parsedPhoto
const testHref = "https://example.com"
if (!isSafeHref(testHref)) throw new Error("Expected a safe link")
const href = testHref

const choices = fc.record({
  op: fc.integer({ min: 0, max: 21 }),
  target: fc.nat(30),
  offset: fc.nat(30),
  length: fc.nat(6),
  text: fc.constantFrom("x", "é", "", "\n", "🙂", "XY", "x.", "日本"),
})
type Choice = ReturnType<typeof choices.generate>["value"]

const initial = paperOf([
  textBlock("first", {
    runs: [
      { type: "text", text: "Text ", marks: [{ type: "bold" }] },
      {
        type: "text",
        text: "and a link",
        marks: [
          markSchema.parse({
            type: "link",
            attrs: { href: "https://example.org" },
          }),
        ],
      },
      { type: "hard_break" },
      { type: "text", text: "x.x.x" },
    ],
  }),
  textBlock("second", { text: "Bullet", list: "bullet" }),
])

function edits(
  doc: Document,
  { op, target, offset, length, text }: Choice
): DocCommand[] {
  const block = doc.content[target % doc.content.length]!
  const containers = textContainers(doc)
  const container = containers[target % containers.length]
  const from = container
    ? {
        block: container.block,
        ...(container.cell ? { cell: container.cell } : {}),
        offset: offset % (container.text.length + 1),
      }
    : { block: block.attrs.id, offset: 0 }
  const to = container
    ? {
        ...from,
        offset: Math.min(from.offset + length, container.text.length),
      }
    : from
  const range = { from, to }
  const id = block.attrs.id
  const point = { block: id, offset: 0 }
  switch (op) {
    case 0:
      return container ? [{ op: "insertText", range, text }] : []
    case 1:
      return container ? [{ op: "deleteRange", range }] : []
    case 2:
      return container ? [{ op: "splitBlock", at: from }] : []
    case 3:
      return container
        ? [
            {
              op: "setMark",
              range,
              mark: { type: "bold" },
              on: length % 2 === 0,
            },
          ]
        : []
    case 4:
      return container ? [{ op: "setLink", range, href }] : []
    case 5:
      return container ? [{ op: "clearFormatting", range }] : []
    case 6:
      return container
        ? [
            {
              op: "pasteFragment",
              range,
              fragment: [
                {
                  type: "text",
                  text: text || "pasted",
                  marks: [{ type: "italic" }],
                },
                { type: "hard_break" },
              ],
            },
          ]
        : []
    case 7:
      return block.type === "table"
        ? []
        : [
            {
              op: "pasteFragment",
              range: { from: point, to: point },
              fragment: [initial.content[0]!, initial.content[1]!],
            },
          ]
    case 8:
      return container ? [{ ...photo, at: from }] : []
    case 9:
      return block.type === "image"
        ? [
            {
              op: "setImage",
              block: id,
              align: "right",
              alt: text,
              widthMpt: 64000,
            },
          ]
        : []
    case 10:
      return container
        ? [{ op: "insertTable", at: from, rows: 2, cols: 2 }]
        : []
    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
      return block.type === "table"
        ? [
            {
              op: "editTable",
              block: id,
              row: offset % block.content.length,
              col: length % block.attrs.columnsMpt.length,
              action: (
                [
                  "rowBelow",
                  "colRight",
                  "deleteRow",
                  "deleteCol",
                  "deleteTable",
                ] as const
              )[op - 11]!,
            },
          ]
        : []
    case 16:
      return container
        ? [
            {
              op: "insertBlock",
              at: from,
              block: length % 2 ? "divider" : "page_break",
            },
          ]
        : []
    case 17:
      return [{ op: "deleteBlock", block: id }]
    case 18:
      return [
        {
          op: "replaceAll",
          find: length % 2 ? "X" : "x.",
          replace: text,
          matchCase: length % 3 === 0,
        },
      ]
    case 19:
      return [
        {
          op: "setPageSetup",
          page: {
            ...doc.attrs.page,
            orientation: length % 2 ? "landscape" : "portrait",
            marginsMpt: { ...doc.attrs.page.marginsMpt, bottom: offset * 1000 },
          },
        },
      ]
    case 20:
      return [
        { op: "setTemplate", template: length % 2 ? "modern" : "classic" },
      ]
    default:
      return block.type === "text_block"
        ? [
            { op: "setBlockKind", blocks: [id], kind: "title" },
            { op: "setAlign", blocks: [id], align: "center" },
          ]
        : []
  }
}

function replay(doc: Document, steps: StepJSON[]) {
  const tr = new Transform(fromDocument(doc))
  for (const step of steps) tr.step(Step.fromJSON(paperSchema, step))
  return toDocument(tr.doc)
}

it("restores the exact before and after documents through steps, undo and redo", () => {
  fc.assert(
    fc.property(
      fc.array(choices, { minLength: 1, maxLength: 30 }),
      (sequence) => {
        const engine = newEngine()
        let state = engine.load(initial, 0, person.client)
        const start = engine.read(state).doc
        for (const choice of sequence) {
          const before = engine.read(state).doc
          const commands = edits(before, choice)
          if (!commands.length) continue
          const result = engine.run(state, commands, person)
          if ("refusal" in result)
            throw new Error(
              JSON.stringify({ commands, refusal: result.refusal })
            )
          state = result.state
          const after = engine.read(state).doc
          expect(replay(before, result.change.steps)).toEqual(after)
          expect(replay(after, result.change.inverse)).toEqual(before)
        }
        const end = engine.read(state).doc
        while (true) {
          const result = engine.undo(state)
          if (!result) break
          const before = engine.read(state).doc
          state = result.state
          expect(replay(before, result.change.steps)).toEqual(
            engine.read(state).doc
          )
          expect(replay(engine.read(state).doc, result.change.inverse)).toEqual(
            before
          )
        }
        expect(engine.read(state).doc).toEqual(start)
        while (true) {
          const result = engine.redo(state)
          if (!result) break
          const before = engine.read(state).doc
          state = result.state
          const after = engine.read(state).doc
          expect(replay(before, result.change.steps)).toEqual(after)
          expect(replay(after, result.change.inverse)).toEqual(before)
        }
        expect(engine.read(state).doc).toEqual(end)
      }
    ),
    { numRuns: 2000, seed: 2216 }
  )
})

it("keeps more than the default 100 undo events", () => {
  const engine = newEngine()
  let state = engine.load(initial, 0, person.client)
  for (let index = 0; index < 130; index += 1) {
    const result = engine.run(
      state,
      [{ op: "setTemplate", template: index % 2 ? "classic" : "modern" }],
      person
    )
    if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
    state = result.state
  }
  for (let index = 0; index < 130; index += 1) {
    const result = engine.undo(state)
    expect(result).not.toBeNull()
    state = result!.state
  }
  expect(engine.undo(state)).toBeNull()
  expect(documentText(engine.read(state).doc)).toBe(documentText(initial))
  expect(engine.read(state).doc).toEqual(initial)
})
