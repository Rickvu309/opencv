import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cvPrintModel,
  paperDocumentSchema,
  paperPlainText,
  upgradeStoredPaper,
  type CvPaper,
} from "./paper-doc/index.ts"

const SEPARATORS = /[\s\p{Cc}]+/u

function tokensOf(text: string): string[] {
  return text.split(SEPARATORS).filter((token) => token !== "")
}

const SKIPPED_KEYS = new Set([
  "id",
  "type",
  "version",
  "kind",
  "photo",
  "photoUrl",
  "templateId",
])

function storedStrings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(storedStrings)
  if (typeof value !== "object" || value === null) return []
  return Object.entries(value).flatMap(([key, inner]) =>
    SKIPPED_KEYS.has(key) ? [] : storedStrings(inner)
  )
}

function assertEveryWordKept(stored: string[], plainText: string, label = "") {
  let cursor = 0
  for (const token of stored.flatMap(tokensOf)) {
    const at = plainText.indexOf(token, cursor)
    assert.notEqual(at, -1, `${label} lost ${JSON.stringify(token)}`)
    cursor = at + token.length
  }
}

function upgraded(kind: "cv" | "letter", stored: unknown) {
  const result = upgradeStoredPaper(kind, stored)
  if (!result.ok) throw new Error(`${result.reason}: ${result.message}`)
  assert.equal(paperDocumentSchema.safeParse(result.document).success, true)
  return result.document
}

const LETTER_INPUTS = [
  "[my site](example.com)",
  "2020. A great year for us",
  "3. Third reason",
  "# of hires grew",
  "5 * 3 * 2 = 30",
  "\\*literal\\* and a\\\\b and C:\\\\Users\\\\[me]",
  "---\n\n***\n\n___",
  "* bullet\n*italic line* after",
  "- one\n  - nested\n1) numbered",
  "snake_case_name **bold** ***both*** `code`",
  "[portfolio](https://ex.com/a_(b)) and [x](javascript:alert(1))",
  "> quote\n\n| a | b |\n|---|---|",
  "line one\nline two\n\n\n\nline three\r\n\r\nline four",
  "Tab\there, form\ffeed, vt\u000bx",
  "Ünïcödé \u2014 “quotes” 日本語 😀",
]

const LETTER_PARTS = {
  sender: "Linh Pham",
  contact: "linh@example.com | +84 912 345 678",
  date: "2 November 2026",
  recipient: "Hiring Team\nAcme *Corp*",
  salutation: "Dear team,",
  closing: "Best,",
  signature: "Linh",
}

describe("a letter upgrades as the plain text the person saw", () => {
  for (const markdown of LETTER_INPUTS) {
    it(`keeps every word of ${JSON.stringify(markdown.slice(0, 30))}`, () => {
      const document = upgraded("letter", { markdown })
      assert.equal(JSON.stringify(document).includes("href"), false)
      assert.ok(document.blocks.every((block) => block.type === "paragraph"))
      assert.deepEqual(
        tokensOf(paperPlainText(document)),
        tokensOf(markdown),
        markdown
      )
    })
  }

  it("keeps every part and the body, in reading order, adding nothing", () => {
    const stored = { markdown: "Body *line*.\n\nSecond", ...LETTER_PARTS }
    const document = upgraded("letter", stored)
    const reading = [
      stored.sender,
      stored.contact,
      stored.date,
      stored.recipient,
      stored.salutation,
      stored.markdown,
      stored.closing,
      stored.signature,
    ]
    assert.deepEqual(
      tokensOf(paperPlainText(document)),
      reading.flatMap(tokensOf)
    )
  })

  it("keeps a body of 5000 paragraphs and 200000 characters", () => {
    const markdown = Array.from(
      { length: 5000 },
      (_, index) => `Paragraph ${index} ${"word ".repeat(7)}`
    ).join("\n\n")
    const document = upgraded("letter", { markdown })
    assert.equal(document.blocks.length, 5000)
    assertEveryWordKept([markdown], paperPlainText(document))
  })
})

const header = { name: "", email: "", phone: "", city: "", linkedin: "" }

function v1Cv(overrides: Record<string, unknown> = {}) {
  return {
    templateId: "product",
    name: "Lan",
    headline: "Engineer",
    contact: { email: "e@x.com", phone: "123", location: "HN" },
    summary: "Builds things.",
    experience: [],
    education: [],
    skills: [],
    ...overrides,
  }
}

function v1Words(cv: ReturnType<typeof v1Cv>): string[] {
  const rest = cv as Record<string, unknown>
  return [
    cv.name,
    ...storedStrings(cv.contact),
    cv.headline,
    cv.summary,
    ...storedStrings(rest.experience),
    ...storedStrings(rest.education),
    ...storedStrings(rest.skills),
    ...storedStrings(rest.projects),
    ...storedStrings(rest.languages),
  ]
}

describe("a v1 CV upgrades without losing a word", () => {
  it("keeps every skill group with its label and items", () => {
    const cv = v1Cv({
      skills: [
        { label: "Languages", items: ["Go"] },
        { label: "Tools", items: ["Docker"] },
      ],
    })
    const document = upgraded("cv", cv) as CvPaper
    const groups = document.blocks.filter((block) => block.type === "skills")
    assert.deepEqual(
      groups.map((group) => [group.label, group.items]),
      [
        ["Languages", ["Go"]],
        ["Tools", ["Docker"]],
      ]
    )
    assert.deepEqual(cvPrintModel(document, "product").skills, cv.skills)
    assertEveryWordKept(v1Words(cv), paperPlainText(document))
  })

  it("keeps projects, languages, headline, contact and photo", () => {
    const cv = v1Cv({
      contact: {
        email: "e@x.com",
        phone: "123",
        location: "HN",
        linkedin: "linkedin.com/in/lan",
      },
      summary: "Engineer",
      projects: [
        { name: "Wallet audit", detail: "Mapped friction\nand drop-off" },
        { name: "Card study", detail: "" },
      ],
      languages: ["Vietnamese", "English"],
      photoUrl: "file:6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11",
    })
    const document = upgraded("cv", cv) as CvPaper
    const printed = cvPrintModel(document, "product")
    assert.equal(printed.headline, "Engineer")
    assert.equal(printed.summary, "Engineer")
    assert.equal(printed.contact.linkedin, "linkedin.com/in/lan")
    assert.deepEqual(printed.projects, cv.projects)
    assert.deepEqual(printed.languages, cv.languages)
    assert.equal(printed.photoUrl, cv.photoUrl)
    assertEveryWordKept(v1Words(cv), paperPlainText(document))
  })

  it("keeps a skill with a comma and a language with a comma", () => {
    const cv = v1Cv({
      skills: [
        { label: "Reach", items: ["1,000 users", "Python (NumPy, pandas)"] },
      ],
      languages: ["English, fluent", "French"],
    })
    const document = upgraded("cv", cv) as CvPaper
    assert.deepEqual(cvPrintModel(document, "product").skills, cv.skills)
    assertEveryWordKept(v1Words(cv), paperPlainText(document))
  })

  it("keeps four skill groups of sixteen items each", () => {
    const skills = ["Languages", "Frameworks", "Tools", "Cloud"].map(
      (label) => ({
        label,
        items: Array.from({ length: 16 }, (_, index) => `${label}${index}`),
      })
    )
    const cv = v1Cv({ headline: "", summary: "", skills })
    const document = upgraded("cv", cv) as CvPaper
    assert.deepEqual(cvPrintModel(document, "product").skills, skills)
  })

  it("keeps a headline that equals the summary, both times", () => {
    const cv = v1Cv({ headline: "Engineer", summary: "Engineer" })
    const document = upgraded("cv", cv) as CvPaper
    assert.equal(
      tokensOf(paperPlainText(document)).filter((word) => word === "Engineer")
        .length,
      2
    )
  })
})

describe("stored rows at any size upgrade", () => {
  it("upgrades a v1 CV past every former cap", () => {
    const cv = v1Cv({
      summary: "s ".repeat(1200),
      experience: Array.from({ length: 3 }, (_, index) => ({
        role: `Role ${index} ${"r".repeat(2001)}`,
        company: "Co",
        period: "2024",
        bullets: Array.from({ length: 201 }, (_, bullet) => `Bullet ${bullet}`),
      })),
      education: [
        { school: "S", degree: "D", period: "P", detail: "d".repeat(2001) },
      ],
      skills: Array.from({ length: 3 }, (_, group) => ({
        label: `Group ${group}`,
        items: Array.from(
          { length: 61 },
          (_, item) => `Skill ${group}-${item}`
        ),
      })),
      projects: Array.from({ length: 3 }, (_, index) => ({
        name: `Project ${index}`,
        detail: "x".repeat(2001),
      })),
      languages: Array.from({ length: 10 }, (_, index) => `Language ${index}`),
    })
    const document = upgraded("cv", cv) as CvPaper
    assertEveryWordKept(v1Words(cv), paperPlainText(document))
  })

  it("upgrades a v2 CV with 4000 skill items, 4000 bullets and 100000 characters", () => {
    const stored = {
      version: 2,
      header,
      sections: [
        {
          id: "sum",
          kind: "summary",
          blocks: [{ id: "t", type: "text", text: "word ".repeat(20000) }],
        },
        {
          id: "exp",
          kind: "experience",
          blocks: [
            {
              id: "x",
              type: "experience-entry",
              role: "r",
              company: "c",
              period: "p",
              bullets: Array.from({ length: 4000 }, (_, index) => ({
                id: `b${index}`,
                text: `Did thing ${index}`,
              })),
            },
          ],
        },
        {
          id: "skills",
          kind: "skills",
          blocks: [
            {
              id: "k",
              type: "skills-group",
              label: "All",
              items: Array.from(
                { length: 4000 },
                (_, index) => `S ${index}, x`
              ),
            },
          ],
        },
      ],
    }
    const document = upgraded("cv", stored)
    assertEveryWordKept(storedStrings(stored), paperPlainText(document))
  })

  it("upgrades a v2 group of 20 items shaped like 'a, b, c, d' without splitting them", () => {
    const items = Array.from({ length: 20 }, () => "a, b, c, d")
    const stored = {
      version: 2,
      header,
      sections: [
        {
          id: "s",
          kind: "skills",
          blocks: [{ id: "k", type: "skills-group", label: "L", items }],
        },
      ],
    }
    const document = upgraded("cv", stored) as CvPaper
    const group = document.blocks.find((block) => block.type === "skills")
    assert.deepEqual(group?.type === "skills" && group.items, items)
  })

  it("upgrades text and fields past the former caps", () => {
    const stored = {
      version: 2,
      header,
      sections: [
        {
          id: "e",
          kind: "education",
          blocks: [
            {
              id: "e1",
              type: "education-entry",
              school: "S",
              degree: "D",
              period: "P",
              detail: "x".repeat(2001),
            },
          ],
        },
        {
          id: "s",
          kind: "skills",
          blocks: [
            {
              id: "k",
              type: "skills-group",
              label: "L",
              items: Array.from(
                { length: 61 },
                (_, index) => `s${index}`
              ).concat("x".repeat(201)),
            },
          ],
        },
        {
          id: "t",
          kind: "summary",
          blocks: [{ id: "t1", type: "text", text: "x".repeat(20001) }],
        },
      ],
    }
    const document = upgraded("cv", stored)
    assertEveryWordKept(storedStrings(stored), paperPlainText(document))
  })
})

describe("v2 ids and skills", () => {
  const skillsDoc = (blocks: unknown[]) => ({
    version: 2,
    header,
    sections: [{ id: "s1", kind: "skills", blocks }],
  })

  it("keeps items with commas whole", () => {
    const items = ["1,000 users", "Python (NumPy, pandas)"]
    const document = upgraded(
      "cv",
      skillsDoc([{ id: "k", type: "skills-group", label: "Reach", items }])
    ) as CvPaper
    const group = document.blocks.find((block) => block.type === "skills")
    assert.deepEqual(group?.type === "skills" && group.items, items)
    assert.equal(paperPlainText(document).includes("1,000 users"), true)
  })

  it("keeps a valid id of 57 to 64 characters as it is", () => {
    for (const length of [56, 57, 60, 64]) {
      const id = "a".repeat(length)
      const document = upgraded(
        "cv",
        skillsDoc([{ id, type: "text", text: "x" }])
      ) as CvPaper
      assert.equal(document.blocks[1]?.id, id, String(length))
    }
  })

  it("cuts an id longer than 64 characters", () => {
    const document = upgraded(
      "cv",
      skillsDoc([{ id: "a".repeat(90), type: "text", text: "x" }])
    ) as CvPaper
    assert.equal(document.blocks[1]?.id.length, 56)
  })

  it("prints two adjacent skills lists as one group of every item", () => {
    const list = (id: string, text: string) => ({
      id,
      type: "bulleted-list",
      items: [{ id: `${id}i`, text }],
    })
    const document = upgraded(
      "cv",
      skillsDoc([list("l1", "Go"), list("l2", "Rust, Zig")])
    ) as CvPaper
    assert.deepEqual(cvPrintModel(document, "product").skills, [
      { label: "Skills", items: ["Go", "Rust", "Zig"] },
    ])
  })
})
