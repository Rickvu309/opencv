import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  blankCv,
  blankLetter,
  paperDocumentSchema,
  nodeFieldSetSchema,
  paperNodeSpecs,
  paperPlainText,
  richTextOf,
  sectionsOf,
  type NodeId,
} from "./paper-doc/index.ts"

const id = (value: string) => value as NodeId

function paragraph(value: string, text = "") {
  return { id: value, type: "paragraph", content: richTextOf(text) }
}

function bullet(value: string, children: unknown[] = []) {
  return { id: value, type: "bullet", content: richTextOf(value), children }
}

function section(value: string, kind = "experience") {
  return { id: value, type: "section", kind, title: kind }
}

function cv(blocks: unknown[], clashes: unknown[] = []) {
  return { ...blankCv(), blocks, clashes }
}

function letter(blocks: unknown[], clashes: unknown[] = []) {
  return { ...blankLetter(), blocks, clashes }
}

function nest(depth: number): unknown {
  return depth === 0
    ? undefined
    : bullet(`n${depth}`, [nest(depth - 1)].filter(Boolean))
}

function refusal(candidate: unknown): string {
  const parsed = paperDocumentSchema.safeParse(candidate)
  assert.equal(parsed.success, false)
  return parsed.success
    ? ""
    : parsed.error.issues.map((issue) => issue.message).join("; ")
}

describe("paper document v3", () => {
  it("accepts the blank CV and the blank letter", () => {
    assert.equal(paperDocumentSchema.safeParse(blankCv()).success, true)
    assert.equal(paperDocumentSchema.safeParse(blankLetter()).success, true)
  })

  it("accepts a full CV and a full letter", () => {
    const full = cv([
      section("s1", "summary"),
      paragraph("p1", "Hello"),
      section("s2"),
      {
        id: "e1",
        type: "experience",
        role: "Lead",
        company: "Club",
        period: "2024",
        location: "",
        children: [bullet("b1", [bullet("b2", [bullet("b3")])])],
      },
      section("s3", "skills"),
      { id: "k1", type: "skills", label: "Tools", items: ["Figma", "SQL"] },
    ])
    assert.equal(paperDocumentSchema.safeParse(full).success, true)
    const note = letter([
      { id: "h1", type: "heading", level: 2, content: richTextOf("Dear team") },
      bullet("b1", [bullet("b2")]),
      { id: "d1", type: "divider" },
    ])
    assert.equal(paperDocumentSchema.safeParse(note).success, true)
  })

  it("refuses a duplicate id, also inside list children and against the header", () => {
    assert.match(refusal(cv([section("a"), paragraph("a")])), /Duplicate id a/)
    assert.match(
      refusal(cv([section("a"), bullet("b", [bullet("a")])])),
      /Duplicate id a/
    )
    assert.match(refusal(cv([section("header")])), /Duplicate id header/)
  })

  it("refuses an entry before any section", () => {
    const entry = { id: "k1", type: "skills", label: "", items: [] }
    assert.match(refusal(cv([entry, section("s1")])), /after a section/)
    assert.equal(
      paperDocumentSchema.safeParse(cv([section("s1"), entry])).success,
      true
    )
  })

  it("allows prose before the first section", () => {
    assert.equal(
      paperDocumentSchema.safeParse(cv([paragraph("p1"), section("s1")]))
        .success,
      true
    )
  })

  it("refuses list depth four and accepts depth three", () => {
    assert.equal(paperDocumentSchema.safeParse(letter([nest(3)])).success, true)
    assert.match(refusal(letter([nest(4)])), /at most 3 deep/)
    const entryItems = [
      bullet("b1", [bullet("b2", [bullet("b3", [bullet("b4")])])]),
    ]
    const entry = {
      id: "e1",
      type: "experience",
      role: "",
      company: "",
      period: "",
      location: "",
      children: entryItems,
    }
    assert.match(refusal(cv([section("s1"), entry])), /at most 3 deep/)
  })

  it("refuses a letter with CV blocks", () => {
    refusal(letter([section("s1")]))
    refusal(letter([{ id: "k1", type: "skills", label: "", items: [] }]))
  })

  it("sets no cap on blocks, text or skill items, so no stored row is refused", () => {
    const blocks = Array.from({ length: 3000 }, (_, index) =>
      paragraph(`p${index}`, "x".repeat(25000))
    )
    assert.equal(paperDocumentSchema.safeParse(letter(blocks)).success, true)
    const items = Array.from({ length: 500 }, (_, index) => `item ${index}, a`)
    const skills = { id: "k1", type: "skills", label: "L", items }
    assert.equal(
      paperDocumentSchema.safeParse(cv([section("s1"), skills])).success,
      true
    )
  })

  it("refuses strict extras and a wrong version", () => {
    refusal({ ...blankLetter(), extra: 1 })
    refusal({ ...blankLetter(), version: 2 })
  })

  it("accepts skill items with commas and newlines, and refuses an empty one", () => {
    const skills = (items: string[]) =>
      cv([section("s1"), { id: "k1", type: "skills", label: "", items }])
    assert.equal(
      paperDocumentSchema.safeParse(skills(["a, b", "x\ny", "1,000 users"]))
        .success,
      true
    )
    refusal(skills([""]))
  })

  it("answers a 4000 deep list chain with an error instead of throwing", () => {
    let item: unknown = bullet("x0")
    for (let level = 1; level < 4000; level += 1) {
      item = bullet(`x${level}`, [item])
    }
    const parsed = paperDocumentSchema.safeParse(letter([item]))
    assert.equal(parsed.success, false)
  })

  it("lets a list block omit its children", () => {
    const parsed = paperDocumentSchema.parse(
      letter([{ id: "b1", type: "bullet", content: "Hi" }])
    )
    assert.deepEqual(
      parsed.blocks[0]?.type === "bullet" && parsed.blocks[0].children,
      []
    )
  })

  it("refuses prototype keys as a node type in a field set", () => {
    for (const type of [
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
    ]) {
      assert.equal(nodeFieldSetSchema.safeParse({ type }).success, false, type)
    }
    assert.equal(
      nodeFieldSetSchema.safeParse({ type: "heading" }).success,
      true
    )
  })

  it("checks clash offers against the document kind and the node type", () => {
    const base = {
      id: "c1",
      node: "p1",
      offeredBy: "coach",
      at: "2026-11-02T10:00:00.000Z",
    }
    const restoreOf = (
      node: unknown,
      at = { parent: "body", after: null }
    ) => ({
      ...base,
      offer: { kind: "restore", node, at },
    })
    const experience = {
      id: "e9",
      type: "experience",
      role: "r",
      company: "c",
      period: "p",
      location: "",
      children: [],
    }
    assert.match(
      refusal(letter([paragraph("p1")], [restoreOf(experience)])),
      /only text blocks/
    )
    assert.match(
      refusal(letter([paragraph("p1")], [restoreOf(section("s9"))])),
      /only text blocks/
    )
    assert.equal(
      paperDocumentSchema.safeParse(
        cv([section("s1")], [restoreOf(experience)])
      ).success,
      true
    )
    assert.match(
      refusal(
        letter(
          [paragraph("p1")],
          [restoreOf(paragraph("p9"), { parent: "nope", after: null })]
        )
      ),
      /parent that is not in the paper/
    )
    assert.match(
      refusal(
        letter(
          [paragraph("p1")],
          [restoreOf(paragraph("p9"), { parent: "body", after: "nope" })]
        )
      ),
      /neighbour that is not in the paper/
    )
    const fields = (value: unknown) => ({
      ...base,
      offer: { kind: "fields", fields: value },
    })
    assert.match(
      refusal(
        letter([paragraph("p1")], [fields({ company: "Acme", type: "skills" })])
      ),
      /no field company|cannot turn into skills/
    )
    assert.match(
      refusal(letter([paragraph("p1")], [fields({ type: "skills" })])),
      /cannot turn into skills/
    )
    assert.equal(
      paperDocumentSchema.safeParse(
        letter([paragraph("p1")], [fields({ content: "Hi", type: "heading" })])
      ).success,
      true
    )
  })

  it("keeps clashes in the schema and refuses a clash for a missing block", () => {
    const clash = {
      id: "c1",
      node: "p1",
      offer: { kind: "remove" },
      offeredBy: "coach",
      at: "2026-11-02T10:00:00.000Z",
    }
    assert.equal(
      paperDocumentSchema.safeParse(letter([paragraph("p1")], [clash])).success,
      true
    )
    assert.match(
      refusal(letter([paragraph("p2")], [clash])),
      /not in the paper/
    )
    const restore = {
      ...clash,
      offer: {
        kind: "restore",
        node: paragraph("gone"),
        at: { parent: "body", after: null },
      },
    }
    assert.equal(
      paperDocumentSchema.safeParse(letter([paragraph("p2")], [restore]))
        .success,
      true
    )
  })

  it("accepts markdown strings for rich text at the boundary and stores runs", () => {
    const parsed = paperDocumentSchema.parse(
      letter([{ id: "p1", type: "paragraph", content: "Hi **there**" }])
    )
    assert.deepEqual(
      parsed.blocks[0]?.type === "paragraph" && parsed.blocks[0].content,
      [{ text: "Hi " }, { text: "there", bold: true }]
    )
  })

  it("groups a CV by its section markers", () => {
    const parsed = paperDocumentSchema.parse(
      cv([
        paragraph("lead"),
        section("s1"),
        paragraph("p1"),
        section("s2"),
        paragraph("p2"),
      ])
    )
    assert.equal(parsed.kind, "cv")
    if (parsed.kind !== "cv") return
    assert.deepEqual(
      sectionsOf(parsed).map((group) => [
        group.section?.id ?? null,
        group.blocks.map((block) => block.id),
      ]),
      [
        [null, ["lead"]],
        ["s1", ["p1"]],
        ["s2", ["p2"]],
      ]
    )
  })

  it("lists every node type once in the spec table and builds valid blanks", () => {
    for (const [type, spec] of Object.entries(paperNodeSpecs)) {
      assert.equal(spec.type, type)
      const blank = spec.blank(id("x1"))
      assert.equal(spec.schema.safeParse(blank).success, true, type)
      assert.equal(typeof spec.plainText(blank as never), "string")
      for (const target of spec.turnInto) assert.ok(target in paperNodeSpecs)
    }
  })

  it("reads plain text from the header, titles and blocks", () => {
    const parsed = paperDocumentSchema.parse(
      cv([section("s1", "summary"), paragraph("p1", "Hello")])
    )
    assert.equal(paperPlainText(parsed), "summary\nHello")
  })
})
