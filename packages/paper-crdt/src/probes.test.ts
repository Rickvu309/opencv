import { paperDocumentSchema } from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"

import {
  fromEditorBlocks,
  materialize,
  seedYDoc,
  toEditorBlocks,
  writeDocument,
} from "./index.js"
import { paperBlockConfigs, paperSchema } from "./schema.js"
import { cv, outline, para, room, snapshot } from "./test/room.js"

const SKILLS = [
  { id: "s1", type: "section", kind: "skills", title: "Skills" },
  {
    id: "k1",
    type: "skills",
    label: "Tech",
    items: ["Node.js, TypeScript", " React ", "C·D", "  ", "Plain"],
  },
]

function skillItems(document: ReturnType<typeof snapshot>): string[] {
  const block = document.blocks.find((candidate) => candidate.type === "skills")
  return block?.type === "skills" ? block.items : []
}

describe("skills keep one item per editor node", () => {
  it("round-trips commas, middle dots and spaces through blocks", () => {
    const document = cv(SKILLS)
    expect(fromEditorBlocks("cv", toEditorBlocks(document))).toEqual({
      ok: true,
      document,
    })
  })

  it("round-trips commas, middle dots and spaces through Yjs", () => {
    const document = cv(SKILLS)
    expect(materialize(seedYDoc(document))).toEqual({ ok: true, document })
  })

  it("lets the Coach edit items while the person types in another", () => {
    const { live, merge, fork } = room(cv(SKILLS))
    const atRead = fork()
    const typed = cv([
      SKILLS[0],
      {
        ...SKILLS[1],
        items: [...skillItems(cv(SKILLS)).slice(0, 4), "Plain PERSON"],
      },
    ])
    merge(writeDocument(live, typed, "person"), "person")
    const edited = cv([
      SKILLS[0],
      {
        ...SKILLS[1],
        items: ["Node.js, TypeScript", "C·D", "  ", "Plain", "Rust"],
      },
    ])
    merge(writeDocument(atRead, edited, "coach:1"), "coach:1")
    expect(skillItems(snapshot(live))).toEqual([
      "Node.js, TypeScript",
      "C·D",
      "  ",
      "Plain PERSON",
      "Rust",
    ])
  })

  it("refuses a skills block that holds anything but skill items", () => {
    const blocks = toEditorBlocks(cv(SKILLS)).map((block) =>
      block.type === "paperSkills"
        ? { ...block, children: [{ id: "x", type: "paragraph" as const }] }
        : block
    )
    expect(fromEditorBlocks("cv", blocks).ok).toBe(false)
  })

  it("drops a skill item the person emptied", () => {
    const { live } = room(cv(SKILLS))
    const emptied = cv([
      SKILLS[0],
      {
        ...SKILLS[1],
        items: ["Node.js, TypeScript", " React ", "C·D", "Plain"],
      },
    ])
    writeDocument(live, emptied, "person")
    expect(skillItems(snapshot(live))).toEqual([
      "Node.js, TypeScript",
      " React ",
      "C·D",
      "Plain",
    ])
  })
})

describe("the seed and the schema stay honest", () => {
  it("refuses to seed a document with open clashes", () => {
    const document = paperDocumentSchema.parse({
      ...cv([para("p1", "x")]),
      clashes: [
        {
          id: "c1",
          node: "p1",
          offer: { kind: "remove" },
          offeredBy: "coach",
          at: "2026-11-02T00:00:00.000Z",
        },
      ],
    })
    expect(() => seedYDoc(document)).toThrow("open clashes")
  })

  it("refuses a fragment that holds a second root", () => {
    const document = cv([para("p1", "one")])
    const twice = new Y.Doc()
    Y.applyUpdate(twice, seedYDoc(document))
    Y.applyUpdate(twice, seedYDoc(document))
    const result = materialize(twice)
    expect(result.ok).toBe(false)
    expect(() => writeDocument(twice, document, "coach:1")).toThrow("one root")
  })

  it("builds the server heading levels from the block configs", () => {
    const levels = (schema: unknown) =>
      (schema as { level: { values: unknown } }).level.values
    expect(levels(paperSchema.blockSchema.heading.propSchema)).toEqual(
      levels(paperBlockConfigs.heading.propSchema)
    )
  })

  it("registers every block config in the server schema", () => {
    expect(Object.keys(paperSchema.blockSchema).sort()).toEqual(
      Object.keys(paperBlockConfigs).sort()
    )
  })

  it("materializes an empty letter and an empty CV", () => {
    expect(outline(snapshot(seedYDoc(cv([]))))).toEqual([])
  })

  it("keeps a materialized document a no-op to write", () => {
    const { live } = room(cv([para("p1", "line one"), ...SKILLS]))
    expect(writeDocument(live, snapshot(live), "coach:1")).toBeNull()
  })
})
