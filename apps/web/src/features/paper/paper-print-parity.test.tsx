import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  PAPER_TEMPLATE_IDS,
  blocksToPreviewModel,
  cvPrintModel,
  emptyCvDocument,
  paragraphsToBlockDocument,
  upgradeStoredPaper,
  type CvBlockDocument,
  type CvDocument,
  type CvPaper,
  type CvSectionKind,
  type CvTemplateId,
  type LetterPaper,
} from "@workspace/domain"

import { CvDocument as CvTemplate } from "./cv-print-document.tsx"
import { LetterSheet } from "./letter-sheet.tsx"
import { LetterPrintView } from "./paper-letter-print.tsx"
import { printLayout } from "./paper-templates.ts"

const v1: CvDocument = {
  ...emptyCvDocument(),
  name: "Lan Nguyen",
  headline: "Product intern",
  contact: {
    email: "lan@example.com",
    phone: "090",
    location: "Hanoi",
    linkedin: "linkedin.com/in/lan",
  },
  summary: "Ships small experiments.",
  experience: [
    {
      role: "Intern",
      company: "Northwind",
      period: "2024",
      location: "Hanoi",
      bullets: ["Shipped the board", ""],
    },
    {
      role: "",
      company: "Campus lab",
      period: "2023",
      bullets: ["Noted the result"],
    },
  ],
  education: [
    { school: "NTU", degree: "CS", period: "2023", detail: "Thesis on type" },
  ],
  skills: [
    { label: "Tools", items: ["Figma", "SQL, Postgres"] },
    { label: "", items: ["", "Typing"] },
  ],
  projects: [
    { name: "Campus board", detail: "Line one\nLine two" },
    { name: "Empty detail", detail: "" },
  ],
  languages: ["Vietnamese, native"],
  photoUrl: "https://images.example/lan.png",
}

const v2: CvBlockDocument = {
  version: 2,
  header: {
    name: "Ada Lane",
    email: "ada@example.com",
    phone: "",
    city: "Hanoi",
    linkedin: "linkedin.com/in/ada",
    photo: "https://images.example/ada.png",
  },
  sections: [
    {
      id: "summary",
      kind: "summary",
      blocks: [
        { id: "h1", type: "heading", text: "Careful pages" },
        { id: "t1", type: "text", text: "Builds careful pages." },
        {
          id: "l1",
          type: "bulleted-list",
          items: [{ id: "li1", text: "Shipped the board" }],
        },
      ],
    },
    {
      id: "experience",
      kind: "experience",
      blocks: [
        { id: "loose", type: "text", text: "A loose line before the role" },
        {
          id: "x1",
          type: "experience-entry",
          role: "Intern",
          company: "Northwind",
          period: "2024",
          location: "Hanoi",
          bullets: [{ id: "b1", text: "Shipped the board" }],
        },
      ],
    },
    {
      id: "education",
      kind: "education",
      blocks: [
        {
          id: "ed1",
          type: "education-entry",
          school: "NTU",
          degree: "CS",
          period: "2023",
          detail: "Thesis on type",
        },
      ],
    },
    {
      id: "skills",
      kind: "skills",
      blocks: [
        {
          id: "sk1",
          type: "skills-group",
          label: "Tools",
          items: ["Figma", "SQL, Postgres"],
        },
        { id: "sk2", type: "text", text: "Go, Rust" },
      ],
    },
    {
      id: "projects",
      kind: "projects",
      blocks: [
        { id: "ph", type: "heading", text: "Campus board" },
        { id: "pt", type: "text", text: "Line one" },
        {
          id: "pl",
          type: "bulleted-list",
          items: [{ id: "pi", text: "Line two" }],
        },
      ],
    },
    {
      id: "languages",
      kind: "languages",
      blocks: [{ id: "lang", type: "text", text: "Vietnamese, native" }],
    },
    {
      id: "awards",
      kind: "awards",
      blocks: [{ id: "aw", type: "text", text: "Dean's list" }],
    },
    {
      id: "activities",
      kind: "activities",
      blocks: [{ id: "ac", type: "text", text: "Reading group" }],
    },
  ],
}

const imported = paragraphsToBlockDocument(
  "Lan Nguyen\n\nShips small experiments."
)

function visibleText(node: HTMLElement) {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim()
}

function upgradedCv(stored: unknown): CvPaper {
  const result = upgradeStoredPaper("cv", stored)
  if (!result.ok || result.document.kind !== "cv") {
    throw new Error(result.ok ? "expected a cv" : result.message)
  }
  return result.document
}

function shown(data: CvDocument) {
  const view = render(<CvTemplate data={data} onChange={() => undefined} />)
  const img = view.container.querySelector("img")
  const titles = [
    ...view.container.querySelectorAll("[data-cv-type='section-title']"),
  ].map((node) => node.textContent ?? "")
  const picture = {
    text: visibleText(view.container),
    alt: img?.getAttribute("alt") ?? null,
    src: img?.getAttribute("src") ?? null,
    titles,
  }
  cleanup()
  return picture
}

const richV1 = upgradedCv(v1)

const fixtures: {
  name: string
  paper: CvPaper
  anchor: string
  entry: string
  photo: boolean
  previous: (layout: CvTemplateId) => CvDocument
}[] = [
  {
    name: "v1",
    paper: richV1,
    anchor: "Lan Nguyen",
    entry: "Northwind",
    photo: true,
    previous: (layout) => ({ ...v1, templateId: layout }),
  },
  {
    name: "v2",
    paper: upgradedCv(v2),
    anchor: "Ada Lane",
    entry: "Northwind",
    photo: true,
    previous: (layout) => blocksToPreviewModel(v2, layout),
  },
  {
    name: "imported",
    paper: upgradedCv(imported),
    anchor: "Lan Nguyen",
    entry: "Ships small experiments.",
    photo: false,
    previous: (layout) => blocksToPreviewModel(imported, layout),
  },
]

const renamed: {
  layout: CvTemplateId
  kind: CvSectionKind
  from: string
  to: string
}[] = [
  {
    layout: "internship",
    kind: "experience",
    from: "Experience",
    to: "Selected roles",
  },
  {
    layout: "photo",
    kind: "experience",
    from: "Experience",
    to: "Selected roles",
  },
  {
    layout: "service",
    kind: "experience",
    from: "Work experience",
    to: "Selected roles",
  },
  {
    layout: "product",
    kind: "projects",
    from: "Selected work",
    to: "Campus pieces",
  },
  {
    layout: "academic",
    kind: "projects",
    from: "Projects & campus",
    to: "Studio work",
  },
]

function withTitle(paper: CvPaper, kind: CvSectionKind, title: string) {
  return {
    ...paper,
    blocks: paper.blocks.map((block) =>
      block.type === "section" && block.kind === kind
        ? { ...block, title }
        : block
    ),
  }
}

afterEach(() => {
  cleanup()
})

describe("print parity", () => {
  it("prints every gallery id with the same words as the old reader", () => {
    expect(printLayout("with-photo")).toBe("photo")
    const seen = new Set<string>()
    for (const id of PAPER_TEMPLATE_IDS) {
      const layout = printLayout(id)
      for (const fixture of fixtures) {
        const key = `${layout}:${fixture.name}`
        if (seen.has(key)) continue
        seen.add(key)
        const next = shown(cvPrintModel(fixture.paper, layout))
        const previous = shown(fixture.previous(layout))
        expect(next.text, key).toBe(previous.text)
        expect(next.text, key).toContain(fixture.anchor)
        expect(next.text, key).toContain(fixture.entry)
        if (layout === "photo" && fixture.photo) {
          expect(next.alt, key).toBe(previous.alt)
          expect(next.src, key).toBe(previous.src)
          expect(next.alt, key).toContain(fixture.anchor)
          expect(next.src, key).toContain("https://")
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5)
  })

  it.each(renamed)(
    "$layout prints a custom $kind title",
    ({ layout, kind, from, to }) => {
      const printed = shown(cvPrintModel(withTitle(richV1, kind, to), layout))
      expect(printed.titles).toContain(to)
      expect(printed.titles).not.toContain(from)
      expect(printed.text).toContain("Northwind")
    }
  )

  it("replaces a combined skills heading with the skills title", () => {
    const printed = shown(
      cvPrintModel(withTitle(richV1, "skills", "Tools"), "academic")
    )
    expect(printed.titles).toContain("Tools")
    expect(printed.titles).not.toContain("Skills & languages")
  })

  it("prints an empty custom title instead of the template word", () => {
    const printed = shown(
      cvPrintModel(withTitle(richV1, "skills", ""), "internship")
    )
    expect(printed.titles).toContain("")
    expect(printed.titles).not.toContain("Skills")
  })

  it("matches the stored letter words on the share letter view", () => {
    const stored = {
      markdown: "First.\n\nSecond.",
      sender: "Ada",
      date: "May 5",
      signature: "Ada",
    }
    const result = upgradeStoredPaper("letter", stored)
    if (!result.ok || result.document.kind !== "letter") {
      throw new Error(result.ok ? "expected a letter" : result.message)
    }
    const letter: LetterPaper = result.document
    const previous = visibleText(
      render(<LetterSheet letter={stored} />).container
    )
    const printed = visibleText(
      render(<LetterPrintView document={letter} />).container
    )
    expect(printed).toBe(previous)
    expect(printed).toContain("First.")
    expect(printed).toContain("Second.")
    expect(printed).toContain("Ada")
  })
})
