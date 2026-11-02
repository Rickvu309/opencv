import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  legacyPaperOf,
  mergeLegacyEdit,
  paperDocumentSchema,
  paperPlainText,
  plainTextOfRuns,
  richTextOf,
  upgradeStoredPaper,
  type CvPaper,
  type PaperDocument,
} from "./paper-doc/index.ts"

const link = "https://example.com"

function parsed(candidate: unknown): PaperDocument {
  return paperDocumentSchema.parse(candidate)
}

function item(id: string, text: string, children: unknown[] = []) {
  return { id, type: "bullet", content: [{ text }], children }
}

const richCv = parsed({
  version: 3,
  kind: "cv",
  clashes: [],
  header: {
    id: "header",
    type: "header",
    name: "Ada",
    email: "ada@example.com",
    phone: "1",
    city: "Hanoi",
    linkedin: "",
  },
  blocks: [
    { id: "s1", type: "section", kind: "summary", title: "Selected work" },
    {
      id: "p1",
      type: "paragraph",
      content: [
        { text: "Built ", bold: true },
        { text: "the site", href: link },
        { text: " fast" },
      ],
    },
    {
      id: "h1",
      type: "heading",
      level: 3,
      content: [{ text: "Details", italic: true }],
    },
    item("b1", "Parent", [
      item("b2", "Child one", [item("b3", "Grandchild")]),
      item("b4", "Child two"),
    ]),
    {
      id: "n1",
      type: "numbered",
      content: [{ text: "Numbered" }],
      children: [],
    },
    { id: "s2", type: "section", kind: "experience", title: "Work" },
    {
      id: "e1",
      type: "experience",
      role: "Lead",
      company: "Club",
      period: "2024",
      location: "",
      children: [item("e1a", "Ran it", [item("e1b", "Nested")])],
    },
    {
      id: "ed1",
      type: "education",
      school: "UIT",
      degree: "BSc",
      period: "2022",
      detail: "GPA",
      children: [item("ed1a", "Honours")],
    },
    { id: "s3", type: "section", kind: "skills", title: "Skills" },
    { id: "sk1", type: "skills", label: "Tools", items: ["Figma", "SQL, X"] },
    { id: "d1", type: "divider" },
  ],
}) as CvPaper

const richLetter = parsed({
  version: 3,
  kind: "letter",
  clashes: [],
  blocks: [
    {
      id: "a",
      type: "paragraph",
      content: [{ text: "Dear " }, { text: "team", bold: true }],
    },
    { id: "b", type: "heading", level: 2, content: [{ text: "Why me" }] },
    item("c", "First point", [item("d", "Sub point")]),
    { id: "e", type: "divider" },
    {
      id: "f",
      type: "paragraph",
      content: [{ text: "Thanks", href: link }],
    },
  ],
})

function fromStored(kind: "cv" | "letter", stored: unknown): PaperDocument {
  const result = upgradeStoredPaper(kind, stored)
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(result.message)
  return result.document
}

function seenBy(current: PaperDocument): PaperDocument {
  return fromStored(current.kind, legacyPaperOf(current))
}

const unchanged: [string, PaperDocument][] = [
  ["rich CV", richCv],
  ["rich letter", richLetter],
  [
    "letter from markdown",
    fromStored("letter", { markdown: "One\n\nTwo\n\nThree" }),
  ],
  [
    "CV from blocks",
    fromStored("cv", {
      version: 2,
      header: { name: "A", email: "", phone: "", city: "", linkedin: "" },
      sections: [
        {
          id: "s",
          kind: "experience",
          blocks: [
            { id: "t", type: "text", text: "Hello" },
            {
              id: "l",
              type: "bulleted-list",
              items: [
                { id: "i1", text: "x" },
                { id: "i2", text: "y" },
              ],
            },
          ],
        },
      ],
    }),
  ],
  [
    "CV with a block before the first section",
    parsed({
      ...richCv,
      blocks: [
        { id: "lead", type: "paragraph", content: [{ text: "Lead" }] },
        ...richCv.blocks,
      ],
    }),
  ],
]

function rename(paper: PaperDocument, id: string, text: string) {
  return {
    ...paper,
    blocks: paper.blocks.map((block) =>
      block.id === id && "content" in block
        ? { ...block, content: richTextOf(text) }
        : block
    ),
  } as PaperDocument
}

describe("merging an old-editor save onto the version 3 paper", () => {
  for (const [name, current] of unchanged) {
    it(`gives the paper back when nothing changed: ${name}`, () => {
      assert.deepEqual(mergeLegacyEdit(current, seenBy(current)), current)
    })
  }

  it("keeps marks, links, titles and levels when only the header changed", () => {
    const sent = seenBy(richCv) as CvPaper
    const merged = mergeLegacyEdit(richCv, {
      ...sent,
      header: { ...sent.header, name: "Ada L." },
    }) as CvPaper
    assert.equal(merged.header.name, "Ada L.")
    assert.deepEqual({ ...merged, header: richCv.header }, richCv)
  })

  it("rebases marks onto edited text by prefix and suffix", () => {
    const sent = rename(seenBy(richCv), "p1", "Built the website fast")
    const merged = mergeLegacyEdit(richCv, sent) as CvPaper
    const block = merged.blocks.find((entry) => entry.id === "p1")
    assert.ok(block && "content" in block)
    assert.deepEqual(block.content, [
      { text: "Built ", bold: true },
      { text: "the website", href: link },
      { text: " fast" },
    ])
  })

  it("takes the sent words for a changed block and drops deleted ones", () => {
    const sent = rename(seenBy(richCv), "p1", "Brand new words")
    const merged = mergeLegacyEdit(richCv, {
      ...sent,
      blocks: sent.blocks.filter((block) => block.id !== "sk1"),
    } as PaperDocument)
    const text = paperPlainText(merged)
    assert.ok(text.includes("Brand new words"))
    assert.ok(!text.includes("Built the site"))
    assert.ok(!text.includes("Figma"))
    for (const word of ["Parent", "Grandchild", "Honours", "Selected work"]) {
      assert.ok(text.includes(word), word)
    }
  })

  it("edits a list item in place and adds a new one at its predecessor's depth", () => {
    const base = seenBy(richCv) as CvPaper
    const blocks = base.blocks.flatMap((block) => {
      if (block.id === "b2")
        return [{ ...block, content: richTextOf("Child 1") }]
      if (block.id === "b3") {
        return [
          block,
          {
            ...block,
            id: "new",
            content: richTextOf("Added after grandchild"),
          },
        ]
      }
      return [block]
    })
    const merged = mergeLegacyEdit(richCv, {
      ...base,
      blocks,
    } as PaperDocument) as CvPaper
    const parent = merged.blocks.find((block) => block.id === "b1")
    assert.ok(parent && "children" in parent)
    const [child] = parent.children
    assert.equal(plainTextOfRuns(child!.content), "Child 1")
    assert.deepEqual(
      child!.children.map((entry) => plainTextOfRuns(entry.content)),
      ["Grandchild", "Added after grandchild"]
    )
    assert.equal(parent.children[1]!.id, "b4")
  })

  it("promotes the children of a deleted list item", () => {
    const base = seenBy(richCv) as CvPaper
    const merged = mergeLegacyEdit(richCv, {
      ...base,
      blocks: base.blocks.filter((block) => block.id !== "b2"),
    } as PaperDocument) as CvPaper
    const parent = merged.blocks.find((block) => block.id === "b1")
    assert.ok(parent && "children" in parent)
    assert.deepEqual(
      parent.children.map((entry) => entry.id),
      ["b3", "b4"]
    )
  })

  it("uses the sent order flat for a reordered list", () => {
    const base = seenBy(richCv) as CvPaper
    const ids = ["b4", "b1", "b2", "b3"]
    const listed = base.blocks.filter((block) => ids.includes(block.id))
    const merged = mergeLegacyEdit(richCv, {
      ...base,
      blocks: base.blocks.flatMap((block) =>
        block.id === "b1"
          ? ids.map((id) => listed.find((entry) => entry.id === id)!)
          : ids.includes(block.id)
            ? []
            : [block]
      ),
    } as PaperDocument) as CvPaper
    const order = merged.blocks
      .filter((block) => block.type === "bullet")
      .map((block) => block.id)
    assert.deepEqual(order, ["b4", "b1", "b2", "b3"])
    assert.ok(paperPlainText(merged).includes("Grandchild"))
  })

  it("edits a letter paragraph in place and keeps heading, list and divider", () => {
    const sent = rename(seenBy(richLetter), "l-1", "Dear all")
    const merged = mergeLegacyEdit(richLetter, sent)
    assert.deepEqual(
      merged.blocks.map((block) => [block.id, block.type]),
      [
        ["a", "paragraph"],
        ["b", "heading"],
        ["c", "bullet"],
        ["e", "divider"],
        ["f", "paragraph"],
      ]
    )
    const first = merged.blocks[0]
    assert.ok(first && "content" in first)
    assert.deepEqual(first.content, [{ text: "Dear all" }])
    assert.ok("content" in merged.blocks[4]!)
    assert.deepEqual((merged.blocks[4] as { content: unknown }).content, [
      { text: "Thanks", href: link },
    ])
  })

  it("adds and removes letter paragraphs", () => {
    const base = seenBy(richLetter)
    const [first, ...rest] = base.blocks
    const merged = mergeLegacyEdit(richLetter, {
      ...base,
      blocks: [
        first!,
        { id: "l-new", type: "paragraph", content: richTextOf("Inserted") },
        ...rest.filter(
          (block) =>
            block.type === "paragraph" &&
            "content" in block &&
            plainTextOfRuns(block.content) !== "Why me"
        ),
      ],
    } as PaperDocument)
    const text = paperPlainText(merged)
    assert.ok(text.includes("Inserted"))
    assert.ok(!text.includes("Why me"))
    assert.ok(text.includes("Thanks"))
  })

  it("never reuses an id a blank paragraph still holds in a letter", () => {
    const current = parsed({
      version: 3,
      kind: "letter",
      clashes: [],
      blocks: [
        { id: "l-1", type: "paragraph", content: [] },
        { id: "l-2", type: "paragraph", content: [{ text: "Body" }] },
      ],
    })
    const sent = fromStored("letter", { markdown: "New first\n\nBody" })
    const merged = mergeLegacyEdit(current, sent)
    assert.equal(paperDocumentSchema.safeParse(merged).success, true)
    assert.deepEqual(
      merged.blocks.map((block) => block.id).sort(),
      [...new Set(merged.blocks.map((block) => block.id))].sort()
    )
  })

  it("keeps ids unique when a paragraph moves past a blank one", () => {
    const current = parsed({
      version: 3,
      kind: "letter",
      clashes: [],
      blocks: [
        { id: "l-1", type: "paragraph", content: [] },
        { id: "l-2", type: "paragraph", content: [{ text: "alpha" }] },
        {
          id: "l-3",
          type: "heading",
          level: 2,
          content: [{ text: "alpha" }],
        },
        { id: "l-4", type: "paragraph", content: [{ text: "beta" }] },
      ],
    })
    const sent = fromStored("letter", { markdown: "beta\n\nalpha\n\nalpha" })
    const merged = mergeLegacyEdit(current, sent)
    assert.equal(paperDocumentSchema.safeParse(merged).success, true)
    assert.ok(paperPlainText(merged).startsWith("beta"))
  })

  it("keeps a leading section as a real section when it is not first", () => {
    const current = parsed({
      ...richCv,
      blocks: [
        { id: "p0", type: "paragraph", content: [{ text: "About me" }] },
        { id: "s1", type: "section", kind: "experience", title: "Work" },
      ],
    }) as CvPaper
    const sent = fromStored("cv", {
      version: 2,
      header: {
        name: "Ada",
        email: "ada@example.com",
        phone: "1",
        city: "Hanoi",
        linkedin: "",
      },
      sections: [
        { id: "s1", kind: "experience", blocks: [] },
        {
          id: "section-leading",
          kind: "summary",
          blocks: [{ id: "p0", type: "text", text: "About me" }],
        },
      ],
    })
    const merged = mergeLegacyEdit(current, sent) as CvPaper
    assert.deepEqual(
      merged.blocks.map((block) => [block.id, block.type]),
      [
        ["s1", "section"],
        ["section-leading", "section"],
        ["p0", "paragraph"],
      ]
    )
  })
})
