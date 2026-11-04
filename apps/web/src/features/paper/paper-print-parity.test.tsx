import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  PAPER_TEMPLATE_IDS,
  cvPrintModel,
  emptyCvDocument,
  paperDocumentSchema,
  type CvDocument,
  type CvPaper,
  type CvSectionKind,
  type CvTemplateId,
  type LetterPaper,
} from "@workspace/domain"

import { CvDocument as CvTemplate } from "./cv-print-document.tsx"
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

function visibleText(node: HTMLElement) {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim()
}

const richV1 = paperDocumentSchema.parse({
  version: 3,
  kind: "cv",
  header: {
    id: "header",
    type: "header",
    name: v1.name,
    email: v1.contact.email,
    phone: v1.contact.phone,
    city: v1.contact.location,
    linkedin: v1.contact.linkedin ?? "",
    photo: v1.photoUrl,
  },
  clashes: [],
  blocks: [
    {
      id: "section-summary",
      type: "section",
      kind: "summary",
      title: "Summary",
    },
    {
      id: "headline",
      type: "heading",
      level: 2,
      content: [{ text: v1.headline }],
    },
    { id: "summary", type: "paragraph", content: [{ text: v1.summary }] },
    {
      id: "section-experience",
      type: "section",
      kind: "experience",
      title: "Experience",
    },
    {
      id: "exp-1",
      type: "experience",
      role: "Intern",
      company: "Northwind",
      period: "2024",
      location: "Hanoi",
      children: [
        {
          id: "b1",
          type: "bullet",
          content: [{ text: "Shipped the board" }],
          children: [],
        },
      ],
    },
    {
      id: "exp-2",
      type: "experience",
      role: "",
      company: "Campus lab",
      period: "2023",
      location: "",
      children: [
        {
          id: "b3",
          type: "bullet",
          content: [{ text: "Noted the result" }],
          children: [],
        },
      ],
    },
    {
      id: "section-education",
      type: "section",
      kind: "education",
      title: "Education",
    },
    {
      id: "ed-1",
      type: "education",
      school: "NTU",
      degree: "CS",
      period: "2023",
      detail: "Thesis on type",
      children: [],
    },
    { id: "section-skills", type: "section", kind: "skills", title: "Skills" },
    {
      id: "sk-1",
      type: "skills",
      label: "Tools",
      items: ["Figma", "SQL, Postgres"],
    },
    { id: "sk-2", type: "skills", label: "", items: ["Typing"] },
    {
      id: "section-projects",
      type: "section",
      kind: "projects",
      title: "Projects",
    },
    {
      id: "ph-1",
      type: "heading",
      level: 2,
      content: [{ text: "Campus board" }],
    },
    {
      id: "pt-1",
      type: "paragraph",
      content: [{ text: "Line one\nLine two" }],
    },
    {
      id: "ph-2",
      type: "heading",
      level: 2,
      content: [{ text: "Empty detail" }],
    },
    {
      id: "section-languages",
      type: "section",
      kind: "languages",
      title: "Languages",
    },
    {
      id: "lang",
      type: "paragraph",
      content: [{ text: "Vietnamese, native" }],
    },
  ],
}) as CvPaper

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
    const letter = paperDocumentSchema.parse({
      version: 3,
      kind: "letter",
      clashes: [],
      blocks: ["Ada", "May 5", "First.", "Second.", "Ada"].map(
        (text, index) => ({
          id: `l-${index + 1}`,
          type: "paragraph",
          content: [{ text }],
        })
      ),
    }) as LetterPaper
    const printed = visibleText(
      render(<LetterPrintView document={letter} />).container
    )
    expect(printed).toContain("First.")
    expect(printed).toContain("Second.")
    expect(printed).toContain("Ada")
    expect(printed).toContain("May 5")
  })

  it("prints the school name in the entry head", () => {
    const schoolName = v1.education[0]?.school
    if (!schoolName) throw new Error("print fixture has no school")
    const layouts: CvTemplateId[] = ["internship", "photo"]
    for (const layout of layouts) {
      const view = render(
        <CvTemplate
          data={cvPrintModel(richV1, layout)}
          onChange={() => undefined}
        />
      )
      const school = view.getByRole("textbox", { name: "School" })
      expect(school, layout).toHaveTextContent(schoolName)
      const head = school.closest(".cv-print-entry-head")
      expect(head, layout).not.toBeNull()
      expect(head?.classList.contains("flex"), layout).toBe(true)
      expect(
        head?.parentElement?.classList.contains("cv-print-entry"),
        layout
      ).toBe(true)
      cleanup()
    }
  })
})
