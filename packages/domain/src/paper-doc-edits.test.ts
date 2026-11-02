import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyPaperEdits,
  paperChanges,
  paperDocumentSchema,
  paperEditSchema,
  paperOutline,
  plainTextOfRuns,
  type PaperDocument,
  type PaperEdit,
} from "./paper-doc/index.ts"
import { changeHunks } from "./paper-diff.ts"

function parsed(candidate: unknown): PaperDocument {
  return paperDocumentSchema.parse(candidate)
}

const cv = parsed({
  version: 3,
  kind: "cv",
  clashes: [],
  header: {
    id: "header",
    type: "header",
    name: "Ada",
    email: "ada@example.com",
    phone: "",
    city: "London",
    linkedin: "",
  },
  blocks: [
    { id: "s1", type: "section", kind: "summary", title: "Profile" },
    { id: "p1", type: "paragraph", content: [{ text: "Engineer." }] },
    { id: "s2", type: "section", kind: "experience", title: "Work" },
    {
      id: "e1",
      type: "experience",
      role: "Analyst",
      company: "Babbage",
      period: "1842",
      location: "London",
      children: [
        {
          id: "b1",
          type: "bullet",
          content: [{ text: "Wrote ", bold: true }, { text: "code" }],
          children: [],
        },
      ],
    },
    {
      id: "e2",
      type: "experience",
      role: "Writer",
      company: "Royal",
      period: "1843",
      location: "",
      children: [],
    },
  ],
})

function ids() {
  let n = 0
  return () => `new${++n}`
}

function edit(raw: unknown): PaperEdit {
  return paperEditSchema.parse(raw)
}

function blockOf(doc: PaperDocument, id: string) {
  return doc.blocks.find((block) => block.id === id)
}

function withBlock(
  doc: PaperDocument,
  id: string,
  change: Record<string, unknown>
) {
  return parsed({
    ...doc,
    blocks: doc.blocks.map((block) =>
      block.id === id ? { ...block, ...change } : block
    ),
  })
}

function run(live: PaperDocument, edits: unknown[], base = cv) {
  return applyPaperEdits(base, live, edits.map(edit), ids())
}

describe("applyPaperEdits on an untouched document", () => {
  it("sets text, fields and the header", () => {
    const result = run(cv, [
      { op: "setText", blockId: "p1", text: "Engineer and **writer**." },
      { op: "setFields", blockId: "e1", fields: { role: "Lead" } },
      { op: "setHeader", fields: { phone: "123" } },
    ])
    assert.deepEqual(
      result.outcomes.map((outcome) => outcome.status),
      ["applied", "applied", "applied"]
    )
    const target = result.target
    assert.ok(target.kind === "cv")
    assert.equal(target.header.phone, "123")
    const paragraph = blockOf(target, "p1")
    assert.ok(paragraph && paragraph.type === "paragraph")
    assert.equal(plainTextOfRuns(paragraph.content), "Engineer and writer.")
    assert.equal(paragraph.content[1]?.bold, true)
    assert.equal(result.applied, 3)
  })

  it("inserts blocks with server ids, nested bullets and list items", () => {
    const result = run(cv, [
      {
        op: "insert",
        after: "e1",
        blocks: [
          {
            type: "experience",
            role: "Chief",
            company: "Co",
            bullets: [{ text: "Led", children: [{ text: "Deep" }] }],
          },
        ],
      },
      {
        op: "insertInto",
        into: "e2",
        blocks: [{ type: "bullet", text: "Hi" }],
      },
      {
        op: "insert",
        after: "@start",
        blocks: [{ type: "section", kind: "skills" }],
      },
    ])
    assert.deepEqual(
      result.outcomes.map((outcome) => outcome.status),
      ["applied", "applied", "applied"]
    )
    const order = result.target.blocks.map((block) => block.id)
    assert.equal(order[0]?.startsWith("new"), true)
    const created = result.outcomes[0]
    assert.ok(created?.status === "applied" && created.createdIds?.length === 1)
    const e2 = blockOf(result.target, "e2")
    assert.ok(e2 && e2.type === "experience" && e2.children.length === 1)
  })

  it("moves and removes blocks, including inside an experience", () => {
    const result = run(cv, [
      { op: "move", blockId: "e2", after: "s2" },
      { op: "remove", blockId: "b1" },
    ])
    assert.deepEqual(
      result.target.blocks.map((block) => block.id),
      ["s1", "p1", "s2", "e2", "e1"]
    )
    const e1 = blockOf(result.target, "e1")
    assert.ok(e1 && e1.type === "experience" && e1.children.length === 0)
  })

  it("refuses edits the document cannot hold, one by one", () => {
    const result = run(cv, [
      { op: "setText", blockId: "nope", text: "x" },
      { op: "setFields", blockId: "p1", fields: { role: "x" } },
      { op: "setText", blockId: "e1", text: "x" },
      { op: "remove", blockId: "header" },
      { op: "move", blockId: "s1", after: "s1" },
      {
        op: "insert",
        after: "p1",
        blocks: [{ type: "section", kind: "awards" }],
      },
      { op: "move", blockId: "p1", after: "b1" },
      { op: "insertInto", into: "p1", blocks: [{ type: "bullet", text: "x" }] },
    ])
    assert.deepEqual(
      result.outcomes.map((outcome) => outcome.status),
      [
        "invalid",
        "invalid",
        "invalid",
        "invalid",
        "invalid",
        "applied",
        "invalid",
        "invalid",
      ]
    )
    assert.equal(result.applied, 1)
  })

  it("keeps a letter to text blocks", () => {
    const letter = parsed({
      version: 3,
      kind: "letter",
      clashes: [],
      blocks: [{ id: "l1", type: "paragraph", content: [{ text: "Dear" }] }],
    })
    const result = applyPaperEdits(
      letter,
      letter,
      [
        edit({
          op: "insert",
          after: "l1",
          blocks: [{ type: "skills", items: ["a"] }],
        }),
        edit({ op: "setHeader", fields: { name: "x" } }),
        edit({
          op: "insert",
          after: "l1",
          blocks: [{ type: "heading", text: "Hi" }],
        }),
      ],
      ids()
    )
    assert.deepEqual(
      result.outcomes.map((outcome) => outcome.status),
      ["invalid", "invalid", "applied"]
    )
  })

  it("keeps list depth within three levels", () => {
    const deep = run(cv, [
      {
        op: "insertInto",
        into: "b1",
        blocks: [
          {
            type: "bullet",
            text: "two",
            children: [{ text: "three", children: [{ text: "four" }] }],
          },
        ],
      },
    ])
    assert.equal(deep.outcomes[0]?.status, "invalid")
  })
})

describe("applyPaperEdits freshness", () => {
  it("applies structure on untouched blocks when others changed", () => {
    const live = withBlock(cv, "p1", { content: [{ text: "Engineer!" }] })
    const result = run(live, [
      { op: "remove", blockId: "e2" },
      { op: "setFields", blockId: "e1", fields: { role: "Lead" } },
    ])
    assert.deepEqual(
      result.outcomes.map((outcome) => outcome.status),
      ["applied", "applied"]
    )
  })

  it("marks remove, move, setFields and setHeader stale after the person changed them", () => {
    const live = parsed({
      ...withBlock(withBlock(cv, "e1", { role: "Director" }), "e2", {
        children: [
          {
            id: "b9",
            type: "bullet",
            content: [{ text: "new" }],
            children: [],
          },
        ],
      }),
      header: { ...(cv.kind === "cv" ? cv.header : {}), city: "Paris" },
    })
    const result = run(live, [
      { op: "setFields", blockId: "e1", fields: { role: "Lead" } },
      { op: "setFields", blockId: "e1", fields: { company: "Other" } },
      { op: "remove", blockId: "e2" },
      { op: "move", blockId: "e2", after: "s1" },
      { op: "setHeader", fields: { city: "Rome" } },
      { op: "setHeader", fields: { phone: "9" } },
    ])
    assert.deepEqual(
      result.outcomes.map((outcome) => outcome.status),
      ["stale", "applied", "stale", "stale", "stale", "applied"]
    )
    const target = result.target
    assert.ok(target.kind === "cv")
    assert.equal(target.header.city, "London")
    assert.equal(target.header.phone, "9")
    const e2 = blockOf(target, "e2")
    assert.ok(e2 && e2.type === "experience" && e2.children.length === 0)
  })

  it("makes every op on a deleted block stale, and an insert after it", () => {
    const live = parsed({
      ...cv,
      blocks: cv.blocks.filter((block) => block.id !== "p1"),
    })
    const result = run(live, [
      { op: "setText", blockId: "p1", text: "x" },
      { op: "remove", blockId: "p1" },
      { op: "insert", after: "p1", blocks: [{ type: "paragraph", text: "y" }] },
      { op: "insert", after: "s1", blocks: [{ type: "paragraph", text: "z" }] },
    ])
    assert.deepEqual(
      result.outcomes.map((outcome) => outcome.status),
      ["stale", "stale", "stale", "applied"]
    )
  })

  it("lets setText through when the person is typing, and says so", () => {
    const live = withBlock(cv, "p1", { content: [{ text: "Engineer. Hello" }] })
    const result = run(live, [
      { op: "setText", blockId: "p1", text: "Senior engineer." },
    ])
    assert.deepEqual(result.outcomes[0], { status: "applied", merged: true })
    const paragraph = blockOf(result.target, "p1")
    assert.ok(paragraph && paragraph.type === "paragraph")
    assert.equal(plainTextOfRuns(paragraph.content), "Senior engineer.")
  })

  it("treats a block the person moved or turned into another type as changed", () => {
    const moved = parsed({
      ...cv,
      blocks: [cv.blocks[0], cv.blocks[2], cv.blocks[1], ...cv.blocks.slice(3)],
    })
    assert.equal(
      run(moved, [{ op: "setText", blockId: "p1", text: "x" }]).outcomes[0]
        ?.status,
      "stale"
    )
    const turned = parsed({
      ...cv,
      blocks: cv.blocks.map((block) =>
        block.id === "p1"
          ? {
              id: "p1",
              type: "heading",
              level: 2,
              content: [{ text: "Engineer." }],
            }
          : block
      ),
    })
    assert.equal(
      run(turned, [{ op: "setText", blockId: "p1", text: "x" }]).outcomes[0]
        ?.status,
      "stale"
    )
  })
})

describe("paperOutline", () => {
  it("shows ids, kinds, titles, levels, marks, links, nesting and the selection", () => {
    const rich = parsed({
      ...cv,
      blocks: [
        ...cv.blocks,
        {
          id: "h1",
          type: "heading",
          level: 3,
          content: [{ text: "Site", href: "https://example.com" }],
        },
      ],
    })
    const { text, truncated } = paperOutline(rich, {
      selected: ["b1"],
      maxChars: 4000,
    })
    assert.equal(truncated, false)
    assert.match(text, /\[header\] name: Ada/)
    assert.match(text, /\[s1\] # Profile \(section summary\)/)
    assert.match(text, /\[e1\] Experience: role: Analyst · company: Babbage/)
    assert.match(text, /^>> {3}\[b1\] - \*\*Wrote \*\*code$/m)
    assert.match(text, /\[h1\] ### \[Site\]\(https:\/\/example.com\)/)
  })

  it("stays within the bound and says what it left out", () => {
    const long = parsed({
      ...cv,
      blocks: Array.from({ length: 200 }, (_, i) => ({
        id: `p${i}`,
        type: "paragraph",
        content: [{ text: `Paragraph number ${i} `.repeat(6) }],
      })),
    })
    const { text, truncated, omitted } = paperOutline(long, { maxChars: 1500 })
    assert.equal(truncated, true)
    assert.ok(text.length <= 1500)
    assert.ok(omitted > 100)
    assert.match(text, /more blocks? left out/)
  })

  it("keeps a selected block even when the budget is spent", () => {
    const long = parsed({
      ...cv,
      blocks: Array.from({ length: 100 }, (_, i) => ({
        id: `p${i}`,
        type: "paragraph",
        content: [{ text: `Paragraph ${i} `.repeat(8) }],
      })),
    })
    const { text } = paperOutline(long, { selected: ["p99"], maxChars: 1200 })
    assert.match(text, /^>> \[p99\]/m)
  })
})

describe("paperChanges", () => {
  it("reports added, changed, moved and removed blocks by id", () => {
    const result = run(cv, [
      { op: "setText", blockId: "p1", text: "Different." },
      { op: "remove", blockId: "b1" },
      { op: "move", blockId: "e2", after: "s2" },
      {
        op: "insert",
        after: "p1",
        blocks: [{ type: "paragraph", text: "More" }],
      },
    ])
    const changes = paperChanges(cv, result.target)
    const byKind = Object.fromEntries(
      changes.map((change) => [change.blockId, change.change])
    )
    assert.equal(byKind.p1, "changed")
    assert.equal(byKind.b1, "removed")
    assert.deepEqual([byKind.e1, byKind.e2].sort(), ["moved", undefined])
    assert.equal(byKind.new1, "added")
    assert.equal(changes.length, 4)
    const hunks = changeHunks(changes)
    assert.equal(hunks.length, 4)
    assert.deepEqual(
      hunks
        .find((hunk) => hunk.sectionId === "p1")
        ?.lines.map((line) => line.kind),
      ["del", "add"]
    )
  })
})
