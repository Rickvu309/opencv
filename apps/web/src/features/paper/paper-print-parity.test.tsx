import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  blocksToPreviewModel,
  cvCodecToBlocks,
  cvPrintModel,
  emptyCvDocument,
  paragraphsToBlockDocument,
  upgradeStoredPaper,
  type CvBlockDocument,
  type CvDocument,
  type CvPaper,
  type CvTemplateId,
  type LetterPaper,
} from "@workspace/domain"

import { CvDocument as CvTemplate } from "./cv-print-document.tsx"
import { LetterSheet } from "./letter-sheet.tsx"
import { LetterPrintView } from "./paper-letter-print.tsx"
import { printLayout } from "./paper-templates.ts"

const layouts = [
  "internship",
  "academic",
  "product",
  "service",
  "photo",
] as const satisfies readonly CvTemplateId[]

const v1: CvDocument = {
  ...emptyCvDocument(),
  name: "Lan Nguyen",
  headline: "Product intern",
  summary: "Ships small experiments.",
  experience: [
    {
      role: "Intern",
      company: "Northwind",
      period: "2024",
      bullets: ["Shipped the board"],
    },
  ],
  education: [{ school: "NTU", degree: "CS", period: "2023" }],
  skills: [{ label: "Tools", items: ["Figma", "SQL"] }],
}

const v2: CvBlockDocument = {
  version: 2,
  header: {
    name: "Ada Lane",
    email: "ada@example.com",
    phone: "",
    city: "Hanoi",
    linkedin: "",
  },
  sections: [
    {
      id: "summary",
      kind: "summary",
      blocks: [{ id: "t1", type: "text", text: "Builds careful pages." }],
    },
    {
      id: "experience",
      kind: "experience",
      blocks: [
        {
          id: "x1",
          type: "experience-entry",
          role: "Intern",
          company: "Northwind",
          period: "2024",
          bullets: [{ id: "b1", text: "Shipped the board" }],
        },
      ],
    },
  ],
}

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

function renderTemplate(data: CvDocument) {
  return visibleText(
    render(<CvTemplate data={data} onChange={() => undefined} />).container
  )
}

afterEach(() => {
  cleanup()
})

describe("print parity", () => {
  it("uses the photo layout for the with-photo gallery id", () => {
    expect(printLayout("with-photo")).toBe("photo")
    expect(layouts).toContain(printLayout("with-photo"))
  })

  const fixtures: [string, unknown, CvBlockDocument][] = [
    ["v1", v1, cvCodecToBlocks(v1)],
    ["v2", v2, v2],
    [
      "imported",
      paragraphsToBlockDocument("Lan Nguyen\n\nShips small experiments."),
      paragraphsToBlockDocument("Lan Nguyen\n\nShips small experiments."),
    ],
  ]

  for (const layout of layouts) {
    for (const [name, stored, previewSource] of fixtures) {
      it(`${layout} ${name} text matches the version 2 preview`, () => {
        const paper = upgradedCv(stored)
        expect(renderTemplate(cvPrintModel(paper, layout))).toBe(
          renderTemplate(blocksToPreviewModel(previewSource, layout))
        )
      })
    }
  }

  it("prints a custom section title by name", () => {
    const paper = upgradedCv(v2)
    const custom: CvPaper = {
      ...paper,
      blocks: paper.blocks.map((block) =>
        block.type === "section" && block.kind === "experience"
          ? { ...block, title: "Selected roles" }
          : block
      ),
    }
    const previous = renderTemplate(blocksToPreviewModel(v2, "internship"))
    const printed = renderTemplate(cvPrintModel(custom, "internship"))
    expect(previous).toContain("Experience")
    expect(previous).toContain("Northwind")
    expect(printed).toContain("Selected roles")
    expect(printed).toContain("Northwind")
  })

  it("matches the stored letter text on the share page letter view", () => {
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
