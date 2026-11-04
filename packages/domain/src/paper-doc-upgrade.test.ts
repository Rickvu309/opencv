import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cvPrintModel,
  emptyCvDocument,
  letterPrintModel,
  paperDocumentSchema,
  paperPlainText,
  plainTextOfRuns,
  richTextOf,
  upgradeStoredPaper,
  type CvDocument,
  type CvPaper,
  type LetterPaper,
} from "./paper-doc/index.ts"

type LooseBlock = {
  id?: string
  type: string
  text?: string
  items?: { id?: string; text?: string }[] | string[]
  role?: string
  company?: string
  period?: string
  location?: string
  bullets?: { id?: string; text: string }[]
  school?: string
  degree?: string
  detail?: string
  label?: string
}

type CvBlockDocument = {
  version: 2
  header: {
    name: string
    email: string
    phone: string
    city: string
    linkedin: string
    photo?: string
  }
  sections: {
    id: string
    kind:
      | "summary"
      | "experience"
      | "education"
      | "skills"
      | "projects"
      | "activities"
      | "awards"
      | "languages"
    blocks: LooseBlock[]
  }[]
}

function blankBlockDocument(): CvBlockDocument {
  return {
    version: 2,
    header: { name: "", email: "", phone: "", city: "", linkedin: "" },
    sections: [
      { id: "section-experience", kind: "experience", blocks: [] },
      { id: "section-education", kind: "education", blocks: [] },
      { id: "section-skills", kind: "skills", blocks: [] },
    ],
  }
}

function makeIds() {
  let n = 0
  return () => {
    n += 1
    return `cv-${n}`
  }
}

function cvCodecToBlocks(document: CvDocument): CvBlockDocument {
  const id = makeIds()
  const sections: CvBlockDocument["sections"] = []
  const summaryBlocks: LooseBlock[] = []
  if (document.headline.trim()) {
    summaryBlocks.push({ id: id(), type: "heading", text: document.headline })
  }
  if (document.summary.trim() && document.summary !== document.headline) {
    summaryBlocks.push({ id: id(), type: "text", text: document.summary })
  }
  if (summaryBlocks.length > 0) {
    sections.push({ id: id(), kind: "summary", blocks: summaryBlocks })
  }
  if (document.experience.length > 0) {
    sections.push({
      id: id(),
      kind: "experience",
      blocks: document.experience.map((role) => ({
        id: id(),
        type: "experience-entry",
        role: role.role,
        company: role.company,
        period: role.period,
        ...(role.location ? { location: role.location } : {}),
        bullets: role.bullets.map((text) => ({ id: id(), text })),
      })),
    })
  }
  if (document.education.length > 0) {
    sections.push({
      id: id(),
      kind: "education",
      blocks: document.education.map((school) => ({
        id: id(),
        type: "education-entry",
        school: school.school,
        degree: school.degree,
        period: school.period,
        detail: school.detail ?? "",
      })),
    })
  }
  if (document.skills.length > 0) {
    sections.push({
      id: id(),
      kind: "skills",
      blocks: [
        {
          id: id(),
          type: "skills-group",
          label: document.skills[0]?.label ?? "",
          items: document.skills.flatMap((group) => group.items),
        },
      ],
    })
  }
  const projects = document.projects ?? []
  if (projects.length > 0) {
    const blocks: LooseBlock[] = []
    for (const project of projects) {
      blocks.push({ id: id(), type: "heading", text: project.name })
      blocks.push({ id: id(), type: "text", text: project.detail })
    }
    sections.push({ id: id(), kind: "projects", blocks })
  }
  const languages = document.languages ?? []
  if (languages.length > 0) {
    sections.push({
      id: id(),
      kind: "languages",
      blocks: [{ id: id(), type: "text", text: languages.join(", ") }],
    })
  }
  const header: CvBlockDocument["header"] = {
    name: document.name,
    email: document.contact.email,
    phone: document.contact.phone,
    city: document.contact.location,
    linkedin: document.contact.linkedin ?? "",
  }
  if (document.photoUrl) header.photo = document.photoUrl
  return { version: 2, header, sections }
}

function textOfItem(item: { text?: string } | string) {
  return typeof item === "string" ? item : (item.text ?? "")
}

function plainTextOf(block: LooseBlock): string {
  if (block.type === "text" || block.type === "heading") return block.text ?? ""
  if (block.type === "bulleted-list" || block.type === "numbered-list") {
    return (block.items ?? []).map(textOfItem).join("\n")
  }
  if (block.type === "divider") return ""
  if (block.type === "experience-entry") {
    return [
      block.role ?? "",
      block.company ?? "",
      block.period ?? "",
      block.location ?? "",
      ...(block.bullets ?? []).map((bullet) => bullet.text),
    ]
      .filter((part) => part.length > 0)
      .join("\n")
  }
  if (block.type === "education-entry") {
    return [block.school, block.degree, block.period, block.detail]
      .filter((part): part is string => !!part && part.length > 0)
      .join("\n")
  }
  if (block.type === "skills-group") {
    return [block.label ?? "", ...(block.items ?? []).map(textOfItem)]
      .filter((part) => part.length > 0)
      .join("\n")
  }
  return ""
}

const SECTION_TITLES = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  activities: "Activities",
  awards: "Awards",
  languages: "Languages",
}

const lanCv: CvDocument = {
  templateId: "internship",
  name: "Lan Nguyen",
  headline: "Product intern",
  contact: {
    email: "lan@example.com",
    phone: "+84 912 345 678",
    location: "Hanoi",
    linkedin: "linkedin.com/in/lan",
  },
  summary: "Ships small experiments.",
  experience: [
    {
      role: "Discovery lead",
      company: "UIT Product Club",
      period: "2024 – Present",
      bullets: ["Ran interviews", "Wrote the PRD"],
    },
    {
      role: "Side project",
      company: "Personal",
      period: "2025",
      location: "Remote",
      bullets: [],
    },
  ],
  education: [
    {
      school: "UIT",
      degree: "B.Sc. Information Systems",
      period: "2022 – 2026",
      detail: "HCI",
    },
    { school: "Hanoi High", degree: "Diploma", period: "2019" },
  ],
  skills: [
    { label: "Product", items: ["Interviews", "PRDs"] },
    { label: "Tools", items: ["Figma", "SQL basics"] },
  ],
  projects: [
    { name: "Wallet audit", detail: "Mapped friction" },
    { name: "Card study", detail: "Measured scan time\nand tap accuracy" },
  ],
  languages: ["Vietnamese", "English"],
  photoUrl: "file:6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11",
}

const starterCv: CvDocument = {
  templateId: "internship",
  name: "",
  headline: "Early-career product intern",
  contact: { email: "", phone: "", location: "Ho Chi Minh City, Vietnam" },
  summary:
    "Year-4 Information Systems student targeting associate product manager internships.",
  experience: [
    {
      role: "Product discovery lead",
      company: "Campus product club",
      period: "2024 – Present",
      location: "Volunteer",
      bullets: ["Ran weekly problem interviews with 8 classmates."],
    },
  ],
  education: [
    {
      school: "University of Information Technology (UIT)",
      degree: "B.Sc. Information Systems",
      period: "2022 – 2026",
      detail: "Relevant: systems analysis, databases, HCI",
    },
  ],
  skills: [
    { label: "Languages", items: ["Vietnamese (native)", "English (fluent)"] },
  ],
}

const everyBlockV2: CvBlockDocument = {
  version: 2,
  header: {
    name: "Mai Tran",
    email: "mai@example.com",
    phone: "",
    city: "Da Nang",
    linkedin: "",
  },
  sections: [
    {
      id: "sec-summary",
      kind: "summary",
      blocks: [
        { id: "t1", type: "heading", text: "Designer" },
        {
          id: "t2",
          type: "text",
          text: "Likes **plain** text with * and [brackets]",
        },
        { id: "t3", type: "text", text: "" },
        { id: "t4", type: "divider" },
        {
          id: "l1",
          type: "bulleted-list",
          items: [
            { id: "l1a", text: "one" },
            { id: "l1b", text: "" },
          ],
        },
        { id: "l2", type: "bulleted-list", items: [] },
        {
          id: "l3",
          type: "bulleted-list",
          items: [{ id: "l3a", text: "two" }],
        },
        {
          id: "n1",
          type: "numbered-list",
          items: [{ id: "n1a", text: "first" }],
        },
      ],
    },
    {
      id: "sec-exp",
      kind: "experience",
      blocks: [
        {
          id: "x1",
          type: "experience-entry",
          role: "Designer",
          company: "Studio",
          period: "2023",
          location: "Remote",
          bullets: [{ id: "x1a", text: "Shipped a system" }],
        },
        { id: "x2", type: "text", text: "Loose line under the entry" },
        {
          id: "x3",
          type: "bulleted-list",
          items: [{ id: "x3a", text: "Loose bullet" }],
        },
      ],
    },
    {
      id: "sec-edu",
      kind: "education",
      blocks: [
        {
          id: "e1",
          type: "education-entry",
          school: "Uni",
          degree: "BA",
          period: "2020",
          detail: "",
        },
      ],
    },
    {
      id: "sec-skills",
      kind: "skills",
      blocks: [
        {
          id: "k1",
          type: "skills-group",
          label: "Tools",
          items: ["Figma", "Miro"],
        },
        { id: "k2", type: "text", text: "Loose, skills, line" },
      ],
    },
    {
      id: "sec-projects",
      kind: "projects",
      blocks: [
        { id: "p1", type: "heading", text: "Audit" },
        { id: "p2", type: "text", text: "Found friction" },
        { id: "p3", type: "text", text: "Solo\nwith detail" },
        {
          id: "p4",
          type: "bulleted-list",
          items: [{ id: "p4a", text: "extra" }],
        },
      ],
    },
    {
      id: "sec-activities",
      kind: "activities",
      blocks: [
        { id: "a1", type: "text", text: "Club lead" },
        {
          id: "a2",
          type: "experience-entry",
          role: "Mentor",
          company: "NGO",
          period: "2022",
          bullets: [],
        },
      ],
    },
    {
      id: "sec-awards",
      kind: "awards",
      blocks: [{ id: "w1", type: "text", text: "Dean's list" }],
    },
    {
      id: "sec-lang",
      kind: "languages",
      blocks: [{ id: "g1", type: "text", text: "Vietnamese, English" }],
    },
  ],
}

const oddIdsV2: CvBlockDocument = {
  version: 2,
  header: { name: "Odd", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    {
      id: "header",
      kind: "summary",
      blocks: [
        { id: "a.b c", type: "text", text: "dotted id" },
        { id: "a.b c", type: "text", text: "same id again" },
        { id: "x".repeat(90), type: "text", text: "long id" },
      ],
    },
  ],
}

const commaSkillsV2: CvBlockDocument = {
  ...blankBlockDocument(),
  sections: [
    {
      id: "s",
      kind: "skills",
      blocks: [
        {
          id: "k",
          type: "skills-group",
          label: "Tools",
          items: ["Figma, Miro", " SQL ", ""],
        },
      ],
    },
  ],
}

const v1Fixtures: [string, CvDocument][] = [
  ["Lan", lanCv],
  ["starter", starterCv],
  ["blank", emptyCvDocument()],
  ["only a name", { ...emptyCvDocument(), name: "Solo" }],
]

const v2Fixtures: [string, CvBlockDocument][] = [
  ["every block type", everyBlockV2],
  ["blank", blankBlockDocument()],
  ...v1Fixtures.map(([name, cv]): [string, CvBlockDocument] => [
    `Lan-style ${name} through the v1 codec`,
    cvCodecToBlocks(cv),
  ]),
]

function linesOf(text: string): string[] {
  return text.split("\n").filter((line) => line.length > 0)
}

function oldPlainLines(document: CvBlockDocument): string[] {
  const { header } = document
  return [
    ...[header.name, header.email, header.phone, header.city, header.linkedin],
    ...document.sections.flatMap((section) => [
      SECTION_TITLES[section.kind],
      ...section.blocks.map(plainTextOf),
    ]),
  ].flatMap(linesOf)
}

function upgraded(kind: "cv" | "letter", stored: unknown) {
  const result = upgradeStoredPaper(kind, stored)
  assert.equal(result.ok, true, JSON.stringify(result))
  if (!result.ok) throw new Error(result.message)
  return result
}

describe("upgrade of a stored CV", () => {
  for (const [name, fixture] of v2Fixtures) {
    it(`v2 ${name}: schema, plain text and print model survive`, () => {
      const { document, from } = upgraded("cv", fixture)
      assert.equal(from, "cv-v2")
      assert.equal(paperDocumentSchema.safeParse(document).success, true)
      assert.deepEqual(
        linesOf(paperPlainText(document)),
        oldPlainLines(fixture)
      )
      const printed = cvPrintModel(document as CvPaper, "product")
      assert.equal(printed.name, fixture.header.name)
      assert.equal(printed.contact.email, fixture.header.email)
      assert.equal(printed.templateId, "product")
    })
  }

  for (const [name, fixture] of v1Fixtures) {
    it(`v1 ${name}: prints what the v1 document prints today`, () => {
      const { document, from } = upgraded("cv", fixture)
      assert.equal(from, "cv-v1")
      assert.equal(paperDocumentSchema.safeParse(document).success, true)
      const printed = cvPrintModel(document as CvPaper, fixture.templateId)
      if (name === "blank") {
        assert.equal(printed.name, "")
        return
      }
      assert.deepEqual(printed, {
        ...fixture,
        projects: fixture.projects ?? [],
        languages: fixture.languages ?? [],
        activities: [],
        awards: [],
      })
    })
  }

  it("keeps v2 block, item and section ids", () => {
    const { document } = upgraded("cv", everyBlockV2)
    if (document.kind !== "cv") throw new Error("expected a cv")
    const ids = JSON.stringify(document.blocks)
    for (const kept of [
      "sec-summary",
      "t1",
      "l1a",
      "l3a",
      "n1a",
      "x1",
      "x1a",
      "k1",
      "e1",
      "sec-lang",
    ]) {
      assert.ok(ids.includes(`"${kept}"`), kept)
    }
  })

  it("allocates valid unique ids when the stored ones are not", () => {
    const { document } = upgraded("cv", oddIdsV2)
    const ids = JSON.stringify(document).match(/"id":"[^"]*"/g) ?? []
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(ids.includes('"id":"header"'))
    assert.ok(ids.includes('"id":"header-2"'))
    assert.ok(ids.includes('"id":"a_b_c"'))
    assert.ok(ids.includes('"id":"a_b_c-2"'))
  })

  it("keeps skill items whole, commas and spaces included, and drops only empty ones", () => {
    const { document } = upgraded("cv", commaSkillsV2)
    if (document.kind !== "cv") throw new Error("expected a cv")
    const skills = document.blocks.find((block) => block.type === "skills")
    assert.deepEqual(skills?.type === "skills" && skills.items, [
      "Figma, Miro",
      " SQL ",
    ])
  })

  it("is deterministic and idempotent for every fixture", () => {
    for (const [, fixture] of [
      ...v1Fixtures,
      ...v2Fixtures,
      ["odd", oddIdsV2],
    ] as [string, unknown][]) {
      const first = upgraded("cv", fixture)
      const second = upgraded("cv", fixture)
      assert.equal(
        JSON.stringify(first.document),
        JSON.stringify(second.document)
      )
      const again = upgraded("cv", first.document)
      assert.equal(again.from, "cv-v3")
      assert.deepEqual(again.document, first.document)
    }
  })

  it("keeps every section of a kind in the print model", () => {
    const twice: CvBlockDocument = {
      ...blankBlockDocument(),
      sections: ["First", "Second"].map((role, index) => ({
        id: `s${index}`,
        kind: "experience" as const,
        blocks: [
          {
            id: `x${index}`,
            type: "experience-entry" as const,
            role,
            company: "Co",
            period: "2024",
            bullets: [],
          },
        ],
      })),
    }
    const { document } = upgraded("cv", twice)
    assert.deepEqual(
      cvPrintModel(document as CvPaper).experience.map((row) => row.role),
      ["First", "Second"]
    )
  })

  it("refuses what it cannot read, with a reason", () => {
    const unknownShape = upgradeStoredPaper("cv", { hello: "world" })
    assert.deepEqual(
      unknownShape.ok === false && unknownShape.reason,
      "unrecognized"
    )
    const letterInCv = upgradeStoredPaper(
      "cv",
      upgraded("letter", { markdown: "Hi" }).document
    )
    assert.deepEqual(letterInCv.ok === false && letterInCv.reason, "wrong-kind")
    const cvInLetter = upgradeStoredPaper(
      "letter",
      upgraded("cv", lanCv).document
    )
    assert.deepEqual(cvInLetter.ok === false && cvInLetter.reason, "wrong-kind")
    const broken = upgradeStoredPaper("letter", {
      version: 3,
      kind: "letter",
      blocks: [{}],
      clashes: [],
    })
    assert.deepEqual(broken.ok === false && broken.reason, "invalid")
    assert.equal(upgradeStoredPaper("cv", null).ok, false)
  })
})

const letterFixtures: [string, string][] = [
  ["paragraphs", "Dear team,\n\nI am writing to apply.\n\nBest,\nLan"],
  ["crlf and blank runs", "Dear team,\r\n\r\n\r\nHello.\r\n\n\n"],
  ["soft wrapped paragraph", "line one\nline two\n\nnext"],
  ["empty", ""],
]

describe("upgrade of a stored letter", () => {
  for (const [name, markdown] of letterFixtures) {
    it(`${name}: plain paragraphs, idempotent and deterministic`, () => {
      const { document, from } = upgraded("letter", { markdown })
      assert.equal(from, "letter-markdown")
      assert.equal(paperDocumentSchema.safeParse(document).success, true)
      const again = upgraded("letter", document)
      assert.deepEqual(again.document, document)
      assert.equal(
        JSON.stringify(upgraded("letter", { markdown }).document),
        JSON.stringify(document)
      )
    })
  }

  it("keeps single newlines inside a paragraph and splits on blank lines", () => {
    const { document } = upgraded("letter", {
      markdown: "line one\nline two\n\n\nnext",
    })
    assert.deepEqual(
      (document as LetterPaper).blocks.map(
        (block) => block.type === "paragraph" && plainTextOfRuns(block.content)
      ),
      ["line one\nline two", "next"]
    )
  })

  it("folds the letter parts around the body so no word is lost", () => {
    const { document } = upgraded("letter", {
      markdown: "Body line.",
      sender: "Linh Pham",
      recipient: "Hiring Team\nAcme",
      salutation: "Dear team,",
      closing: "Best,",
      signature: "Linh",
    })
    assert.deepEqual(linesOf(paperPlainText(document)), [
      "Linh Pham",
      "Hiring Team",
      "Acme",
      "Dear team,",
      "Body line.",
      "Best,",
      "Linh",
    ])
  })

  it("prints lists folded and nested for a letter", () => {
    const item = (id: string, children: unknown[] = []) => ({
      id,
      type: "bullet",
      content: richTextOf(id),
      children,
    })
    const document = paperDocumentSchema.parse({
      version: 3,
      kind: "letter",
      blocks: [
        item("a", [item("b")]),
        item("c"),
        { ...item("d"), type: "numbered" },
      ],
      clashes: [],
    })
    const model = letterPrintModel(document as LetterPaper)
    assert.deepEqual(
      model.fragments.map(
        (fragment) =>
          fragment.kind === "list" && [
            fragment.list.ordered,
            fragment.list.items.length,
          ]
      ),
      [
        [false, 2],
        [true, 1],
      ]
    )
  })

  it("passes a v3 letter through unchanged", () => {
    const { document } = upgraded("letter", { markdown: "Hi" })
    const again = upgraded("letter", JSON.parse(JSON.stringify(document)))
    assert.equal(again.from, "letter-v3")
    assert.deepEqual(again.document, document)
  })
})
