import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cvBlockDocumentSchema,
  cvCodecToBlocks,
  type CvBlockDocument,
} from "./paper-blocks/index.ts"
import {
  letterDocumentV1Schema,
  withoutBlankParts,
  type CvDocument,
} from "./paper-codecs.ts"
import {
  blankCv,
  blankLetter,
  legacyPaperOf,
  paperPlainText,
  plainTextOfRuns,
  richTextOf,
  upgradeStoredPaper,
  type PaperDocument,
} from "./paper-doc/index.ts"

const header = {
  name: "Lan Nguyen",
  email: "lan@example.com",
  phone: "+84 912 345 678",
  city: "Hanoi",
  linkedin: "linkedin.com/in/lan",
}

const fullCv: CvBlockDocument = {
  version: 2,
  header,
  sections: [
    {
      id: "s-summary",
      kind: "summary",
      blocks: [
        { id: "t1", type: "text", text: "Ships small experiments." },
        { id: "h1", type: "heading", text: "Highlights" },
        { id: "d1", type: "divider" },
        {
          id: "l1",
          type: "bulleted-list",
          items: [
            { id: "i1", text: "Ran interviews" },
            { id: "i2", text: "Wrote the PRD" },
          ],
        },
        {
          id: "l2",
          type: "numbered-list",
          items: [{ id: "n1", text: "First" }],
        },
      ],
    },
    {
      id: "s-exp",
      kind: "experience",
      blocks: [
        {
          id: "e1",
          type: "experience-entry",
          role: "Discovery lead",
          company: "UIT Product Club",
          period: "2024 – Present",
          location: "Hanoi",
          bullets: [
            { id: "b1", text: "Ran interviews" },
            { id: "b2", text: "Wrote the PRD" },
          ],
        },
        {
          id: "e2",
          type: "experience-entry",
          role: "Side project",
          company: "Personal",
          period: "2025",
          bullets: [],
        },
      ],
    },
    {
      id: "s-edu",
      kind: "education",
      blocks: [
        {
          id: "ed1",
          type: "education-entry",
          school: "UIT",
          degree: "BSc",
          period: "2022 – 2026",
          detail: "GPA 3.8",
        },
      ],
    },
    {
      id: "s-skills",
      kind: "skills",
      blocks: [
        {
          id: "sk1",
          type: "skills-group",
          label: "Tools",
          items: ["Figma", "SQL, Postgres", "A · B"],
        },
      ],
    },
  ],
}

const sparseCv: CvBlockDocument = {
  version: 2,
  header: { name: "", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    { id: "section-experience", kind: "experience", blocks: [] },
    { id: "section-education", kind: "education", blocks: [] },
    { id: "section-skills", kind: "skills", blocks: [] },
  ],
}

const photoCv: CvBlockDocument = {
  ...fullCv,
  header: {
    ...header,
    photo: "paper-photo:11111111-1111-4111-8111-111111111111",
  },
}

const listsOnlyCv: CvBlockDocument = {
  version: 2,
  header,
  sections: [
    {
      id: "s1",
      kind: "projects",
      blocks: [
        {
          id: "la",
          type: "bulleted-list",
          items: [{ id: "x1", text: "One" }],
        },
        {
          id: "lb",
          type: "bulleted-list",
          items: [
            { id: "x2", text: "Two" },
            { id: "x3", text: "Three" },
          ],
        },
        { id: "emptylist", type: "numbered-list", items: [] },
      ],
    },
  ],
}

const v2Fixtures: [string, CvBlockDocument][] = [
  ["full", fullCv],
  ["sparse", sparseCv],
  ["photo", photoCv],
  ["lists only", listsOnlyCv],
]

const exactWithoutWitness: [string, CvBlockDocument][] = [
  ["sparse", sparseCv],
  [
    "no lists",
    {
      ...fullCv,
      sections: fullCv.sections.map((section) => ({
        ...section,
        blocks: section.blocks.filter(
          (block) =>
            block.type !== "bulleted-list" && block.type !== "numbered-list"
        ),
      })),
    },
  ],
]

const v1Cv: CvDocument = {
  templateId: "internship",
  name: "Lan Nguyen",
  headline: "Product intern",
  contact: { email: "lan@example.com", phone: "123", location: "Hanoi" },
  summary: "Ships small experiments.",
  experience: [
    { role: "Lead", company: "Club", period: "2024", bullets: ["Ran it"] },
  ],
  education: [{ school: "UIT", degree: "BSc", period: "2022" }],
  skills: [{ label: "Tools", items: ["Figma", "SQL, Postgres"] }],
  projects: [{ name: "Tool", detail: "A small tool" }],
  languages: ["English", "Vietnamese"],
} as CvDocument

const letters: [string, { markdown: string } & Record<string, string>][] = [
  ["empty", { markdown: "" }],
  ["one paragraph", { markdown: "Dear team," }],
  ["paragraphs", { markdown: "Dear team,\n\nI am writing.\n\nThanks." }],
  ["single newlines kept", { markdown: "Line one\nLine two\n\nNext" }],
  [
    "with parts",
    {
      markdown: "I am writing about the role.",
      sender: "Linh Nguyen",
      contact: "linh@example.com",
      date: "2 Nov 2026",
      recipient: "Hiring team",
      salutation: "Dear team,",
      closing: "Best,",
      signature: "Linh",
    },
  ],
  ["markdown looking text", { markdown: "# Not a heading\n\n- not a list" }],
]

function upgraded(kind: "cv" | "letter", stored: unknown): PaperDocument {
  const result = upgradeStoredPaper(kind, stored)
  assert.equal(result.ok, true)
  return result.ok ? result.document : blankCv()
}

describe("legacy projection of a version 3 paper", () => {
  for (const [name, fixture] of v2Fixtures) {
    it(`gives a stored CV back exactly: ${name}`, () => {
      const stored = cvBlockDocumentSchema.parse(fixture)
      assert.deepEqual(legacyPaperOf(upgraded("cv", stored), stored), stored)
    })

    it(`keeps every word and block without a witness: ${name}`, () => {
      const paper = upgraded("cv", fixture)
      const projected = legacyPaperOf(paper)
      assert.equal(cvBlockDocumentSchema.safeParse(projected).success, true)
      assert.deepEqual(upgraded("cv", projected), paper)
    })
  }

  for (const [name, fixture] of exactWithoutWitness) {
    it(`gives the same CV without a witness: ${name}`, () => {
      assert.deepEqual(legacyPaperOf(upgraded("cv", fixture)), fixture)
    })
  }

  it("turns a version 1 CV into a version 2 CV with the same words", () => {
    const paper = upgraded("cv", v1Cv)
    const projected = legacyPaperOf(paper, v1Cv)
    assert.equal((projected as CvBlockDocument).version, 2)
    assert.deepEqual(upgraded("cv", projected), paper)
    assert.equal(
      paperPlainText(upgraded("cv", projected)),
      paperPlainText(paper)
    )
    assert.equal(
      paperPlainText(upgraded("cv", projected)),
      paperPlainText(upgraded("cv", cvCodecToBlocks(v1Cv)))
    )
  })

  for (const [name, fixture] of letters) {
    it(`gives a stored letter back exactly: ${name}`, () => {
      const stored = withoutBlankParts(letterDocumentV1Schema.parse(fixture))
      assert.deepEqual(
        legacyPaperOf(upgraded("letter", stored), stored),
        stored
      )
    })

    it(`keeps every word of a letter without a witness: ${name}`, () => {
      const paper = upgraded("letter", fixture)
      const projected = legacyPaperOf(paper)
      assert.deepEqual(Object.keys(projected), ["markdown"])
      assert.deepEqual(upgraded("letter", projected), paper)
    })
  }

  it("projects a blank letter and a blank CV", () => {
    assert.deepEqual(legacyPaperOf(blankLetter()), { markdown: "" })
    assert.equal((legacyPaperOf(blankCv()) as CvBlockDocument).version, 2)
  })

  it("flattens lists, headings and marks of a letter into plain paragraphs", () => {
    const paper = upgraded("letter", { markdown: "Dear team,\n\nBody" })
    assert.equal(paper.kind, "letter")
    if (paper.kind !== "letter") return
    const edited: PaperDocument = {
      ...paper,
      blocks: [
        {
          id: "a",
          type: "heading",
          level: 2,
          content: [{ text: "Title", bold: true }],
        },
        {
          id: "b",
          type: "bullet",
          content: [
            { text: "see ", italic: true },
            { text: "site", href: "https://example.com" },
          ],
          children: [
            {
              id: "c",
              type: "bullet",
              content: [{ text: "nested" }],
              children: [],
            },
          ],
        },
        { id: "d", type: "divider" },
        { id: "e", type: "paragraph", content: [{ text: "End" }] },
      ],
    } as PaperDocument
    assert.deepEqual(legacyPaperOf(edited), {
      markdown: "Title\n\nsee site\n\nnested\n\nEnd",
    })
  })

  it("keeps the letter parts when only the body is edited", () => {
    const stored = {
      markdown: "Body one.\n\nBody two.",
      sender: "Linh",
      date: "2 Nov 2026",
      salutation: "Dear team,",
      closing: "Best,",
      signature: "Linh",
    }
    const paper = upgraded("letter", stored)
    const edited = {
      ...paper,
      blocks: paper.blocks.map((block) =>
        "content" in block && plainTextOfRuns(block.content) === "Body two."
          ? { ...block, content: richTextOf("Body two, edited.") }
          : block
      ),
    } as PaperDocument
    assert.deepEqual(legacyPaperOf(edited, stored), {
      ...stored,
      markdown: "Body one.\n\nBody two, edited.",
    })
  })

  it("ignores a witness that is not this paper", () => {
    const paper = upgraded("cv", fullCv)
    assert.deepEqual(legacyPaperOf(paper, sparseCv), legacyPaperOf(paper))
    assert.deepEqual(
      legacyPaperOf(paper, { nonsense: true }),
      legacyPaperOf(paper)
    )
  })
})
