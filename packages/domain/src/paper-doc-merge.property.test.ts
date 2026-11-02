import assert from "node:assert/strict"
import { describe, it } from "node:test"

import fc from "fast-check"

import { cvBlockDocumentSchema } from "./paper-blocks/index.ts"
import { letterDocumentV1Schema, withoutBlankParts } from "./paper-codecs.ts"
import {
  legacyPaperOf,
  mergeLegacyEdit,
  normalizeRuns,
  paperDocumentSchema,
  upgradeStoredPaper,
  type PaperDocument,
} from "./paper-doc/index.ts"

type Loose = ReturnType<typeof JSON.parse>

const RUNS = 150
const WORDS = ["alpha", "beta", "gamma", "delta", "omega", "zeta", "eta"]
const KINDS = ["summary", "experience", "education", "skills", "projects"]
const PARTS = [
  "sender",
  "contact",
  "date",
  "recipient",
  "salutation",
  "closing",
  "signature",
] as const

const words = fc
  .array(fc.constantFrom(...WORDS), { minLength: 1, maxLength: 3 })
  .map((list) => list.join(" "))
const lined = fc.oneof(
  words,
  words.map((text) => text.replace(" ", "\n"))
)
const runs = fc
  .array(
    fc.record({
      text: words,
      bold: fc.boolean(),
      italic: fc.boolean(),
      link: fc.boolean(),
    }),
    { minLength: 1, maxLength: 3 }
  )
  .map((list) =>
    normalizeRuns(
      list.map((run) => ({
        text: run.text,
        ...(run.bold ? { bold: true as const } : {}),
        ...(run.italic ? { italic: true as const } : {}),
        ...(run.link ? { href: "https://example.com" as never } : {}),
      }))
    )
  )

type ItemShape = { runs: unknown; children: ItemShape[] }

function itemShape(depth: number): fc.Arbitrary<ItemShape> {
  return fc.record({
    runs,
    children:
      depth === 0
        ? fc.constant([])
        : fc.array(itemShape(depth - 1), { maxLength: 2 }),
  })
}

const proseShape = fc.oneof(
  fc.record({ t: fc.constant("paragraph"), runs }),
  fc.record({ t: fc.constant("heading"), level: fc.constantFrom(2, 3), runs }),
  fc.record({
    t: fc.constant("list"),
    ordered: fc.boolean(),
    item: itemShape(2),
  }),
  fc.record({ t: fc.constant("divider") })
)

const blockShape = fc.oneof(
  fc.record({ t: fc.constant("paragraph"), runs }),
  fc.record({
    t: fc.constant("heading"),
    level: fc.constantFrom(2, 3),
    runs,
  }),
  fc.record({
    t: fc.constant("list"),
    ordered: fc.boolean(),
    item: itemShape(2),
  }),
  fc.record({ t: fc.constant("divider") }),
  fc.record({
    t: fc.constant("experience"),
    role: words,
    company: words,
    period: words,
    location: fc.oneof(fc.constant(""), words),
    children: fc.array(itemShape(2), { maxLength: 3 }),
  }),
  fc.record({
    t: fc.constant("education"),
    school: words,
    degree: words,
    period: words,
    detail: fc.oneof(fc.constant(""), words),
    children: fc.array(itemShape(1), { maxLength: 2 }),
  }),
  fc.record({
    t: fc.constant("skills"),
    label: words,
    items: fc.array(words, { maxLength: 3 }),
  })
)

const cvShape = fc.record({
  leading: fc.array(proseShape, { maxLength: 2 }),
  sections: fc.array(
    fc.record({
      kind: fc.constantFrom(...KINDS),
      title: words,
      blocks: fc.array(blockShape, { maxLength: 4 }),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  name: words,
})

function counter(prefix: string) {
  let n = 0
  return () => `${prefix}${(n += 1)}`
}

function itemOf(shape: ItemShape, next: () => string, type: string): unknown {
  return {
    id: next(),
    type,
    content: shape.runs,
    children: shape.children.map((child) => itemOf(child, next, type)),
  }
}

function blockOf(raw: unknown, next: () => string): unknown {
  const shape = raw as Record<string, Loose>
  const type = shape.ordered ? "numbered" : "bullet"
  switch (shape.t) {
    case "paragraph":
      return { id: next(), type: "paragraph", content: shape.runs }
    case "heading":
      return {
        id: next(),
        type: "heading",
        level: shape.level,
        content: shape.runs,
      }
    case "list":
      return itemOf(shape.item, next, type)
    case "divider":
      return { id: next(), type: "divider" }
    case "experience":
      return {
        id: next(),
        type: "experience",
        role: shape.role,
        company: shape.company,
        period: shape.period,
        location: shape.location,
        children: shape.children.map((c: ItemShape) =>
          itemOf(c, next, "bullet")
        ),
      }
    case "education":
      return {
        id: next(),
        type: "education",
        school: shape.school,
        degree: shape.degree,
        period: shape.period,
        detail: shape.detail,
        children: shape.children.map((c: ItemShape) =>
          itemOf(c, next, "bullet")
        ),
      }
    default:
      return {
        id: next(),
        type: "skills",
        label: shape.label,
        items: shape.items,
      }
  }
}

function cvOf(shape: Loose) {
  const next = counter("n")
  return paperDocumentSchema.parse({
    version: 3,
    kind: "cv",
    clashes: [],
    header: {
      id: "header",
      type: "header",
      name: shape.name,
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    blocks: [
      ...shape.leading.map((block: unknown) => blockOf(block, next)),
      ...shape.sections.flatMap((section: Loose) => [
        {
          id: next(),
          type: "section",
          kind: section.kind,
          title: section.title,
        },
        ...section.blocks.map((block: unknown) => blockOf(block, next)),
      ]),
    ],
  })
}

const edit = fc.record({
  kind: fc.constantFrom(
    "editText",
    "editItem",
    "insertBlock",
    "insertItem",
    "deleteBlock",
    "deleteItem",
    "deleteSection",
    "moveBlock",
    "insertSection",
    "editHeader",
    "duplicateText",
    "editEntry"
  ),
  a: fc.nat(50),
  b: fc.nat(50),
  text: lined,
})
const saves = fc.array(fc.array(edit, { minLength: 1, maxLength: 3 }), {
  minLength: 1,
  maxLength: 2,
})

function pick<T>(list: readonly T[], at: number): T | undefined {
  return list.length === 0 ? undefined : list[at % list.length]
}

function applyCvEdits(
  legacy: Loose,
  edits: readonly Loose[],
  next: () => string
) {
  const doc = structuredClone(legacy)
  const all = () => doc.sections.flatMap((section: Loose) => section.blocks)
  const listed = () =>
    all().filter(
      (block: Loose) => "items" in block && block.type !== "skills-group"
    )
  for (const op of edits) {
    const section = pick(doc.sections, op.a) as Loose
    switch (op.kind) {
      case "editText": {
        const block = pick(
          all().filter((b: Loose) => "text" in b),
          op.a
        ) as Loose
        if (block) block.text = op.text
        break
      }
      case "editItem": {
        const block = pick(listed(), op.a) as Loose
        const item = block && pick(block.items, op.b)
        if (item) item.text = op.text
        break
      }
      case "insertBlock":
        section?.blocks.splice(op.b % (section.blocks.length + 1), 0, {
          id: next(),
          type: "text",
          text: op.text,
        })
        break
      case "insertItem": {
        const block = pick(listed(), op.a) as Loose
        block?.items.splice(op.b % (block.items.length + 1), 0, {
          id: next(),
          text: op.text,
        })
        break
      }
      case "deleteBlock":
        section?.blocks.splice(op.b % Math.max(section.blocks.length, 1), 1)
        break
      case "deleteItem": {
        const block = pick(listed(), op.a) as Loose
        block?.items.splice(op.b % Math.max(block.items.length, 1), 1)
        break
      }
      case "deleteSection":
        if (section) doc.sections.splice(doc.sections.indexOf(section), 1)
        break
      case "moveBlock":
        if (section && section.blocks.length > 1) {
          const [moved] = section.blocks.splice(op.a % section.blocks.length, 1)
          section.blocks.splice(op.b % (section.blocks.length + 1), 0, moved)
        }
        break
      case "insertSection":
        doc.sections.splice(op.b % (doc.sections.length + 1), 0, {
          id: next(),
          kind: KINDS[op.a % KINDS.length],
          blocks: [{ id: next(), type: "text", text: op.text }],
        })
        break
      case "editHeader":
        doc.header.name = op.text
        break
      case "duplicateText": {
        const source = pick(
          all().filter((b: Loose) => "text" in b),
          op.a
        ) as Loose
        if (source && section) {
          section.blocks.push({ id: next(), type: "text", text: source.text })
        }
        break
      }
      default: {
        const entry = pick(
          all().filter(
            (b: Loose) => b.type.endsWith("entry") || b.type === "skills-group"
          ),
          op.a
        ) as Loose
        if (entry?.type === "experience-entry") entry.role = op.text
        else if (entry?.type === "education-entry") entry.detail = op.text
        else if (entry) entry.items = [op.text]
      }
    }
  }
  const hasContent = (block: Loose) =>
    !("items" in block) || block.items.length > 0
  doc.sections = doc.sections.filter(
    (section: Loose) =>
      !section.id.startsWith("section-leading") ||
      section.blocks.some(hasContent)
  )
  return doc
}

function stripIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripIds)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .map(([key, child]) => [key, stripIds(child)])
    )
  }
  return value
}

function v3Of(kind: "cv" | "letter", stored: unknown): PaperDocument {
  const result = upgradeStoredPaper(kind, stored)
  if (!result.ok) throw new Error(result.message)
  return result.document
}

describe("merge of an old-editor save (property)", () => {
  it("gives a CV back when the old editor saves it unchanged", () => {
    fc.assert(
      fc.property(cvShape, (shape) => {
        const current = cvOf(shape)
        const sent = v3Of("cv", legacyPaperOf(current))
        assert.deepEqual(mergeLegacyEdit(current, sent), current)
      }),
      { numRuns: RUNS }
    )
  })

  it("keeps the words of every CV save, in order, and a valid paper", () => {
    fc.assert(
      fc.property(cvShape, saves, (shape, rounds) => {
        let current: PaperDocument = cvOf(shape)
        let legacy: Loose = legacyPaperOf(current)
        const next = counter("x")
        for (const edits of rounds) {
          const sent = applyCvEdits(legacy, edits, next)
          fc.pre(cvBlockDocumentSchema.safeParse(sent).success)
          const sentPaper = v3Of("cv", sent)
          const merged = mergeLegacyEdit(current, sentPaper)
          assert.equal(paperDocumentSchema.safeParse(merged).success, true)
          assert.deepEqual(
            stripIds(v3Of("cv", legacyPaperOf(merged))),
            stripIds(sentPaper)
          )
          assert.deepEqual(legacyPaperOf(merged, sent), sent)
          current = merged
          legacy = legacyPaperOf(merged, sent)
        }
      }),
      { numRuns: RUNS }
    )
  })
})

const letterBlock = fc.oneof(
  fc.record({ t: fc.constant("paragraph"), runs }),
  fc.record({ t: fc.constant("blank") }),
  fc.record({ t: fc.constant("heading"), level: fc.constantFrom(2, 3), runs }),
  fc.record({
    t: fc.constant("list"),
    ordered: fc.boolean(),
    item: itemShape(2),
  }),
  fc.record({ t: fc.constant("divider") })
)

const letterShape = fc.record({
  lids: fc.boolean(),
  body: fc.array(letterBlock, { maxLength: 5 }),
  parts: fc.record(
    Object.fromEntries(
      PARTS.map((part) => [part, fc.option(words, { nil: undefined })])
    )
  ),
})

function letterOf(shape: Loose) {
  const count = counter(shape.lids ? "l-" : "c")
  const paragraph = (text: string) => ({
    id: count(),
    type: "paragraph",
    content: text === "" ? [] : [{ text }],
  })
  const leading = PARTS.slice(0, 5).flatMap((part) =>
    shape.parts[part] ? [paragraph(shape.parts[part])] : []
  )
  const trailing = ["closing", "signature"].flatMap((part) =>
    shape.parts[part] ? [paragraph(shape.parts[part])] : []
  )
  const body = shape.body.map((block: Loose) => {
    if (block.t === "blank") return paragraph("")
    if (block.t === "paragraph") {
      return { id: count(), type: "paragraph", content: block.runs }
    }
    if (block.t === "heading") {
      return {
        id: count(),
        type: "heading",
        level: block.level,
        content: block.runs,
      }
    }
    if (block.t === "divider") return { id: count(), type: "divider" }
    return itemOf(block.item, count, block.ordered ? "numbered" : "bullet")
  })
  const witness = Object.fromEntries(
    PARTS.flatMap((part) =>
      shape.parts[part] ? [[part, shape.parts[part]]] : []
    )
  )
  const current = paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    clashes: [],
    blocks: [...leading, ...body, ...trailing],
  })
  return { current, witness: { markdown: "", ...witness } }
}

const letterEdit = fc.record({
  kind: fc.constantFrom(
    "edit",
    "insert",
    "delete",
    "move",
    "duplicate",
    "editPart",
    "dropPart"
  ),
  a: fc.nat(50),
  b: fc.nat(50),
  text: lined,
})

function applyLetterEdits(legacy: Loose, edits: readonly Loose[]) {
  const letter = { ...legacy }
  const body: string[] = letter.markdown ? letter.markdown.split("\n\n") : []
  for (const op of edits) {
    const part = PARTS[op.a % PARTS.length]!
    switch (op.kind) {
      case "edit":
        if (body.length > 0) body[op.a % body.length] = op.text
        break
      case "insert":
        body.splice(op.b % (body.length + 1), 0, op.text)
        break
      case "delete":
        if (body.length > 0) body.splice(op.a % body.length, 1)
        break
      case "move":
        if (body.length > 1) {
          const [moved] = body.splice(op.a % body.length, 1)
          body.splice(op.b % (body.length + 1), 0, moved!)
        }
        break
      case "duplicate":
        if (body.length > 0) {
          body.splice(op.b % (body.length + 1), 0, body[op.a % body.length]!)
        }
        break
      case "editPart":
        letter[part] = op.text
        break
      default:
        delete letter[part]
    }
  }
  letter.markdown = body.join("\n\n")
  return withoutBlankParts(letter)
}

describe("merge of an old-editor letter save (property)", () => {
  it("keeps the paragraphs and parts of every save, valid and in order (excluding a paragraph with a blank line and blank list items)", () => {
    fc.assert(
      fc.property(
        letterShape,
        fc.array(fc.array(letterEdit, { minLength: 1, maxLength: 3 }), {
          minLength: 1,
          maxLength: 2,
        }),
        (shape, rounds) => {
          const made = letterOf(shape)
          let current: PaperDocument = made.current
          let legacy: Loose = legacyPaperOf(current, made.witness)
          for (const edits of rounds) {
            const sent = applyLetterEdits(legacy, edits)
            fc.pre(letterDocumentV1Schema.safeParse(sent).success)
            const sentPaper = v3Of("letter", sent)
            const merged = mergeLegacyEdit(current, sentPaper)
            assert.equal(paperDocumentSchema.safeParse(merged).success, true)
            assert.deepEqual(
              stripIds(v3Of("letter", legacyPaperOf(merged))),
              stripIds(sentPaper)
            )
            assert.deepEqual(legacyPaperOf(merged, sent), sent)
            current = merged
            legacy = legacyPaperOf(merged, sent)
          }
        }
      ),
      { numRuns: RUNS }
    )
  })
})
