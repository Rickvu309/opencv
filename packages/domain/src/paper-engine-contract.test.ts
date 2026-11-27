import assert from "node:assert/strict"
import { test } from "node:test"

import fc from "fast-check"

import {
  agentCommandSchema,
  documentSchema,
  paperEngineBlank,
  type Mark,
  type Run,
} from "./paper-doc/public.js"

const examples: Mark[] = [
  { type: "bold" },
  { type: "italic" },
  { type: "underline" },
  { type: "strike" },
  { type: "link", attrs: { href: "mailto:ada@example.com" } },
  { type: "color", attrs: { value: "#ff8800" } },
  { type: "font", attrs: { family: "Carlito" } },
  { type: "size", attrs: { mpt: 11000 } },
]

const mpt = fc.integer({ min: 1, max: 200000 })
const runs = fc.array(
  fc.oneof(
    fc.constant<Run>({ type: "hard_break" }),
    fc.record({
      type: fc.constant("text" as const),
      text: fc.string({ minLength: 1 }),
      marks: fc.subarray(examples),
    })
  ),
  { maxLength: 4 }
)
const cells = fc.array(
  fc.record({ type: fc.constant("table_cell" as const), content: runs }),
  { minLength: 1, maxLength: 3 }
)
const table = fc.array(cells, { minLength: 1, maxLength: 3 }).map((rows) => {
  const columns = Math.min(...rows.map((row) => row.length))
  return {
    type: "table" as const,
    attrs: {
      columnsMpt: Array.from({ length: columns }, () => 52000),
      borders: "all" as const,
    },
    content: rows.map((row) => ({
      type: "table_row" as const,
      content: row.slice(0, columns),
    })),
  }
})

const blocks = fc.oneof(
  fc.record({
    type: fc.constant("text_block" as const),
    attrs: fc
      .record({
        kind: fc.constantFrom(
          "title",
          "subtitle",
          "heading",
          "subheading",
          "paragraph"
        ),
        align: fc.constantFrom("left", "center", "right", "justify"),
        lineSpacing: fc.constantFrom(null, 1, 1.25, 2),
        keepWithNext: fc.constantFrom(null, true, false),
        rightTabMpt: mpt,
      })
      .chain((attrs) =>
        fc.option(fc.constantFrom("bullet", "numbered")).chain((list) =>
          fc.integer({ min: 0, max: list === null ? 0 : 8 }).map((level) => ({
            ...attrs,
            list,
            level,
          }))
        )
      ),
    content: runs,
  }),
  fc.record({
    type: fc.constant("image" as const),
    attrs: fc.record({
      fileId: fc.uuid(),
      widthMpt: mpt,
      heightMpt: mpt,
      align: fc.constantFrom("left", "center", "right"),
      alt: fc.string(),
    }),
  }),
  table,
  fc.record({
    type: fc.constantFrom("divider", "page_break"),
    attrs: fc.constant({}),
  })
)

const documents = fc.record({
  type: fc.constant("doc" as const),
  attrs: fc.record({
    schema: fc.constant(1 as const),
    page: fc.record({
      size: fc.constantFrom("A4", "Letter"),
      orientation: fc.constantFrom("portrait", "landscape"),
      marginsMpt: fc.record({ top: mpt, right: mpt, bottom: mpt, left: mpt }),
    }),
    template: fc.constantFrom("classic", "modern", "letter"),
  }),
  content: fc.array(blocks, { minLength: 1, maxLength: 8 }).map((blocks) =>
    blocks.map((block, index) => ({
      ...block,
      attrs: { ...block.attrs, id: `block-${index}` },
    }))
  ),
})

test("generated Paper Documents round-trip through the wire schema", () => {
  fc.assert(
    fc.property(documents, (doc) => {
      const wire: unknown = JSON.parse(JSON.stringify(doc))
      assert.deepEqual(documentSchema.parse(wire), wire)
    }),
    { numRuns: 500 }
  )
})

test("a blank CV or Letter is exactly one unformatted paragraph on A4", () => {
  const expected = (id: string, template: string) => ({
    type: "doc",
    attrs: {
      schema: 1,
      template,
      page: {
        size: "A4",
        orientation: "portrait",
        marginsMpt: { top: 72000, right: 72000, bottom: 72000, left: 72000 },
      },
    },
    content: [
      {
        type: "text_block",
        attrs: {
          id,
          kind: "paragraph",
          list: null,
          level: 0,
          align: "left",
          lineSpacing: null,
          keepWithNext: null,
        },
      },
    ],
  })

  const cv = paperEngineBlank.blankCv()
  const letter = paperEngineBlank.blankLetter()
  assert.deepEqual(cv, expected("paragraph-1", "classic"))
  assert.deepEqual(letter, expected("letter-1", "letter"))
  assert.deepEqual(documentSchema.parse(cv), cv)
  assert.deepEqual(documentSchema.parse(letter), letter)
  assert.deepEqual(paperEngineBlank.emptyPaper("cv"), cv)
  assert.deepEqual(
    paperEngineBlank.emptyPaper("letter", "from-port"),
    expected("from-port", "letter")
  )
})

test("every AgentCommand requires expected text for the affected range or blocks", () => {
  const range = {
    from: { block: "b", offset: 0 },
    to: { block: "b", offset: 4 },
  }
  const commands = [
    { op: "replaceText", range, text: "Led", expect: "Made" },
    { op: "formatText", range, mark: "bold", on: true, expect: "Made" },
    {
      op: "insertBlocks",
      after: "b",
      blocks: [{ kind: "paragraph" }],
      expect: "",
    },
    { op: "removeBlocks", blocks: ["b"], expect: ["Made"] },
    { op: "setBlockType", blocks: ["b"], kind: "heading", expect: ["Made"] },
  ]
  for (const { expect, ...command } of commands) {
    assert.equal(agentCommandSchema.safeParse(command).success, false)
    assert.deepEqual(agentCommandSchema.parse({ ...command, expect }), {
      ...command,
      expect,
    })
  }
  assert.equal(
    agentCommandSchema.safeParse({
      op: "removeBlocks",
      blocks: ["b"],
      expect: [],
    }).success,
    false
  )
  assert.equal(
    agentCommandSchema.safeParse({
      op: "insertImage",
      at: range.from,
      expect: "",
    }).success,
    false
  )
})

test("the Document schema rejects malformed blocks and unsafe marks", () => {
  const blank = paperEngineBlank.blankCv()
  const [paragraph] = blank.content
  assert.ok(paragraph?.type === "text_block")
  const withBlocks = (...content: unknown[]) => ({ ...blank, content })
  const withRun = (run: unknown) => withBlocks({ ...paragraph, content: [run] })

  for (const invalid of [
    withBlocks(),
    withBlocks(paragraph, paragraph),
    withBlocks({ ...paragraph, attrs: { ...paragraph.attrs, level: 1 } }),
    withBlocks({
      ...paragraph,
      attrs: { ...paragraph.attrs, rightTabMpt: 0.5 },
    }),
    withBlocks({
      type: "table",
      attrs: { id: "table", columnsMpt: [1000, 1000], borders: "none" },
      content: [{ type: "table_row", content: [{ type: "table_cell" }] }],
    }),
    withRun({ type: "text", text: "" }),
    withRun({ type: "text", text: "x", marks: [examples[1], examples[0]] }),
    withRun({
      type: "text",
      text: "x",
      marks: [{ type: "link", attrs: { href: "javascript:void(0)" } }],
    }),
  ]) {
    assert.equal(documentSchema.safeParse(invalid).success, false)
  }
})
