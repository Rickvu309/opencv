import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"

import { v3Fixtures } from "./test/fixtures.js"
import { fromEditorBlocks, toEditorBlocks } from "./mapping.js"
import { materialize, seedYDoc } from "./ydoc.js"

const SAME_CASES_ON_EVERY_RUN = 20261124

describe("editor block mapping", () => {
  it("runs with no DOM", () => {
    expect("document" in globalThis).toBe(false)
    expect("window" in globalThis).toBe(false)
  })

  for (const [name, fixture] of Object.entries(v3Fixtures)) {
    it(`round-trips ${name} through editor blocks`, () => {
      const result = fromEditorBlocks(fixture.kind, toEditorBlocks(fixture))
      expect(result).toEqual({ ok: true, document: fixture })
    })

    it(`round-trips ${name} through a Yjs document`, () => {
      const result = materialize(seedYDoc(fixture))
      expect(result).toEqual({ ok: true, document: fixture })
    })
  }

  it("lets a line break take the style of the text before it", () => {
    const stored = fromEditorBlocks("letter", [
      {
        id: "a",
        type: "paragraph",
        content: [
          { type: "text", text: "bold", styles: { bold: true } },
          { type: "text", text: "\nplain", styles: {} },
        ],
      },
    ])
    expect(stored.ok).toBe(true)
    if (!stored.ok) return
    const once = materialize(seedYDoc(stored.document))
    expect(once.ok).toBe(true)
    if (!once.ok) return
    expect(materialize(seedYDoc(once.document))).toEqual(once)
    expect(once.document.blocks[0]).toMatchObject({
      content: [{ text: "bold\n", bold: true }, { text: "plain" }],
    })
  })

  it("accepts a CV without a header", () => {
    const fixture = v3Fixtures.richCv as PaperDocument
    const blocks = toEditorBlocks(fixture).slice(1)
    const result = fromEditorBlocks("cv", blocks)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document).not.toHaveProperty("header")
    expect(toEditorBlocks(result.document)).toEqual(blocks)
  })

  it("refuses a child block under a paragraph", () => {
    const blocks = toEditorBlocks(v3Fixtures.richLetter as PaperDocument)
    const first = blocks[0]
    if (!first) throw new Error("fixture has no block")
    const nested = [
      { ...first, children: [{ id: "x", type: "paragraph" as const }] },
      ...blocks.slice(1),
    ]
    const result = fromEditorBlocks("letter", nested)
    expect(result.ok).toBe(false)
  })

  it("refuses a CV block in a letter", () => {
    const result = fromEditorBlocks(
      "letter",
      toEditorBlocks(v3Fixtures.richCv as PaperDocument)
    )
    expect(result.ok).toBe(false)
  })
})

const text = fc.stringMatching(/^[a-zA-Z0-9 .-]{1,8}$/)
const runs = fc.array(
  fc.record({
    text,
    bold: fc.boolean(),
    italic: fc.boolean(),
    href: fc.option(fc.constantFrom("https://a.example/x", "mailto:a@b.co"), {
      nil: undefined,
    }),
  }),
  { maxLength: 4 }
)
const plain = fc.stringMatching(/^[a-zA-Z0-9 ]{0,10}$/)
const item = fc.stringMatching(/^[a-zA-Z0-9 ,\u00B7]{1,8}$/)

function listItems(depth: number): fc.Arbitrary<unknown[]> {
  if (depth === 0) return fc.constant([])
  return fc.array(
    fc.record({
      type: fc.constantFrom("bullet", "numbered"),
      content: runs,
      children: listItems(depth - 1),
    }),
    { maxLength: 2 }
  )
}

const proseBlock = fc.oneof(
  fc.record({ type: fc.constant("paragraph"), content: runs }),
  fc.record({
    type: fc.constant("heading"),
    level: fc.constantFrom(2, 3),
    content: runs,
  }),
  fc.record({ type: fc.constant("divider") }),
  fc.record({
    type: fc.constantFrom("bullet", "numbered"),
    content: runs,
    children: listItems(2),
  })
)

const cvBlock = fc.oneof(
  proseBlock,
  fc.record({
    type: fc.constant("experience"),
    role: plain,
    company: plain,
    period: plain,
    location: plain,
    children: listItems(3),
  }),
  fc.record({
    type: fc.constant("education"),
    school: plain,
    degree: plain,
    period: plain,
    detail: plain,
    children: listItems(3),
  }),
  fc.record({
    type: fc.constant("skills"),
    label: plain,
    items: fc.array(item, { maxLength: 4 }),
  })
)

function numbered(value: unknown, counter: { next: number }): unknown {
  if (Array.isArray(value))
    return value.map((entry) => numbered(entry, counter))
  if (typeof value !== "object" || value === null) return value
  const entries = Object.entries(value).map(([key, entry]) => [
    key,
    numbered(entry, counter),
  ])
  const type = (value as { type?: unknown }).type
  return typeof type === "string" && type !== "text"
    ? Object.fromEntries([["id", `n${counter.next++}`], ...entries])
    : Object.fromEntries(entries)
}

const cvArbitrary = fc
  .record({
    name: plain,
    photo: fc.option(fc.constant("file:6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11"), {
      nil: undefined,
    }),
    blocks: fc.array(cvBlock, { maxLength: 6 }),
  })
  .map(({ name, photo, blocks }) =>
    numbered(
      {
        version: 3,
        kind: "cv",
        header: {
          id: "header",
          type: "header",
          name,
          email: "",
          phone: "",
          city: "",
          linkedin: "",
          ...(photo ? { photo } : {}),
        },
        blocks: [
          { type: "section", kind: "experience", title: "Experience" },
          ...blocks,
        ],
        clashes: [],
      },
      { next: 0 }
    )
  )

const letterArbitrary = fc
  .array(proseBlock, { minLength: 1, maxLength: 6 })
  .map((blocks) =>
    numbered({ version: 3, kind: "letter", blocks, clashes: [] }, { next: 0 })
  )

function valid(candidate: unknown): PaperDocument[] {
  const result = paperDocumentSchema.safeParse(candidate)
  return result.success ? [result.data] : []
}

describe("round trip properties", () => {
  const documents = fc
    .oneof(cvArbitrary, letterArbitrary)
    .chain((candidate) => {
      const [document] = valid(candidate)
      return document
        ? fc.constant(document)
        : fc.constant(v3Fixtures.blankLetter as PaperDocument)
    })

  it("fromEditorBlocks inverts toEditorBlocks", () => {
    fc.assert(
      fc.property(documents, (document) => {
        expect(
          fromEditorBlocks(document.kind, toEditorBlocks(document))
        ).toEqual({
          ok: true,
          document,
        })
      }),
      { numRuns: 300, seed: SAME_CASES_ON_EVERY_RUN }
    )
  })

  it("materialize inverts seedYDoc", () => {
    fc.assert(
      fc.property(documents, (document) => {
        expect(materialize(seedYDoc(document))).toEqual({ ok: true, document })
      }),
      { numRuns: 60, seed: SAME_CASES_ON_EVERY_RUN }
    )
  })
})
