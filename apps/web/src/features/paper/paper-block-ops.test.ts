import { describe, expect, it } from "vitest"
import {
  emptyCvDocument,
  type CvBlock,
  type CvBlockDocument,
} from "@workspace/domain"

import {
  deleteBlock,
  dropBlock,
  readEditorDocument,
} from "./paper-block-ops.ts"

const document: CvBlockDocument = {
  version: 2,
  header: { name: "", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    {
      id: "summary",
      kind: "summary",
      blocks: [{ id: "sum", type: "text", text: "Line" }],
    },
    {
      id: "experience",
      kind: "experience",
      blocks: [{ id: "role", type: "text", text: "Role" }],
    },
  ],
}

describe("block ops", () => {
  it("removes a non-starter section when its last block goes", () => {
    const next = deleteBlock(document, "sum")
    expect(next.sections.map((section) => section.kind)).toEqual(["experience"])
  })

  it("keeps an empty experience section", () => {
    const next = deleteBlock(document, "role")
    expect(next.sections.map((section) => section.kind)).toEqual([
      "summary",
      "experience",
    ])
    expect(next.sections[1]?.blocks).toEqual([])
  })

  it("moves a block onto another section", () => {
    const next = dropBlock(document, "role", "section:summary")
    expect(next.sections[0]?.blocks.map((block) => block.id)).toEqual([
      "sum",
      "role",
    ])
  })

  it("reads a version 1 CV as version 2", () => {
    const next = readEditorDocument(emptyCvDocument())
    expect(next.version).toBe(2)
    expect(next.header.name).toBe("")
  })
})

const expA: CvBlock = {
  id: "exp-a",
  type: "experience-entry",
  role: "First role",
  company: "Northwind",
  period: "2020",
  bullets: [],
}
const expB: CvBlock = {
  id: "exp-b",
  type: "experience-entry",
  role: "Second role",
  company: "Contoso",
  period: "2022",
  bullets: [],
}
const edu: CvBlock = {
  id: "edu-1",
  type: "education-entry",
  school: "State",
  degree: "BSc",
  period: "2019",
  detail: "Honors",
}
const skill: CvBlock = {
  id: "skill-1",
  type: "skills-group",
  label: "Tools",
  items: ["TypeScript"],
}

const header = { name: "Ada", email: "", phone: "", city: "", linkedin: "" }

function threeSections(educationBlocks: CvBlock[]): CvBlockDocument {
  return {
    version: 2,
    header,
    sections: [
      { id: "section-experience", kind: "experience", blocks: [expA, expB] },
      { id: "section-education", kind: "education", blocks: educationBlocks },
      { id: "section-skills", kind: "skills", blocks: [skill] },
    ],
  }
}

describe("drop on a section heading", () => {
  it("appends the block and keeps every other block, one result per heading", () => {
    const commits: CvBlockDocument[] = []
    let next = threeSections([edu])
    for (const sectionId of [
      "section-experience",
      "section-education",
      "section-skills",
    ]) {
      const dropped = dropBlock(next, "exp-b", `section:${sectionId}`)
      expect(dropped).not.toBe(next)
      commits.push(dropped)
      next = dropped
    }
    expect(commits).toHaveLength(3)
    expect(commits[0]).toEqual(threeSections([edu]))
    expect(commits[1]?.sections).toEqual([
      { id: "section-experience", kind: "experience", blocks: [expA] },
      { id: "section-education", kind: "education", blocks: [edu, expB] },
      { id: "section-skills", kind: "skills", blocks: [skill] },
    ])
    expect(commits[2]?.sections).toEqual([
      { id: "section-experience", kind: "experience", blocks: [expA] },
      { id: "section-education", kind: "education", blocks: [edu] },
      {
        id: "section-skills",
        kind: "skills",
        blocks: [skill, expB],
      },
    ])
    expect(commits[2]?.header).toEqual(header)
    expect(commits[2]?.version).toBe(2)
  })

  it("keeps the on-screen starter when the heading's section has no stored blocks", () => {
    const next = dropBlock(
      threeSections([]),
      "exp-b",
      "section:section-education"
    )
    expect(next.sections).toEqual([
      { id: "section-experience", kind: "experience", blocks: [expA] },
      {
        id: "section-education",
        kind: "education",
        blocks: [
          {
            id: "draft-section-education",
            type: "education-entry",
            school: "",
            degree: "",
            period: "",
            detail: "",
          },
          expB,
        ],
      },
      { id: "section-skills", kind: "skills", blocks: [skill] },
    ])
    const onStarter = dropBlock(
      threeSections([]),
      "exp-b",
      "draft-section-education"
    )
    expect(onStarter.sections).toEqual(next.sections)
  })

  it("keeps a starter when a missing section heading receives a block", () => {
    const source = threeSections([edu])
    const withoutSkills = {
      ...source,
      sections: source.sections.filter((section) => section.kind !== "skills"),
    }
    const next = dropBlock(withoutSkills, "exp-b", "section:ghost-skills")
    const skills = next.sections.find((section) => section.kind === "skills")
    expect(skills?.blocks.map((block) => block.type)).toEqual([
      "skills-group",
      "experience-entry",
    ])
    expect(skills?.blocks[1]).toEqual(expB)
    expect(
      next.sections.find((section) => section.id === "section-education")
        ?.blocks
    ).toEqual([edu])
    expect(
      next.sections.find((section) => section.id === "section-experience")
        ?.blocks
    ).toEqual([expA])
  })
})
