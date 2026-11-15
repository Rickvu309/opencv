import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cvSlots,
  nativeCvDocumentSchema,
  projectCvDocument,
  resolveCvField,
} from "./paper-doc/index.ts"

function owner(id: string, type: keyof typeof cvSlots) {
  return {
    id,
    type,
    ...(type === "section" ? { kind: "skills" } : {}),
    children: cvSlots[type].map((fieldKey) => ({
      id: `${id}-${fieldKey}`,
      type: "cvField",
      ownerId: id,
      fieldKey,
      content: [{ text: "Duplicate", underline: true }],
    })),
  }
}
function item(id: string) {
  return {
    id: `${id}-field`,
    itemId: id,
    ownerId: "skills",
    type: "cvField",
    fieldKey: "item",
    content: [{ text: "same" }],
  }
}
function document() {
  return nativeCvDocumentSchema.parse({
    version: 4,
    schemaRevision: 2,
    kind: "cv",
    header: owner("h", "header"),
    blocks: [
      { id: "lead", type: "paragraph", content: [{ text: "Leading prose" }] },
      owner("s1", "section"),
      owner("s2", "section"),
      {
        ...owner("skills", "skills"),
        children: [
          ...owner("skills", "skills").children,
          item("i1"),
          item("i2"),
        ],
      },
      {
        id: "mixed",
        type: "bullet",
        content: [],
        children: [
          {
            id: "nested",
            type: "numbered",
            content: [{ text: "Nested" }],
            children: [],
          },
        ],
      },
      { id: "heading", type: "heading", level: 3, content: [] },
      { id: "divider", type: "divider" },
      owner("s3", "section"),
    ],
  })
}

describe("ordered transient CV projection", () => {
  it("preserves repeated kinds, duplicate titles, empty sections, rich identities and leading prose", () => {
    const doc = document()
    const projection = projectCvDocument(doc)
    assert.deepEqual(projection.header, doc.header)
    assert.deepEqual(projection.leadingBody, doc.blocks.slice(0, 1))
    assert.deepEqual(
      projection.sections.map((section) => section.id),
      ["s1", "s2", "s3"]
    )
    assert.deepEqual(
      projection.sections.map((section) => section.children.length),
      [0, 4, 0]
    )
    assert.deepEqual(projection.sections[1]?.children, doc.blocks.slice(3, 7))
    assert.deepEqual(projection.sections[0]?.title.content, [
      { text: "Duplicate", underline: true },
    ])
  })
  it("resolves skill items by the complete owner, field, key and item tuple", () => {
    const doc = document()
    const skills = doc.blocks[3]
    if (!skills || skills.type !== "skills") throw new Error("Missing skills")
    const item = skills.children[1]
    const other = skills.children[2]
    if (item?.type !== "cvField" || other?.type !== "cvField")
      throw new Error("Missing items")
    const target = {
      ownerId: skills.id,
      fieldId: item.id,
      fieldKey: item.fieldKey,
      itemId: item.itemId,
    }
    assert.deepEqual(resolveCvField(doc, target), item)
    for (const mismatch of [
      { ...target, ownerId: doc.header.id },
      { ...target, fieldId: other.id },
      { ...target, fieldKey: "label" as const },
      { ...target, itemId: other.itemId },
      { ...target, itemId: undefined },
    ])
      assert.throws(() => resolveCvField(doc, mismatch))
  })
  it("keeps duplicate skill item identities through reorder and refuses all identity collisions", () => {
    const doc = document()
    const skills = doc.blocks[3]
    if (!skills || skills.type !== "skills") throw new Error("Missing skills")
    skills.children = [
      skills.children[0],
      skills.children[2],
      skills.children[1],
    ].filter((item) => item !== undefined)
    const projection = projectCvDocument(doc)
    assert.deepEqual(projection.sections[1]?.children[0], skills)
    for (const id of [
      "h",
      "skills-label",
      "i1",
      "i1-field",
      "nested",
      "s1-title",
    ]) {
      const bad = {
        ...doc,
        blocks: [...doc.blocks, { id, type: "paragraph", content: [] }],
      }
      assert.equal(nativeCvDocumentSchema.safeParse(bad).success, false)
    }
    assert.equal(
      nativeCvDocumentSchema.safeParse({
        ...doc,
        blocks: [
          owner("section", "section"),
          { ...skills, children: [...skills.children, item("i1")] },
        ],
      }).success,
      false
    )
  })
})
